import handler from './index.js';
import {authenticate} from './cloudflare-auth.mjs';
export default {
  async fetch(request, env, ctx) {
    const result = await authenticate(request, env);
    if (result.response) return result.response;
    const response = await handler.fetch(result.request, env, ctx);
    if (!result.private) return response;
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'private, no-store');
    headers.append('Vary', 'Cookie');
    return new Response(response.body, {status:response.status, statusText:response.statusText, headers});
  },
};
