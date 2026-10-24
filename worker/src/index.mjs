import {loadConfig} from './config.mjs';
import {createHandler} from './handler.mjs';
import {d1Store} from './store.mjs';

let cached;
export default {
  async fetch(request, env) {
    // Build once per isolate so the in-memory registration limiter persists between requests.
    if (!cached || cached.env !== env) {
      const store = d1Store(env.DB);
      cached = {env, ready:store.ensureSchema(), handle:createHandler(loadConfig(env), {store})};
    }
    try { await cached.ready; } catch {
      cached = null;
      return new Response(JSON.stringify({error:'SERVER_ERROR'}), {status:500, headers:{'Content-Type':'application/json'}});
    }
    // cf-connecting-ip is used only by the in-memory limiter and is never stored.
    return cached.handle(request, request.headers.get('cf-connecting-ip') ?? 'unknown');
  },
};
