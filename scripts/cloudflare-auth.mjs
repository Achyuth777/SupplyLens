// Standalone Google OIDC boundary. Never trust identity headers from the internet.
export const ORIGIN = 'https://supplylens.achyuthpvvirat.workers.dev';
const CALLBACK = `${ORIGIN}/auth/google/callback`;
const SESSION = '__Host-supplylens-session';
const FLOW = '__Host-supplylens-flow';
const SESSION_SECONDS = 7 * 24 * 3600;
const encoder = new TextEncoder();
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export const hash = async value => base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
function decode(value) { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); }
function cookie(request, name) {
  const values = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).filter(x => x.startsWith(`${name}=`));
  return values.length === 1 ? values[0].slice(name.length + 1) : '';
}
const setCookie = (name, value, age) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const secureHeaders = {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff'};
function redirect(path, cookies = []) {
  const headers = new Headers({...secureHeaders, Location: path});
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, {status: 303, headers});
}
export function safeReturn(value) {
  try {
    if (!value || !value.startsWith('/') || value.startsWith('//')) return '/workspace';
    const url = new URL(value, ORIGIN);
    if (url.origin !== ORIGIN || /^\/(auth|signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(url.pathname)) return '/workspace';
    return url.pathname + url.search;
  } catch { return '/workspace'; }
}
function page(title, content, status = 200, cookies = []) {
  const headers = new Headers({...secureHeaders, 'Content-Type': 'text/html; charset=utf-8'});
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | SupplyLens</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101c18;color:#f1f6f2;font:17px/1.7 system-ui}main{max-width:520px;padding:32px}h1{line-height:1.2}p{color:#bccdc2}a,button{display:inline-block;background:#d2ff00;color:#132013;padding:12px 22px;border:0;border-radius:24px;font:inherit;text-decoration:none;cursor:pointer}</style><main><small>SUPPLYLENS</small><h1>${title}</h1>${content}</main></html>`, {status, headers});
}
export const AUTH_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS auth_flows (state_hash TEXT PRIMARY KEY, browser_hash TEXT NOT NULL, verifier TEXT NOT NULL, nonce TEXT NOT NULL, return_to TEXT NOT NULL, expires INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, owner TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, expires INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS auth_flows_expiry ON auth_flows(expires)',
  'CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires)',
];
async function initialize(db) {
  // Additive schema only. Workspaces and their contents are never recreated.
  await db.batch(AUTH_SCHEMA.map(sql => db.prepare(sql)));
}
async function googleJSON(url, init, fetcher) {
  const response = await fetcher(url, {...init, redirect: 'error', signal: AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('Google authentication request failed');
  return response.json();
}
export async function verifyGoogleIDToken(token, clientId, nonce, fetcher = fetch, now = Math.floor(Date.now()/1000)) {
  if (typeof token !== 'string' || token.length > 20000) throw new Error('Missing identity token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid identity token');
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Unsupported token signature');
  const jwks = await googleJSON('https://www.googleapis.com/oauth2/v3/certs', {}, fetcher);
  const jwk = jwks.keys?.find(key => key.kid === header.kid && key.kty === 'RSA' && key.alg === 'RS256' && key.use === 'sig');
  if (!jwk) throw new Error('Unknown Google signing key');
  const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`))) throw new Error('Invalid signature');
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if (!['https://accounts.google.com','accounts.google.com'].includes(claims.iss) || claims.aud !== clientId || (claims.azp && claims.azp !== clientId) || claims.nonce !== nonce || !Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 60 || typeof claims.sub !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(claims.sub) || claims.email_verified !== true || typeof claims.email !== 'string' || claims.email.length > 320 || /[\r\n]/.test(claims.email)) throw new Error('Invalid Google identity claims');
  return {owner:`google:${claims.sub}`, email:claims.email, name:typeof claims.name === 'string' ? claims.name.slice(0,200) : claims.email};
}
export function stripIdentity(request) {
  const headers = new Headers(request.headers);
  for (const key of [...headers.keys()]) if (key.startsWith('oai-authenticated-user-')) headers.delete(key);
  return new Request(request, {headers});
}
export async function authenticate(request, env, fetcher = fetch) {
  const clean = stripIdentity(request);
  const url = new URL(clean.url);
  let path;
  try { path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/'; }
  catch { return {response:new Response('Invalid path', {status:400})}; }
  const login = path === '/auth/google' || path === '/signin-with-chatgpt';
  const callback = path === '/auth/google/callback';
  const logout = path === '/auth/logout' || path === '/signout-with-chatgpt';
  const protectedRoute = /^\/(workspace|api)(\/|$)/.test(path);
  if (!login && !callback && !logout && !protectedRoute) return {request:clean};
  if (url.origin !== ORIGIN) return {response:page('Address not supported', '<p>Please use the SupplyLens production address to sign in.</p>', 403)};
  if ((login || callback) && clean.method !== 'GET') return {response:new Response(null,{status:405,headers:{Allow:'GET'}})};
  const missing = [
    !env.DB?.prepare && 'DB (D1 database binding)',
    !env.GOOGLE_CLIENT_ID && 'GOOGLE_CLIENT_ID (runtime variable)',
    !env.GOOGLE_CLIENT_SECRET && 'GOOGLE_CLIENT_SECRET (runtime secret)',
  ].filter(Boolean);
  if (missing.length) return {response:page('Sign-in setup is incomplete', `<p>The running Worker cannot find:</p><ul>${missing.map(name => `<li>${name}</li>`).join('')}</ul><p>Open Workers &amp; Pages → supplylens → Settings → Variables and Secrets for credentials, or Bindings for DB. Build variables do not supply runtime secrets.</p><p><small>Configuration check v2</small></p>`,503)};
  try {
    const now = Math.floor(Date.now()/1000);
    if (login) {
      await initialize(env.DB);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM auth_flows WHERE expires <= ?').bind(now),
        env.DB.prepare('DELETE FROM auth_sessions WHERE expires <= ?').bind(now),
      ]);
      const state=random(), browser=random(), verifier=random(), nonce=random();
      await env.DB.prepare('INSERT INTO auth_flows (state_hash,browser_hash,verifier,nonce,return_to,expires) VALUES (?,?,?,?,?,?)').bind(await hash(state),await hash(browser),verifier,nonce,safeReturn(url.searchParams.get('return_to')),now+600).run();
      const target = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      target.search = new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:CALLBACK,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:await hash(verifier),code_challenge_method:'S256',prompt:'select_account'}).toString();
      return {response:redirect(target.href,[setCookie(FLOW,browser,600)])};
    }
    if (callback) {
      const state=url.searchParams.get('state'), browser=cookie(clean,FLOW);
      const fail = () => ({response:page('Sign-in could not be completed','<p>Your sign-in link expired, was cancelled, or could not be verified. Please try again.</p><a href="/auth/google">Try Google sign-in again</a>',400,[setCookie(FLOW,'',0)])});
      if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state) || !/^[A-Za-z0-9_-]{43}$/.test(browser)) return fail();
      // DELETE RETURNING consumes this browser-bound state exactly once, even on concurrent callbacks.
      const flow=await env.DB.prepare('DELETE FROM auth_flows WHERE state_hash=? AND browser_hash=? AND expires>? RETURNING verifier,nonce,return_to').bind(await hash(state),await hash(browser),now).first();
      if (!flow || url.searchParams.has('error') || !url.searchParams.get('code')) return fail();
      try {
        const tokens=await googleJSON('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:CALLBACK,code:url.searchParams.get('code'),code_verifier:flow.verifier,grant_type:'authorization_code'})},fetcher);
        const user=await verifyGoogleIDToken(tokens.id_token,env.GOOGLE_CLIENT_ID,flow.nonce,fetcher,now);
        const token=random();
        const old=cookie(clean,SESSION);
        if (old) await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await hash(old)).run();
        await env.DB.prepare('INSERT INTO auth_sessions (token_hash,owner,email,name,expires) VALUES (?,?,?,?,?)').bind(await hash(token),user.owner,user.email,user.name,now+SESSION_SECONDS).run();
        return {response:redirect(safeReturn(flow.return_to),[setCookie(FLOW,'',0),setCookie(SESSION,token,SESSION_SECONDS)])};
      } catch { return fail(); }
    }
    if (logout) {
      if (clean.method === 'GET') return {response:page('Sign out of SupplyLens?', '<form method="post" action="/auth/logout"><button type="submit">Sign out</button></form><p><a href="/workspace">Return to workspace</a></p>')};
      if (clean.method !== 'POST') return {response:new Response(null,{status:405,headers:{Allow:'GET, POST'}})};
      if (clean.headers.get('origin') !== ORIGIN) return {response:new Response('Invalid request origin',{status:403})};
      const token=cookie(clean,SESSION);
      if (token) await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await hash(token)).run();
      return {response:redirect('/',[setCookie(SESSION,'',0),setCookie(FLOW,'',0)])};
    }
    if (protectedRoute) {
      const token=cookie(clean,SESSION);
      const user=/^[A-Za-z0-9_-]{43}$/.test(token) ? await env.DB.prepare('SELECT owner,email,name FROM auth_sessions WHERE token_hash=? AND expires>?').bind(await hash(token),now).first() : null;
      if (!user) return {response:path.startsWith('/api') ? Response.json({error:'Please sign in to open your workspace.'},{status:401,headers:secureHeaders}) : redirect(`/auth/google?return_to=${encodeURIComponent(safeReturn(url.pathname+url.search))}`)};
      if (!['GET','HEAD','OPTIONS'].includes(clean.method) && clean.headers.get('origin') !== ORIGIN) return {response:new Response('Invalid request origin',{status:403,headers:secureHeaders})};
      const headers = new Headers(clean.headers);
      headers.set('oai-authenticated-user-id',user.owner);
      headers.set('oai-authenticated-user-email',user.email);
      headers.set('oai-authenticated-user-full-name',encodeURIComponent(user.name));
      headers.set('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');
      return {request:new Request(clean,{headers}),private:true};
    }
  } catch {
    // Do not log OAuth codes, identity tokens, secrets, or session cookies.
    return {response:page('Sign-in temporarily unavailable','<p>Please retry shortly. If this continues, the owner should check the D1 binding and Google credentials.</p><a href="/auth/google">Retry sign-in</a>',503)};
  }
  return {request:clean};
}
