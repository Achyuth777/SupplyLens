import handler from './index.js';
import {prepareRequest, setupResponse} from './cloudflare-access.mjs';
export default {
  fetch(request, env, ctx) {
    const clean = prepareRequest(request);
    return setupResponse(clean) ?? handler.fetch(clean, env, ctx);
  },
};
