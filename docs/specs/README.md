# docs/specs — the V2 founder specifications (2026-07-09)

Authoritative specs for the platform-wide V2 overhaul. Each product guide splits every screen
into **Keep** (correct today — binding, must survive any refactor) and **Change** (specific edits).
The phased task list built from these lives in the session task tracker; the phase order is
**A (foundations) → B (RevioLink) → C (RevioCRS) → D/E (RevioPMS) → F (assignment + gateway/compliance seams)**.

| File | What it governs |
| --- | --- |
| [HIERARCHY.md](HIERARCHY.md) | How the products relate: CRS central above properties, PMS per-property, RevioLink behind an API boundary; write ownership; the never-sync rule; standalone-vs-integrated addendum. Read first. |
| [CM-GUIDE-V2.md](CM-GUIDE-V2.md) | RevioLink interface & navigation guide (v2): boundary rule, nav regroup, screen-by-screen Keep/Change, the four cross-cutting fixes (push attribution, capability map, pending age, reservation scope + ack). |
| [CM-UPDATES-V1.md](CM-UPDATES-V1.md) | RevioLink founder updates (raw list): calendar paging/filters/rooms-sold, bulk+restrictions merge, rate-plan min/max stay + advance purchase, Rate Plan Linkage, currency on property, mapping split with OTA-pulled products, reservation filters, Sync Center merge, settings emails/notifications. |
| [CRS-GUIDE-V1.md](CRS-GUIDE-V1.md) | RevioCRS guide (v1): standalone-vs-integrated, one-record rule, **two-tier precedence model** (replaces 4-level), nav regroup + Rates & Restrictions dissolution, Analytics, Rooms & Rates + Bulk tabs, Distribution CM-switching, group scope, STLY-364 YoY, city-tax three-product flow. |
| [PMS-GUIDE-V1.md](PMS-GUIDE-V1.md) | RevioPMS guide (v1): nav regroup, Reservation view, Guests, housekeeping rules (in-progress, one-room rule, inspection gate), **charge-posting service** (required architecture), split folios, deposits held/applied, invoicing module + jurisdiction packs, payment-gateway + fiscalization boundaries (Bulgaria N-18 = launch blocker). |
| [BOOKING-ENGINE-ADDENDUM.md](BOOKING-ENGINE-ADDENDUM.md) | Booking engine = a CRS Distribution surface, build **deferred**; the three design-for-now seams (public search/create API, source=Direct, direct-channel flag) are mandatory now. |
| [BG-FISCALIZATION-RESEARCH.md](BG-FISCALIZATION-RESEARCH.md) | Bulgaria fiscalization (Ordinance N-18 / NRA real-time) + e-invoicing (EN 16931 / SAF-T / ViDA) research for the F3 boundary; route through a certified provider, gate by jurisdiction pack. |

## Refinement round — founder docs 2026-07-20 (post-V2, not yet built)

A follow-up refinement pass on the shipped V2, **one doc per system** (CM / CRS / PMS). ⚠ The
`Revio Development Docs.docx` file's title reads "RevioCRS" but that's a **typo — it's the RevioLink/CM
doc** (founder-confirmed; corrected file being re-sent). CM + CRS **share** the Calendar / Bulk / Rooms &
Rates changes — build them **once as shared components, reused across both**. Phased task list (phases **G**
RevioLink, **H** RevioCRS, **J** RevioPMS) created on founder sign-off. **Two founder items still pending:**
the PMS **§11 Close Day** section ("will add later today") and the re-sent corrected RevioLink file.

| File | What it governs |
| --- | --- |
| [CM-REFINEMENT-R1.md](CM-REFINEMENT-R1.md) | RevioLink/CM Refinement R1 (the mis-titled doc): Dashboard Reservation-Summary card (by action date); Calendar bulk-in-modal-over-calendar + remove derived filter + paperclip + hide search; Bulk multi-field editor + confirm-then-result modal + rename "Restriction Rules"→"Your active restriction rules"; Rooms & Rates vertical restack + **editable Rate Plan Linkage**. Calendar/Bulk/Rooms&Rates are **shared with CRS**. |
| [CRS-REFINEMENT-R2.md](CRS-REFINEMENT-R2.md) | RevioCRS Refinement R2: Dashboard YoY/LW toggle + basis labels; **Analytics full redesign** (summary cards + evolution bar charts + performance-by-room-type); Reservations 3-click sort; Guests Notes tab; Inventory Calendar RevioLink-alignment (bulk-in-modal, remove derived filter, paperclip, hide search); **editable Rate Plan Linkage**; Bulk multi-field editor + confirm-then-result modal; Settings low-availability alert + staff CRUD on the shared identity. Says "match RevioLink." |
| [PMS-REFINEMENT-R1.md](PMS-REFINEMENT-R1.md) | RevioPMS page-by-page refinement (10 screens + Configuration + Staff & Access, Close Day §11 pending): Front Desk exception strip / overdue / extend-checkout; Reservation action hub; Guests identity-merge + n≥2 guard + GDPR; Folios Open/History split + mandatory-deposit gate; Extras & Charges rename + catalog; Housekeeping role-scoped views + pipeline + clock-in + analytics; Rooms beds/floor-object/bulk; Maintenance OOO↔revenue loop; Configuration expansion; Staff & Access workforce roster. ⚠ Written against a pre-E7 snapshot ("Configuration not built" is stale). |

Assets: `assets/hierarchy-diagram.png` (layering diagram), `assets/pms-nav-proposed.png` (PMS nav before/after).
