import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import worker from '../worker/index.mjs';
const initial = await readFile('.sites-runtime/inventory.json', 'utf8').catch(() => null);
let data = initial;
const env = { INVENTORY: { get: async () => data ? { json: async () => JSON.parse(data) } : null, put: async (key, value) => { data = value; return {}; } } };
createServer(async (req, res) => {
  try {
    const origin = 'http://' + req.headers.host;
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const request = new Request(new URL(req.url, origin), { method: req.method, headers: req.headers, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) });
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Preview failed'); }
}).listen(Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : process.env.PORT || 3000), '0.0.0.0');
