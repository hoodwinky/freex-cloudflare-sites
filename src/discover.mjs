// Copyright (c) 2026 FreeX. MIT License.
// This self-contained function also runs inside the connected Cloudflare tool.
// Pass its cloudflare.request function; no provider credential is ever exported.
export async function discoverSites(request) {
  async function list(path, perPage = 50) {
    const output = [];
    for (let page = 1; page <= 100; page++) {
      const response = await request({ method: 'GET', path, query: { page, per_page: perPage } });
      if (response.success !== true || !Array.isArray(response.result)) throw new Error('Cloudflare inventory read failed');
      output.push(...response.result);
      const pages = response.result_info?.total_pages;
      if (pages != null ? page >= pages : response.result.length < perPage) return output;
    }
    throw new Error('Inventory pagination limit reached; retain the last complete inventory');
  }
  async function get(path) {
    const response = await request({ method: 'GET', path });
    if (response.success !== true) throw new Error('Cloudflare inventory read failed');
    return response.result;
  }
  const accounts = await list('/accounts');
  const sites = [];
  for (const account of accounts) {
    const id = encodeURIComponent(account.id);
    const [workers, domains, pages] = await Promise.all([
      get(`/accounts/${id}/workers/scripts`),
      get(`/accounts/${id}/workers/domains`),
      list(`/accounts/${id}/pages/projects`, 10)
    ]);
    if (!Array.isArray(workers) || !Array.isArray(domains)) throw new Error('Invalid Cloudflare inventory');
    for (const worker of workers) {
      const customDomains = domains.filter(d => d.service === worker.id && d.enabled !== false).map(d => d.hostname).sort();
      sites.push({
        id: `${account.id}:worker:${worker.id}`, accountId: account.id,
        name: worker.id, type: 'Worker', domains: customDomains,
        url: customDomains.length ? `https://${customDomains[0]}/` : null,
        dashboardUrl: `https://dash.cloudflare.com/${id}/workers/services/view/${encodeURIComponent(worker.id)}/production`,
        modifiedAt: worker.modified_on || null
      });
    }
    for (const project of pages) {
      const domains = [...new Set([...(project.domains || []), ...(project.subdomain ? [project.subdomain] : [])])].sort();
      const custom = domains.find(d => !d.endsWith('.pages.dev'));
      sites.push({
        id: `${account.id}:pages:${project.name}`, accountId: account.id,
        name: project.name, type: 'Pages', domains,
        url: domains.length ? `https://${custom || domains[0]}/` : null,
        dashboardUrl: `https://dash.cloudflare.com/${id}/pages/view/${encodeURIComponent(project.name)}`,
        modifiedAt: project.latest_deployment?.modified_on || project.created_on || null
      });
    }
  }
  sites.sort((a, b) => Number(Boolean(b.url)) - Number(Boolean(a.url)) || a.name.localeCompare(b.name));
  return { schemaVersion: 1, syncedAt: new Date().toISOString(), syncCadence: null, sites };
}
