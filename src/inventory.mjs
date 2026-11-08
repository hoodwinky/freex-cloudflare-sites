// Copyright (c) 2026 FreeX. MIT License.
export function validateInventory(value) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.sites) || value.sites.length > 10000) throw new Error('Invalid inventory');
  if (typeof value.syncedAt !== 'string' || !Number.isFinite(Date.parse(value.syncedAt)) || Date.parse(value.syncedAt) > Date.now() + 300000) throw new Error('Invalid sync timestamp');
  if (value.syncCadence !== null && value.syncCadence !== 'hourly') throw new Error('Invalid sync cadence');
  const string = (v, max = 300) => { if (typeof v !== 'string' || !v.trim() || v.length > max || /[\u0000-\u001f]/.test(v)) throw new Error('Invalid inventory text'); return v; };
  function domain(value) {
    string(value, 253);
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value)) throw new Error('Invalid domain');
    return value;
  }
  const seen = new Set();
  const sites = value.sites.map(site => {
    if (!site || typeof site !== 'object') throw new Error('Invalid site');
    const id = string(site.id, 500);
    if (seen.has(id)) throw new Error('Duplicate site');
    seen.add(id);
    const accountId = string(site.accountId, 32);
    if (!/^[a-f0-9]{32}$/.test(accountId)) throw new Error('Invalid account ID');
    const name = string(site.name);
    if (site.type !== 'Worker' && site.type !== 'Pages') throw new Error('Invalid site type');
    if (!Array.isArray(site.domains) || site.domains.length > 1000) throw new Error('Invalid domains');
    const domains = [...new Set(site.domains.map(domain))];
    let url = null;
    if (site.url !== null) {
      const parsed = new URL(site.url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash || parsed.pathname !== '/' || !domains.includes(parsed.hostname)) throw new Error('Website URL does not match its domain');
      url = parsed.href;
    }
    const dashboard = new URL(site.dashboardUrl);
    const expectedPath = site.type === 'Worker'
      ? `/${accountId}/workers/services/view/${encodeURIComponent(name)}/production`
      : `/${accountId}/pages/view/${encodeURIComponent(name)}`;
    if (dashboard.origin !== 'https://dash.cloudflare.com' || dashboard.pathname !== expectedPath || dashboard.search || dashboard.hash || dashboard.username || dashboard.password) throw new Error('Invalid dashboard URL');
    if (site.modifiedAt !== null && (typeof site.modifiedAt !== 'string' || !Number.isFinite(Date.parse(site.modifiedAt)))) throw new Error('Invalid modification timestamp');
    return { id, accountId, name, type: site.type, domains, url, dashboardUrl: dashboard.href, modifiedAt: site.modifiedAt };
  });
  return { schemaVersion: 1, syncedAt: value.syncedAt, syncCadence: value.syncCadence, sites };
}

export async function saveInventory(bucket, inventory) {
  const valid = validateInventory(inventory);
  const existing = await bucket.get('inventory.json');
  if (existing) {
    const prior = await existing.json();
    if (Date.parse(prior.syncedAt) > Date.parse(valid.syncedAt)) throw new Error('A newer inventory is already stored');
  }
  await bucket.put('inventory.json', JSON.stringify(valid), { httpMetadata: { contentType: 'application/json' } });
  return { syncedAt: valid.syncedAt, count: valid.sites.length };
}
