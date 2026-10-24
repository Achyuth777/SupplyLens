import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {authenticate, verifyGoogleIDToken, hash, safeReturn, ORIGIN} from '../scripts/cloudflare-auth.mjs';
const encoder=new TextEncoder();
const b64=bytes=>Buffer.from(bytes).toString('base64url');
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'fixture',alg:'RS256',use:'sig'};
async function jwt(overrides={}) {
 const now=Math.floor(Date.now()/1000);
 const data={iss:'https://accounts.google.com',aud:'client',sub:'123',email:'a@example.com',email_verified:true,name:'Achyuth ✓',nonce:'nonce',iat:now,exp:now+300,...overrides};
 const payload=b64(JSON.stringify({alg:'RS256',kid:'fixture'}))+'.'+b64(JSON.stringify(data));
 return payload+'.'+b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,encoder.encode(payload)));
}
function database() {
 const sqlite=new DatabaseSync(':memory:');
 return {sqlite,prepare(sql){let args=[];const result={bind(...v){args=v;return result},async run(){return sqlite.prepare(sql).run(...args)},async first(){return sqlite.prepare(sql).get(...args)||null}};return result},async batch(statements){return Promise.all(statements.map(s=>s.run()))}};
}
const request=(path,init={})=>new Request(ORIGIN+path,init);
const cookieValue=(response,name)=>response.headers.getSetCookie().find(c=>c.startsWith(name+'='))?.split(';')[0];
async function flow(env,sub='123') {
 const first=await authenticate(request('/auth/google?return_to=%2Fworkspace%3Fview%3Dinventory'),env);
 assert.equal(first.response.status,303);
 const location=new URL(first.response.headers.get('location'));
 assert.equal(location.searchParams.get('redirect_uri'),ORIGIN+'/auth/google/callback');
 assert.equal(location.searchParams.get('code_challenge_method'),'S256');
 const fetcher=async(url,init)=>{
  if(url.endsWith('/certs'))return Response.json({keys:[jwk]});
  assert.equal(url,'https://oauth2.googleapis.com/token');
  assert.equal(init.body.get('client_secret'),'secret');
  assert.equal(await hash(init.body.get('code_verifier')),location.searchParams.get('code_challenge'));
  return Response.json({id_token:await jwt({sub,email:sub+'@example.com',nonce:location.searchParams.get('nonce')})});
 };
 const callback='/auth/google/callback?state='+location.searchParams.get('state')+'&code=fixture-code';
 const browser=cookieValue(first.response,'__Host-supplylens-flow');
 return {callback,browser,fetcher};
}
test('signed Google token enforces signature, audience, issuer, nonce, expiry and verified email',async()=>{
 const fetcher=async()=>Response.json({keys:[jwk]});
 assert.equal((await verifyGoogleIDToken(await jwt(),'client','nonce',fetcher)).owner,'google:123');
 for(const claims of [{aud:'other'},{iss:'evil'},{nonce:'other'},{exp:1},{iat:99999999999},{email_verified:false},{sub:''}])await assert.rejects(()=>jwt(claims).then(token=>verifyGoogleIDToken(token,'client','nonce',fetcher)));
 const token=await jwt();const parts=token.split('.');parts[1]=b64(JSON.stringify({sub:'forged'}));await assert.rejects(()=>verifyGoogleIDToken(parts.join('.'),'client','nonce',fetcher));
});
test('OAuth login binds browser state, consumes callback once, stores hashed session and preserves destination',async()=>{
 const env={DB:database(),GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret'};
 const f=await flow(env);
 const wrong=await authenticate(request(f.callback),env,()=>{throw Error('must not fetch')});assert.equal(wrong.response.status,400);
 const result=await authenticate(request(f.callback,{headers:{cookie:f.browser}}),env,f.fetcher);
 assert.equal(result.response.status,303);assert.equal(result.response.headers.get('location'),'/workspace?view=inventory');
 const session=cookieValue(result.response,'__Host-supplylens-session');assert.ok(session);
 assert.match(result.response.headers.getSetCookie().find(x=>x.startsWith('__Host-supplylens-session=')),/HttpOnly; Secure; SameSite=Lax/);
 const saved=env.DB.sqlite.prepare('SELECT * FROM auth_sessions').get();assert.notEqual(saved.token_hash,session.split('=')[1]);
 const replay=await authenticate(request(f.callback,{headers:{cookie:f.browser}}),env,f.fetcher);assert.equal(replay.response.status,400);
 const authenticated=await authenticate(request('/workspace',{headers:{cookie:session,'oai-authenticated-user-id':'forged'}}),env);assert.equal(authenticated.request.headers.get('oai-authenticated-user-id'),'google:123');assert.equal(authenticated.private,true);
});
test('two accounts remain separate; forged headers and invalid or expired cookies never authenticate',async()=>{
 const env={DB:database(),GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret'};const sessions=[];
 for(const id of ['111','222']){const f=await flow(env,id);const r=await authenticate(request(f.callback,{headers:{cookie:f.browser}}),env,f.fetcher);sessions.push(cookieValue(r.response,'__Host-supplylens-session'));}
 for(let i=0;i<2;i++){const r=await authenticate(request('/api/workspace',{headers:{cookie:sessions[i],'oai-authenticated-user-id':'google:other'}}),env);assert.equal(r.request.headers.get('oai-authenticated-user-id'),`google:${i?'222':'111'}`);}
 const forged=await authenticate(request('/api/workspace',{headers:{'oai-authenticated-user-id':'google:111','oai-authenticated-user-email':'a@example.com'}}),env);assert.equal(forged.response.status,401);
 env.DB.sqlite.exec('UPDATE auth_sessions SET expires=1');assert.equal((await authenticate(request('/api/workspace',{headers:{cookie:sessions[0]}}),env)).response.status,401);
});
test('state expiry, provider cancellation, logout revocation and CSRF checks fail closed',async()=>{
 const env={DB:database(),GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret'};
 let f=await flow(env);env.DB.sqlite.exec('UPDATE auth_flows SET expires=1');assert.equal((await authenticate(request(f.callback,{headers:{cookie:f.browser}}),env,f.fetcher)).response.status,400);
 f=await flow(env);assert.equal((await authenticate(request(f.callback+'&error=access_denied',{headers:{cookie:f.browser}}),env,f.fetcher)).response.status,400);
 f=await flow(env);const signed=await authenticate(request(f.callback,{headers:{cookie:f.browser}}),env,f.fetcher);const session=cookieValue(signed.response,'__Host-supplylens-session');
 assert.equal((await authenticate(request('/api/workspace',{method:'POST',headers:{cookie:session,origin:'https://evil.test'}}),env)).response.status,403);
 assert.equal((await authenticate(request('/auth/logout',{method:'POST',headers:{cookie:session,origin:'https://evil.test'}}),env)).response.status,403);
 const logout=await authenticate(request('/auth/logout',{method:'POST',headers:{cookie:session,origin:ORIGIN}}),env);assert.equal(logout.response.status,303);assert.equal((await authenticate(request('/api/workspace',{headers:{cookie:session}}),env)).response.status,401);
});
test('safe redirects, canonical origin and public header stripping',async()=>{
 for(const path of ['//evil.test','/\\evil.test','https://evil.test','/auth/google'])assert.equal(safeReturn(path),'/workspace');
 assert.equal(safeReturn('/workspace?view=orders'),'/workspace?view=orders');
 const clean=await authenticate(request('/',{headers:{'oai-authenticated-user-id':'forged'}}),{});assert.equal(clean.request.headers.get('oai-authenticated-user-id'),null);
 assert.equal((await authenticate(new Request('https://evil.test/auth/google'),{})).response.status,403);
 assert.equal((await authenticate(request('/auth/google'),{})).response.status,503);
});
