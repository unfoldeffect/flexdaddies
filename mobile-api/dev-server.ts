// Runs the accounts server on this Mac for testing: no Cloudflare, no email.
// The sign-in code is returned to the app and shown on its screen.
// Usage: node dev-server.ts [port] [database file]
import { createServer } from 'node:http';

import { handle } from './src/handle.ts';
import { openLocalDb } from './src/local-db.ts';

const port = Number(process.argv[2] || 8787);
const env = { DB: openLocalDb(process.argv[3] || ':memory:'), DEV_SHOW_CODE: '1', CODE_PEPPER: 'dev-only' };

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const response = await handle(
    new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: hasBody ? Buffer.concat(chunks) : undefined,
    }),
    env,
  );
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, '0.0.0.0', () => console.log(`Flex Daddies test accounts server on port ${port}`));
