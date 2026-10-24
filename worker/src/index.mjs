import {loadConfig} from './config.mjs';
import {createHandler} from './handler.mjs';
import {d1Store} from './store.mjs';

let cached;
export default {
  async fetch(request, env) {
    // Build once per isolate so the in-memory registration limiter persists between requests.
    if (!cached || cached.env !== env) cached = {env, handle:createHandler(loadConfig(env), {store:d1Store(env.DB)})};
    // cf-connecting-ip is used only by the in-memory limiter and is never stored.
    return cached.handle(request, request.headers.get('cf-connecting-ip') ?? 'unknown');
  },
};
