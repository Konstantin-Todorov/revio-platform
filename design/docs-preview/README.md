# Revio documentation design preview

Isolated, dependency-free design prototype requested by the founder. Not a production documentation service. No API calls, credentials, analytics, or customer data. Content is a small architecture-based sample, not a complete operating manual or public API contract.

Run `python3 -m http.server 3010 --bind 127.0.0.1 --directory design/docs-preview` from the repo root, then open http://localhost:3010.

Sidebar articles, search (Cmd/Ctrl+K), keyboard navigation, in-page contents, light/dark theme, and mobile menu are functional. Native browser Back works for article navigation. Styling draws on the three-column documentation pattern at https://docs.1club.ai/api-reference/introduction, with original Revio content and styling.

September 12 follow-up: dark is the default; explicit theme choice is stored locally. Supplied Revio artwork is used unchanged (CSS clips transparent padding). Navigation and product cards use consistent SVG icons. Text and navigation have been enlarged. Proposed information architecture: common getting-started/concepts articles plus product-specific task guides, shared integrations/API section, and troubleshooting/updates. This proposal is not a claim that a full documentation library is complete.

After design approval, port the shell and content to a separate Next.js `apps/docs` service with versioned MDX, content review, and its own Railway domain. Do not publish internal operator instructions, WORK-LOG, secrets, or security runbooks. Do not treat draft integration examples as shipped API endpoints. No customer UI theme changes are in scope.
