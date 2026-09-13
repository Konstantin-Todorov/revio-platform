# Revio documentation preview

Isolated, dependency-free documentation preview requested by the founder. It has no API calls, credentials, analytics, or customer data. Content is a broad architecture-based draft, not a complete operating manual or public API contract.

Run `python3 -m http.server 3010 --bind 127.0.0.1 --directory design/docs-preview` from the repo root, then open http://localhost:3010.

Sidebar articles, search (Cmd/Ctrl+K), keyboard navigation, in-page contents, light/dark theme, and mobile menu are functional. Native browser Back works for article navigation. Styling draws on the three-column documentation pattern at https://docs.1club.ai/api-reference/introduction, with original Revio content and styling.

September 12 follow-up: dark is the default; explicit theme choice is stored locally. Supplied Revio artwork is used unchanged (CSS clips transparent padding). Navigation and product cards use consistent SVG icons. Text and navigation have been enlarged. Proposed information architecture: common getting-started/concepts articles plus product-specific task guides, shared integrations/API section, and troubleshooting/updates. This proposal is not a claim that a full documentation library is complete.

The current preview is deployed as a separate Railway `docs` service and is publicly available at https://docs.reviosoft.app. The Railway-provided URL https://docs-production-b1ad.up.railway.app remains useful for diagnostics; the custom domain has verified DNS and TLS, and the marketing site links to the custom domain.

After design approval, port the shell and content to a separate Next.js `apps/docs` service with versioned MDX, content review, and its own Railway domain. Do not publish internal operator instructions, WORK-LOG, secrets, or security runbooks. Do not treat draft integration examples as shipped API endpoints. No customer UI theme changes are in scope.

## Product collections — September 12

Top navigation now chooses Start here, Platform, Link, CRS, PMS, Direct, Integrations, API reference or Updates; the sidebar follows that collection and groups articles by workflow. The preview now contains a broad set of source-labelled guides across dashboards, companies and properties, accounts, reservations, payments, billing, analytics, operations, distribution, direct booking and integrations. These are NOT a complete manual. Sync Center and housekeeping labels were checked against the source at platform commit 83a3477; UI verification is still required before publication. The other conceptual/task drafts are explicitly pending content review.

The readability pass uses larger body, heading, navigation and in-page contents type while keeping the three-column proportions. Each article exposes a status badge near its title and a “Read next” path, so the preview reads like a maintained product rather than a single landing page.

Sources checked read-only: apps/channel-manager/app/(protected)/sync/page.tsx (Activity, Errors, Audit Log, channel limitations); apps/pms/app/(protected)/housekeeping/page.tsx (Smart order, By floor, room/occupancy indicators). Mapping and inventory boundaries come from root CLAUDE.md and AGENTS.md; detailed workflows need current UI verification with the hotel-test fixes. No internal documentation is copied automatically to the public bundle.

The complete planned collection hierarchy and publication checklist live in docs/DOCUMENTATION-PLAN.md. Operator content stays outside the public bundle. Keep the current `noindex` JavaScript preview labelled as a preview until content, accessibility and UI verification are signed off.
