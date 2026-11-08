# Cloudflare Sites — by FreeX

A private, mobile-friendly gallery of your Cloudflare websites, shaped around the card layout of ChatGPT Sites. Created by **FreeX — Freedom, by design.** [miggy.com.au](https://miggy.com.au/).

**Status:** working independent dashboard and inventory collector. This repository does **not** add a native menu item to the ChatGPT iPhone app. A native **Cloudflare** item beside **Sites** requires OpenAI implementation. The proposed behaviour is documented in [the native-menu proposal](docs/native-menu-proposal.md).

## What it does

- Shows one card per Cloudflare Worker or Pages project, across accessible accounts.
- Discovers new services automatically on scheduled inventory syncs, with an optional hourly task in ChatGPT.
- Groups domain aliases on the same card; keeps Workers without custom domains visible with a management link.
- Offers All, Websites, Workers and Pages filters, search and sorting.
- Opens each website at its original Cloudflare-hosted address; the dashboard does not embed or proxy it.
- Keeps a last-sync timestamp, marks old inventory, and retains the previous inventory after a failed collection.
- Refreshes the stored inventory every minute while the gallery is visible. **Refresh** fetches the last stored result; it does not invoke Cloudflare directly.

The collector reads account, Workers, custom-domain and Pages inventory. It does not read Worker code, environment values, secrets, website visitor data or billing. A Worker with only a route or workers.dev address is retained with its Cloudflare management link; discovery of those URLs is not implemented in v0.1.

## Run

Node.js 22+; no dependencies, API key or installation step is required for builds and tests.

```bash
npm test
npm run build
```

`dist/server/index.js` is a single ES module Worker. For local UI preview, place a collected inventory at the ignored `.sites-runtime/inventory.json`, then run `npm run dev`. Preview storage is memory-only. Production inventory is stored in the Site's provisioned R2 bucket.

## Publish with ChatGPT Sites

Ask ChatGPT to deploy this project as an **owner-private** Site. It must register through Sites and preserve the exact returned project ID. Example hosting configuration after registration:

```json
{
  "project_id": "COPY_EXACT_RETURNED_SITE_ID",
  "d1": null,
  "r2": "INVENTORY"
}
```

Use the supported Sites source synchronization, build, save and private-deploy workflow. The placeholder is not an actual Site ID. The generated hosting file and every credential are excluded from this public source template. No undocumented ChatGPT API or iOS deep link is used.

After publishing, follow [the update workflow](docs/update-workflow.md) to populate inventory and attach an hourly sync. The collector runs through the authorised Cloudflare connection in the background task, then writes only the validated inventory to the private Site. Service access to the Site is separate from authorisation to read Cloudflare.

## Access and limits

Sites dispatch must protect **all routes**, including `/api/inventory`. This implementation is for an owner-private Site only. Do not publish it publicly or add untrusted viewers without implementing separate writer authorisation. The app's update endpoint intentionally trusts that private hosting boundary and is not a public API.

The gallery is available as a Site, rather than a separate native ChatGPT navigation item. Exact iPhone placement and external-link opening behaviour are controlled by ChatGPT and iOS and require device verification. Automatic discovery is hourly, not instant. Running the dashboard alone does not start a task.

Cloudflare permission failures, revoked connections or paused tasks can delay updates. Each collection is all-or-nothing; incomplete inventory is not written. Concurrent updater runs should be serialised. Last-sync timestamps reflect inventory reads, not website uptime checks. Preview panels are decorative service covers, not screenshots or uptime assertions.

## Official references

- [ChatGPT Sites](https://learn.chatgpt.com/docs/sites)
- [Manage a Site](https://learn.chatgpt.com/docs/sites/managing-a-site)
- [Cloudflare Workers API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/list/)
- [Cloudflare Pages API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/list/)

## Credit

Concept, product direction and commissioning: **FreeX**, founded by Miguel Valencia. Implementation prepared with Codex. Independent project; no affiliation with or endorsement by OpenAI or Cloudflare is implied. Product names remain their owners' trademarks.

MIT licence, copyright © 2026 FreeX. Preserve the licence notice when redistributing the code.
