// Temporary boundary for the independently hosted migration. Sites identity
// headers are trusted only behind the Sites host, never on a public Worker.
export function prepareRequest(request) {
  const headers = new Headers(request.headers);
  for (const key of [...headers.keys()]) {
    if (key.startsWith('oai-authenticated-user-')) headers.delete(key);
  }
  return new Request(request, {headers});
}

export function setupResponse(request) {
  let path;
  try {path = decodeURIComponent(new URL(request.url).pathname).replace(/\/+$/, '') || '/';}
  catch {return new Response('Invalid path', {status: 400});}
  if (!/^\/(workspace|api|signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(path)) return null;
  const headers = {'Cache-Control': 'no-store', 'Retry-After': '3600'};
  if (/^\/api(\/|$)/.test(path)) return Response.json({error: 'Workspace setup is in progress. Google sign-in is not yet available.'}, {status: 503, headers});
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Workspace setup | SupplyLens</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101c18;color:#f1f6f2;font:17px/1.7 system-ui}main{max-width:540px;padding:32px}small{color:#d2ff00;letter-spacing:.14em}h1{font-size:42px;line-height:1.15}p{color:#bccdc2}a{display:inline-block;margin-top:20px;padding:12px 22px;background:#d2ff00;color:#132013;text-decoration:none;border-radius:30px}</style></head><body><main><small>SUPPLYLENS</small><h1>Your new workspace is on its way.</h1><p>We're setting up Google sign-in and secure workspace storage on this address. The public website is ready to explore.</p><a href="/">Back to the homepage →</a></main></body></html>`, {status: 503, headers: {...headers, 'Content-Type': 'text/html; charset=utf-8'}});
}
