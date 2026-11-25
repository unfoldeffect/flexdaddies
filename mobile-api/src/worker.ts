// Cloudflare Workers entry point.
import { handle, type Env } from './handle.ts';

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
};
