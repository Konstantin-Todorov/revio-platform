# Revio documentation — agreed direction, 12 September 2026

## Boundary

The founder approved the dark documentation design. Improve its structure and content, not customer-product navigation. The current static preview remains isolated in `design/docs-preview/` and is published through a separate Railway `docs` service; it is not part of any customer app deployment. Marketing release is independent in sibling `revio-websites`. Never deploy the entire platform just to publish documentation.

## Navigation

Top navigation: **Start here · Platform · RevioLink · RevioCRS · RevioPMS · RevioDirect · Integrations · API reference · Updates**. Each product changes the left-hand guide list, grouped by workflow (for example Calendar, Connections and Troubleshooting). The right column follows headings of the current article. Search spans products and shows the product/category. Shared concepts are written once and linked from each product; do not duplicate four conflicting versions.

| Area | Left navigation, in reading order | Boundary |
| --- | --- | --- |
| Start here | Product overview; shared concepts; access and roles; setup checklist; get help | Common hotel-facing concepts |
| Platform | Dashboard; companies and properties; lists/search; accounts and permissions; billing; payments; analytics; activity/events; settings and security | Cross-product customer workspace; operator procedures remain private |
| RevioLink | Overview; room/rate mapping; calendar and bulk edits; restrictions; Sync Center; troubleshooting | State channel capabilities and external delivery limitations |
| RevioCRS | Overview; availability and holds; reservations and changes; guests; rates; analytics and exports; Direct setup | Report basis and time period must be explicit |
| RevioPMS | Overview; arrivals and departures; room assignment; housekeeping; folios and charges; maintenance; Close Day | Posting, recording a payment and collecting money are different actions |
| RevioDirect | Overview; hotel branding and room content; guest booking journey; sold-out alternatives; confirmation and policies | Configured through CRS; do not advertise unsupported payment methods |
| Integrations | Supported vs proposed connections; ownership of data; mapping; import/export; API availability | No invented endpoints, keys, scopes, webhook guarantees or public API promises |
| Updates | Documentation changes; product release notes approved for customers | No automatic publication of internal work logs |

**Operator** documentation is a separate internal collection with authenticated access. Hiding an “Operator” tab in JavaScript is not access control. Keep operator articles and content out of the public bundle entirely.

## What the OneClub reference gets right

The reference is not just “a lot of pages.” It connects a domain landing page, its sub-pages, a quick-start path, related articles, search and previous/next links. Revio should use the same relationship model while keeping hotel terminology and our product boundaries:

| OneClub pattern | Revio equivalent | Documentation home |
| --- | --- | --- |
| Dashboard and widgets | Hotel dashboard, exceptions and product health | Platform |
| Members and member profiles | Guests, reservations and company/property context | RevioCRS + Platform |
| Operations, schedule, bookings and events | Front desk, housekeeping, maintenance, close day and channel activity | RevioPMS + RevioLink |
| Billing, invoices, transactions and payments | Subscription billing, guest folios, payment status and reconciliation | Platform + RevioPMS |
| Marketing, messaging and content | Direct booking content, approved hotel media, templates and support | RevioDirect + Start here |
| Analytics and exports | Occupancy, pickup, revenue, channel and operational reports | Platform + RevioCRS |
| Settings, users and integrations | Property setup, roles, notifications, security, imports, exports and connectors | Platform + Integrations |

Each landing page should answer **what this area is**, **who uses it**, **what records it owns**, **what it connects to**, and **where to go next**. Each task page should then use the same small contract: prerequisites → steps → expected result → recovery → related links. This is how a larger library remains understandable instead of becoming a long list of disconnected articles.

## Article format

1. What task this helps you complete.
2. Product, property context, prerequisites and permissions.
3. Short steps using labels verified in the current UI.
4. Expected result and how to verify it.
5. Common errors, safe recovery and when to contact support.
6. Related articles.
7. Review record: source files/commit, verification date, reviewer and content status.

Statuses: **Draft → Code checked → UI verified → Published**. “Code checked” is not a claim of live testing. Product feature availability must not be inferred from the documentation status. Use synthetic examples; redact guest, property, payment and credential data. Screenshots require approval and must match the article.

## Sequence

| Priority | Deliverable | Done when |
| --- | --- | --- |
| P0 | Ship approved marketing site, remove stock photo, add help entry point | CI and promotion pass; public pages verified |
| P1 | Product tabs, scoped sidebar, working cross-product search in approved docs design | Desktop/mobile/keyboard navigation verified |
| P1 | Initial shared + product guide drafts | Source-labelled, no invented controls or production claims |
| P1 | Validate real-hotel workflows with Claude's fixes | UI steps agree with current code and observed behavior |
| P2 | Separate versioned docs service, real article URLs and content files | Build, links, accessibility, search and review gate pass independently |
| P2 | Publish on docs.reviosoft.app and link marketing navigation | Live on the isolated Railway service; custom-domain DNS/TLS and the marketing link are verified; no internal content in output |
| P3 | Approved API reference and richer imports/exports guide | Actual implemented public contract and supported integrations verified |
| P3 | Customer photos, case studies and approved release notes | Hotel consent + accurate claims; no stock customer substitutes |

Keep the approved design; the current dependency-free preview is not the final production docs engine. The earlier Next.js/MDX separate-service proposal remains the starting point, subject to confirming maintenance and deployment boundaries. No new framework is added to the platform during real-hotel bug testing.

## Coordination

Codex owns marketing/help entry point and isolated documentation drafts. Claude owns ongoing real-hotel bug fixes. Every customer-visible change should identify affected docs topics; draft articles must be reviewed against newer commits before publication. Founder/partner decides the feature roadmap after hotel bugs are resolved. Documentation is not permission to implement postponed features.

Remaining content needed from founder/hotel: approved hotel photos, permission to identify customers, actual workflow screenshots with guest data concealed. Decisions for discussion: first publication scope and who signs off operational guides. No invented testimonials, response-time commitments or public API status.
