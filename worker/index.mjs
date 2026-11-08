// Copyright (c) 2026 FreeX. MIT License.
// Deploy owner-private through Sites. Dispatch protects every route, including
// service writes. Do not make this Site public without adding writer auth.
import { validateInventory, saveInventory } from '../src/inventory.mjs';
import { html, css, client } from '../src/ui.mjs';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/inventory' && request.method === 'GET') {
      if (!env.INVENTORY) return json({ error: 'Inventory storage is unavailable' }, 503);
      const object = await env.INVENTORY.get('inventory.json');
      if (!object) return json({ error: 'The first Cloudflare sync has not completed yet' }, 503);
      try { return json(validateInventory(await object.json())); }
      catch { return json({ error: 'Stored inventory could not be read' }, 503); }
    }
    if (url.pathname === '/api/inventory' && request.method === 'POST') {
      // Private Sites dispatch accepts a signed-in owner or service access.
      // An Origin header is required to match whenever a browser supplies one.
      if (request.headers.has('Origin') && request.headers.get('Origin') !== url.origin) return json({ error: 'Origin rejected' }, 403);
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Expected JSON' }, 415);
      if (!env.INVENTORY) return json({ error: 'Inventory storage is unavailable' }, 503);
      const declared = Number(request.headers.get('Content-Length'));
      if (declared > 4_000_000) return json({ error: 'Inventory is too large' }, 413);
      try {
        // Read with a byte limit even when Content-Length is absent or false.
        const reader = request.body?.getReader();
        if (!reader) return json({ error: 'Inventory is required' }, 400);
        const chunks = []; let total = 0;
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          total += part.value.byteLength;
          if (total > 4_000_000) { await reader.cancel(); return json({ error: 'Inventory is too large' }, 413); }
          chunks.push(part.value);
        }
        const body = new Uint8Array(total); let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
        const result = await saveInventory(env.INVENTORY, JSON.parse(new TextDecoder().decode(body)));
        return json({ status: 'success', ...result });
      } catch { return json({ error: 'Inventory was invalid or could not be stored; previous inventory retained' }, 400); }
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Method not allowed' }, 405);
    const files = { '/': [html, 'text/html; charset=utf-8'], '/style.css': [css, 'text/css; charset=utf-8'], '/app.js': [client, 'text/javascript; charset=utf-8'], '/robots.txt': ['User-agent: *\nDisallow: /\n', 'text/plain'] };
    const file = files[url.pathname];
    if (!file) return new Response('Not found', { status: 404, headers });
    return new Response(request.method === 'HEAD' ? null : file[0], { headers: { ...headers, 'Content-Type': file[1], 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; object-src 'none'" } });
  }
};
