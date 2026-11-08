import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverSites } from '../src/discover.mjs';
import { validateInventory } from '../src/inventory.mjs';
import worker from '../worker/index.mjs';

const accountId = 'a'.repeat(32);
const sample = () => ({ schemaVersion: 1, syncedAt: new Date().toISOString(), syncCadence: null, sites: [{
  id: accountId + ':worker:example', accountId, name: 'example', type: 'Worker', domains: ['example.com'],
  url: 'https://example.com/', dashboardUrl: `https://dash.cloudflare.com/${accountId}/workers/services/view/example/production`, modifiedAt: null
}] });
function bucket() { let data; return { get: async () => data ? { json: async () => JSON.parse(data) } : null, put: async (key, value) => { data = value; return {}; } }; }
const post = data => new Request('https://gallery.example/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

test('discovers all account and Pages pages, groups aliases, retains Workers without domains', async () => {
  const calls = [];
  const result = await discoverSites(async options => {
    calls.push(options);
    let result;
    if (options.path === '/accounts') return { success: true, result: [{ id: accountId }], result_info: { total_pages: 1 } };
    if (options.path.endsWith('/workers/scripts')) result = [{ id: 'example' }, { id: 'no-domain' }];
    else if (options.path.endsWith('/workers/domains')) result = [{ service: 'example', hostname: 'example.com', enabled: true }, { service: 'example', hostname: 'www.example.com', enabled: true }, { service: 'no-domain', hostname: 'disabled.example.com', enabled: false }];
    else if (options.path.endsWith('/pages/projects')) return { success: true, result: options.query.page === 1 ? Array.from({ length: 10 }, (_, i) => ({ name: 'site-' + i, domains: ['p' + i + '.pages.dev'] })) : [{ name: 'eleventh', domains: ['eleventh.example.com', 'eleventh.pages.dev'] }] };
    else throw new Error('Unexpected request');
    return { success: true, result };
  });
  assert.equal(result.sites.length, 13);
  assert.equal(result.sites.find(s => s.name === 'example').domains.length, 2);
  assert.equal(result.sites.find(s => s.name === 'no-domain').url, null);
  assert.equal(result.sites.find(s => s.name === 'eleventh').url, 'https://eleventh.example.com/');
  assert.equal(calls.filter(c => c.path.endsWith('/pages/projects')).length, 2);
  assert.equal(validateInventory(result).sites.length, 13);
});

test('fails a partial collection instead of silently deleting inaccessible sites', async () => {
  await assert.rejects(discoverSites(async options => {
    if (options.path === '/accounts') return { success: true, result: [{ id: accountId }] };
    throw new Error('Permission denied');
  }), /Permission denied/);
});

test('rejects credential URLs, unlisted domains, duplicate IDs and forged dashboard links', () => {
  for (const change of [
    s => { s.url = 'https://user:secret@example.com/'; },
    s => { s.url = 'https://attacker.example/'; },
    s => { s.dashboardUrl = 'https://dash.cloudflare.com.attacker.example/'; },
    s => { s.domains = ['example.com\" onclick=\"alert(1)']; }
  ]) { const input = sample(); change(input.sites[0]); assert.throws(() => validateInventory(input)); }
  const duplicate = sample(); duplicate.sites.push(duplicate.sites[0]); assert.throws(() => validateInventory(duplicate), /Duplicate/);
});

test('persists an inventory and reads it back through the Worker API', async () => {
  const env = { INVENTORY: bucket() };
  const saved = await worker.fetch(post(sample()), env);
  assert.equal(saved.status, 200);
  const loaded = await worker.fetch(new Request('https://gallery.example/api/inventory'), env);
  assert.equal(loaded.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await loaded.json()).sites[0].name, 'example');
});

test('rejects cross-origin writes and preserves data after invalid or stale writes', async () => {
  const env = { INVENTORY: bucket() }; const first = sample(); await worker.fetch(post(first), env);
  const crossOrigin = post(sample()); crossOrigin.headers.set('Origin', 'https://attacker.example');
  assert.equal((await worker.fetch(crossOrigin, env)).status, 403);
  assert.equal((await worker.fetch(post({ sites: [] }), env)).status, 400);
  const older = sample(); older.syncedAt = '2020-01-01T00:00:00Z';
  assert.equal((await worker.fetch(post(older), env)).status, 400);
  const loaded = await worker.fetch(new Request('https://gallery.example/api/inventory'), env);
  assert.equal((await loaded.json()).syncedAt, first.syncedAt);
});

test('reports missing sync and rejects oversized bodies', async () => {
  const env = { INVENTORY: bucket() };
  assert.equal((await worker.fetch(new Request('https://gallery.example/api/inventory'), env)).status, 503);
  const huge = new Request('https://gallery.example/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(4_000_001) });
  assert.equal((await worker.fetch(huge, env)).status, 413);
});

test('serves a script-restricted shell without exposing inventory in its HTML', async () => {
  const response = await worker.fetch(new Request('https://gallery.example/'), {});
  assert.match(response.headers.get('Content-Security-Policy'), /script-src 'self'/);
  const body = await response.text();
  assert.match(body, /Cloudflare/); assert.doesNotMatch(body, new RegExp(accountId));
});
