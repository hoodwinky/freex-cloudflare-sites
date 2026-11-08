# Proposal: a native Cloudflare menu in ChatGPT

Proposed by FreeX, 9 November 2026 (Sydney).

## User outcome

On iPhone, select **Cloudflare** in ChatGPT navigation, alongside **Sites**, and see every connected Cloudflare website as its own card. New websites appear automatically without manual link entry.

## Native experience requested

Use the same gallery, search, sorting, preview proportions, accessibility and mobile navigation patterns as Sites. Each card shows a website name, origin, resource type and last inventory update. Selecting a card opens its verified origin using the app's supported browser experience. Management actions open Cloudflare with the user's existing account permissions.

The menu should reflect the active ChatGPT account's Cloudflare connection. Users choose which Cloudflare accounts to include. Group aliases belonging to the same deployment, distinguish production/development resources and retain all services in an accessible All view. Workers without a known public origin should offer management rather than an invented website URL.

## Discovery contract

List accessible accounts, Workers, custom domains, routes, verified enabled workers.dev origins, and Pages projects with full pagination. Treat provider change events as an optional future improvement only after Cloudflare and OpenAI expose a documented supported event path. Otherwise refresh on navigation and at a bounded interval, expose sync state and retain stale content after partial errors.

Do not store raw provider tokens in mobile storage or website assets. Use the connected plugin's approved access and enforce authorisation server-side. Private and access-controlled sites remain access-controlled; a card is not a grant to enter them. Preview rendering must not leak authenticated content or become an arbitrary URL fetch proxy.

## Acceptance criteria

1. Connecting Cloudflare makes its native menu available without moving hosting or changing DNS.
2. A newly created Worker or Pages project appears after the next successful inventory refresh.
3. A resource with multiple aliases has one card; separate deployments have separate cards.
4. Pagination returns all resources. Incomplete refreshes are visible and do not delete the previous complete inventory.
5. Revoking a connection removes future provider access. Account switching never exposes another user's inventory.
6. Search, filters, VoiceOver labels, touch targets and reduced motion work on iPhone.
7. Cloudflare cards and ChatGPT-hosted Sites remain clearly labelled by origin/provider.

## Implementation boundary

This repository implements the gallery, discovery and private stored-inventory workflow. It does not contain or patch ChatGPT iOS source, publish an iOS extension, register arbitrary websites in a native list, provide a native navigation hook, or submit this proposal to OpenAI. Native-menu integration remains a product request requiring OpenAI support.
