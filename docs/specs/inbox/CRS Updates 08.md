# ***RevioCRS — Live-Product Refinement (running)***

*A refinement pass on the****live****CRS, screen by screen. Goal: keep the strong foundation, and push interface + efficiency + data visualisation to best-in-class. Same method as the PMS live-refinement doc — discuss each screen, lock it here, finalise at the end.*

*Bar for this pass:****every number answers a question the user is actually asking, and the visual is chosen to fit that question — not decoration.****Charts are used where they earn their place; sometimes a single big number is the right visual.*

## ***1. Dashboard***

***Who / what:****a revenue-minded owner/manager — "how are we doing, and what needs my attention," at a glance.*

***Verdict: ~80% best-in-class already.****The bones are excellent; the gap is that the two actual charts aren't pulling their weight. Keep almost everything; fix the two visuals.*

### ***1.1 Keep — already best-in-class (do not touch)***

***KPI row****— Occupancy / Rooms Sold / Rooms Available / Room Revenue / ADR / RevPAR / Cancellation / Pickup. Right metric set, YoY comparison chips on them, and the definition-under-the-number touch ("revenue ÷ rooms sold," "physical − OOO − closed," "the #1 hotel KPI") teaches while it informs.*

***Date-range control****— Today / Tomorrow / L7D / L28D / YTD / N7D / N28D + custom range +****Compared with: Last year / Last week.****Best-in-class; leave it.*

***Forecast — "the same data read forward"****with the honest disclaimer ("Expected values from confirmed bookings — not a prediction model"). Correct integrity; keep.*

***Action Center****with its calm empty state ("Nothing needs attention — no overbookings, sell-outs or sync failures"). The exception-strip pattern done right.*

*Arrivals/Departures today, New & cancelled (last 24h), the footer stats line, Reports + Customize view.*

### ***1.2 Fix — "Occupancy & revenue by day" is an empty chart frame (biggest miss)***

*This is the dashboard's hero visual and on the default (Today) view it renders nothing — just "Pick a multi-day range to see the daily trend." A dashboard's hero trend must show the shape of the business****on load****, not after the user configures a range.*

***Render by default over a sensible window****(e.g. last 30 days); the date-range control then refines it. Never blank on load.*

***Dual-metric, dual-axis****(decided):****occupancy as a line (left axis, %)****+****revenue as bars (right axis, €)****. The two belong together — the gap between them is the insight (high occupancy + lagging revenue = over-discounting; rising revenue on flat occupancy = rate strategy working). A mode toggle would force flipping back and forth and kill that comparison, so****not****a toggle.*

***Both on by default; legend mutes either****— click "revenue" to isolate occupancy and vice-versa. Comparison is the default; focus is one click away.*

***[build note]****dual axis is mandatory (% vs € are different units); line-vs-bar also helps the eye separate them. Same-axis mismatched scales = unreadable — avoid.*

### ***1.3 Fix — "Source mix — revenue share" is bars-as-rows; wrong visual for the question***

*Source mix is a****composition****question ("where does my business come from, and what does each channel net me"), currently shown as two horizontal fill bars (Direct 81% / Booking Engine 19%). Weak, and it misses the Revio-specific win.*

***Make it a proper composition visual****— donut or stacked bar — showing****all****sources (Direct, Booking Engine, and each OTA as they come online), readable at a glance.*

***Pair each source with its cost of distribution (spec now, build may stage).****Don't just show where volume comes from — show****what each channel nets****after commission. Direct/Booking-Engine at ~0–2% vs OTA at 15–18% is Revio's strongest commercial story and no competitor in this tier shows it well. So each source row/segment carries: share of revenue****and****its distribution cost / net.*

***[build note]****the plain composition chart can ship first; the net-of-commission layer is additive on top. Keep the honest-estimate discipline (commission avoided is an estimate, paid is fact — consistent with the cost-of-distribution model elsewhere).*

### ***1.4 Layout hierarchy***

*Fixing §1.2 largely fixes this: today the big empty trend box occupies prime real estate while doing nothing, pushing real content below the fold. With the trend rendering real data and the source mix a proper chart, the three things that matter —****KPIs → hero trend → action center****— read top-down without hunting, and the page finally looks like an analytics product, not a KPI list.*

### ***1.5 Net***

*Bones, metrics, date logic, and integrity are already best-in-class. The whole leap from "solid" to "impressive" is concentrated in the****two chart components****(§1.2, §1.3). Fix those and the dashboard lands.*

## ***2. Analytics***

***Who / what:****the same revenue-minded owner/manager, one level deeper — the tabbed deep-dive behind the dashboard, for "now show me the working." Where the dashboard answers "how are we doing," Analytics is where someone reconciles a number, exports it, and defends it to a GM or an owner. That reframes the bar for this screen:****a number that doesn't reconcile is worse than a number that's missing****, because the entire job of the tab is to be trusted under scrutiny.*

***Verdict: engine sound, right data, wrong form.****The data layer is honest — 9 res / 21 room-nights / €2,885.40 tie out across Performance, Room-type & Rate-plan and Source mix, and Availability even reconciles against Pickup (3/2/1 sold on 24–26 Aug maps exactly onto the −1 availability cells). That's the hard part and it's done. Two problems to fix together: (a) most tabs present that data as****tables of rows****when the question is a shape, and (b) three tabs report the right data with the wrong framing. This section resolves both — first a module-wide visual mandate, then per-tab targets, then the three trust fixes.*

### ***2.0 Mandate — Analytics shows shape, not rows***

***Decision: no tab in Analytics renders a data grid. Every panel is a visual****— big-number card, donut, pace curve, bar, or heatmap. Row-level records do not belong here.*

*Two things in the current build are genuinely record-shaped, not shape-shaped, and must****not****be forced into a chart (that would be exactly the decoration the doc's bar forbids):*

*the****list of which specific bookings cancelled****(a record per cancellation), and*

*any****per-reservation detail****a user might otherwise scan for.*

*The resolution is not "keep a small table" — it's****route the detail out of Analytics.****Row-level detail lives in****Reservations****and in****Export CSV****(full-fidelity, unchanged). This isn't a new build:****Reservations already searches on******status****(the global search bar indexes guest / phone / email / room /****status****), so "which specific bookings cancelled" is answered today by**status = cancelled**— no in-tab list, drawer, or fallback needed. So no rows on screen ≠ no access to rows — the rows live in the export and in Reservations, which is where lists belong anyway. Analytics keeps only the visual summary.*

***[build rule — reconciliation survival]****Going all-visual must not break the "defend a number" job from the verdict above. Two guarantees:*

***Every visual carries its data labels****— the value sits on or beside each mark (bar, segment, cell). A labelled bar is still a visual; it just stays reconcilable. Don't hide numbers inside tooltips only.*

***Export CSV stays intact on every tab****— it is the full table, and it is where anyone reconciling to the last euro goes. The screen shows shape; the export carries the ledger.*

### ***2.1 Keep — the reconciliation itself (do not touch)***

***Cross-tab integrity is the asset.****Room-type room-nights (7+9+4+1) and rate-plan room-nights (12+9) both sum to 21; RevPAR/ADR/occupancy are mutually consistent (137.40 × 2.0% = 2.75). Protect this in any refactor — it survives the move to visuals only if the labels + CSV rules in §2.0 hold.*

***Tab decomposition is right****— Performance / Pickup & Pace / Source-Channel / Room-type & Rate-plan / Cancellations / On-the-books / Availability. Lens toggle (Stay date / Book date) and range chips (L7D / L28D / YTD / N7D / N28D) are correct; the bug is that one tab ignores them (§2.6), not that they exist.*

***Cost-of-distribution honesty discipline****— "commission paid is actual, commission avoided is an estimate" — is exactly right and matches the dashboard source-mix model. Keep the wording; fix only the empty-state logic (§2.5).*

### ***2.2 Per-tab visual targets***

*Each tab's table becomes the visual that fits its question. Data labels + CSV per §2.0 throughout.*

***Performance.****KPI cards are already big-number visuals — keep. Evolution chart (room-nights bars + ADR line, this period vs last year) — keep.****"Performance by room type" table → horizontal bar chart:****one bar per room type, length = revenue, sorted descending; room-nights and ADR ride as labels on/beside the bar. No grid.*

***Pickup & Pace.****The poster child for this whole change. The stay-date × sold-now × sold-at-snapshot × pickup table****is a pace curve.****Render: x-axis = stay dates across the horizon; two lines,****sold-now****and****sold-at-snapshot****; the****gap between them shaded = pickup****(green when positive). One glance shows where demand is building and where it's flat — impossible to read from rows.*

***Source / Channel mix.****Three cost-of-distribution stats (Commission paid / Booked direct % / Commission avoided) stay as big-number cards.****Source table → donut****of revenue share by source,****+ a net-after-commission bar****so the Direct-vs-OTA cost story is visible (the §1.3 win, here too). Commission "not set" is a****flag on the OTA segment****, not a row — and it drives the fix in §2.5.*

***Room-type & Rate-plan.****Two****bar charts****side by side — revenue by room type, revenue by rate plan — with room-nights + ADR as labels. Rate-plan (few items) can be a split bar / donut. No grids.*

***Cancellations.*** ***Rate as a gauge / big-number****carrying both framings (headline % and room-night %).****Drivers as visuals****— cancellations over time (small trend), by source (small bar), optionally by lead-time.****The reservation-level list leaves Analytics entirely****→ Reservations**status = cancelled**(an existing filter) + CSV, per §2.0. No drawer, no fallback grid — the tab is pure visual. Basis fix in §2.6 still applies.*

***Availability.*** ***The number grid → heatmap.****Same room-type × day matrix, but each cell****coloured by remaining as % of that room type's capacity****— green plenty / amber low / red overbooked — with the count kept as the cell label (a labelled heatmap cell is a visual, not a row). Biggest single visual upgrade in the module, and it keeps full reconciliation. The colour scale is the §2.4 relative threshold.*

***On-the-books.****Already visual-compliant (big-number cards, no grid), and — unlike Cancellations —****correctly hides the historical range/lens chips****, since a forward tab has no business offering backward ranges. Keep both behaviours (this is the counter-example that proves Cancellations §2.6 got the chip logic wrong).****Add the missing hero: a forward horizon curve****— committed occupancy / room-nights per day across the next 30 days — with the 7-day / 30-day cards as a summary strip beside it. Three jobs in one chart: (1) shows the shape of committed demand ahead (where you're full, where you're empty); (2) complements Pickup & Pace — pace = how fast the books fill, OTB = the current position on them; (3)****defuses a trust trap****— on sparse data the 7d and 30d cards show identical revenue / room-nights / arrivals (correct here: all 6 committed room-nights fall on 24–26 Aug, matching the Pickup tab's +3/+2/+1), but identical cards read as a failed recompute. A forward curve makes the clustering self-evident, so the correct totals look correct.*

***[consistency]****keep the "Expected values from confirmed bookings — not a prediction model" disclaimer****word-for-word identical****to the Dashboard Forecast (§1.1). Same concept surfaced twice; aligned wording lets users connect the two views instead of reading them as unrelated.*

### ***2.3 Fix — Availability "low" flag is an absolute threshold that won't scale (medium; now also the heatmap scale)***

*Suite at 2 remaining is amber; Family at 3 is not — so the rule reads as low = remaining ≤ 2, a global integer. Fine for a 3-suite demo, wrong at real scale: 2-of-3 suites is 67% still open, while 2 remaining on a 40-room type is nearly sold out — and only the latter deserves an alert. The flag must fire on****% of room-type capacity****(or a per-type configurable floor), not an absolute count. This is no longer just a badge rule — under §2.2 it****is the heatmap's colour scale****, so getting it relative is now load-bearing. Same reasoning drives****overbooked****(red) against live inventory: an absolute rule there produces noise on small types and silence on big ones.*

### ***2.4 (reserved — merged into §2.3 above)***

### ***2.5 Fix — Source/Channel mix: OTA empty-state reports €0 as fact when the rate is merely unconfigured (high)***

*The cost-of-distribution card says****"Commission paid €0 · no OTA revenue in this period"****and****"Commission avoided — needs OTA revenue."****The source data directly beneath shows****OTA: 1 res, 6 room-nights, €780, commission = not set.****So the €0 isn't "no OTA business" — it's "OTA business exists, but the channel has no commission rate configured." The card collapses two different states into one false message, then compounds it:****"revenue kept after real commission €2,885.40"****silently treats an unset rate as a 0% rate — i.e. it reports distribution as free when it isn't. Exactly the attribution-overstatement failure mode to avoid.*

*Three-way state, not a boolean:*

***No OTA revenue****→ "no OTA revenue in this period" (current copy — correct only here).*

***OTA revenue + rate set****→ compute normally.*

***OTA revenue + rate unset****→ "€780 OTA revenue · commission rate not set," and****suppress****the "revenue kept" figure (or flag it "excludes OTA — rate not configured"). Never render an unconfigured rate as €0 paid.*

***[build note]****the "not set" state already exists in the source data — the card's empty-state just isn't reading it. Drive the card off "OTA revenue > 0 AND rate configured?", not off "commission paid > 0." Under §2.2 this state surfaces as the flag on the OTA donut segment.*

### ***2.6 Fix — Cancellations: computes on book-date but displays stay-date chips (high)***

*Header: "Last 28 days · 1 of 8 created · room-night rate 2 of 16," lens set to****Stay date****. Every other tab on Stay-date L28D shows 9 active / 21 room-nights; add the one cancellation back and you'd expect 10 created / 23 room-nights — not 8 / 16. The only basis that yields 8/16 is****book (created) date****. So the tab silently computes on book-date while showing stay-date chips.*

*A genuine two-question ambiguity, worth resolving deliberately:*

***By stay date:****of stays due to fall in the window, how many cancelled. Denominator = stays in range.*

***By book date:****of bookings made in the window, how many later cancelled. Denominator = bookings created in range.*

*Different denominators, different questions. Book-date is arguably the more honest cancellation metric — a cancellation is an event on the booking timeline, not the stay timeline — so this may be the right default, wrongly labelled.*

***Fix (pick one):****either obey the Stay/Book lens like every other tab, or hard-wire to book-date, grey out the toggle, and label the denominator in words — "of 8 reservations****created****in the last 28 days." Either way the basis must be visible on the gauge from §2.2.*

### ***2.7 Minor***

***Availability header****says "next 30 days" but renders 24 Aug → 21 Sep = 29 columns. Off-by-one, or the final column is clipped — quick check (carry it into the heatmap build).*

### ***2.8 Net***

*Two moves, not one.****Form:****all seven tabs go visual — pace curve, donut + net-of-commission bar, revenue bars, a cancellation gauge, an availability****heatmap****, and an on-the-books****forward curve****— with row-level detail routed to Reservations (**status = cancelled**already exists) + CSV, so nothing reconcilable is lost (§2.0, §2.2).****Framing:****three tabs narrate honest data wrongly — a lying OTA empty-state (§2.5), a mislabelled cancellation basis (§2.6), an unscalable threshold that's now the heatmap's colour scale (§2.3) — and a fourth (On-the-books) is correct but looks broken until the forward curve makes it self-evident. The engine's already trustworthy; this section makes it look trustworthy and read at a glance. Do §2.5 and §2.6 first, then the availability heatmap, then the OTB curve.*

## ***3. Reservations***

***Who / what:****the agent's home base — "every booking, from every source," and the entry point for creating a new one. Two surfaces here: the****list****(find/scan/filter existing bookings) and the****new-reservation flow****(an availability-search → hold → details sequence).*

***Verdict: straightforward and solid — keep the shape.****One genuine design question (is search-first the right booking flow), one clear UX bug (date-field click target) that recurs anywhere native date inputs are used. Neither is a rebuild; both are refinements on a sound base.*

### ***3.1 Keep — already right (do not touch)***

***The list.****Sortable columns (Guest / Stay / Room / Source / Total / Status / Booked), status pills (confirmed / no-show / cancelled), reservation IDs, and the filter row (free-text search + status + date-type + date range + "N shown"). Clean and complete.*

***Validates the Analytics route-out.****The status filter here includes****cancelled****as a first-class value — which is exactly the capability §2.0 leans on. Confirms the decision: Analytics' Cancellations tab stays pure-visual because "which specific bookings cancelled" is answered here, not there. The two screens are correctly non-duplicative.*

***Hold-first booking is a correctness win, not just UX.****"See what's free, then hold it while you take the guest's details" locks inventory during capture so two agents can't sell the last room simultaneously — same race-condition class as the PMS atomic-transaction work. Keep it.****[build note]****ensure holds carry a****TTL / expiry****so abandoned holds release inventory back to sale; a hold with no timeout silently strands availability.*

***Shopping-step touches****— "doesn't fit" on Standard Single (sleeps 1 vs a party of 2) and "N left across every night" (min availability across the stay) — are good. Keep.*

### ***3.2 The booking-flow question (honest answer): search-first is the right primary door, not the only one***

***Why it's right for a CRS.****The channel is the call-center/agent: someone's on the phone, the agent answers "what've you got, how much" live. Availability-first matches that reality, and the hold step is a genuine correctness win (§3.1). This is the correct default — don't second-guess it.*

***Where it's thin.****It forces discovery even when the agent already knows the answer — repeat guest, rebook, "the usual," a specific room type, a group block. In all of these the shop step is friction, not help.*

***Recommendation — add a bypass, don't replace.****Support a fast path for known bookings:****guest-first entry****(from Guests → new reservation, profile prefilled) and/or "book a known room type directly." Both doors converge on the same****hold → details → confirm****tail. Search-first stays the default; known bookings skip the shop.*

***Rate visibility.****The shop step shows a single "from €X (Standard Rate)." Agents close and upsell on rate choice, so surfacing rate plans (Standard / Non-refundable) at the shop step — not only after hold — helps the agent quote and close. Minor, spec-now.*

***Optional.****Consider an inline slide-over instead of a full-page**/new**transition, so the agent keeps the reservations list in context. Low priority; full-page is clear enough.*

### ***3.3 UX bug — date fields only open the picker on the calendar-icon click (fix globally)***

*Native**<input type="date">**opens its picker only from the**::-webkit-calendar-picker-indicator**; clicking the text area does nothing. It's poor, it's the****very first field****in the new-reservation flow (bad first impression), and it recurs in the****Reservations list filter****(dd.mm.yyyy fields, same behaviour).*

***Quick fix:****call**input.showPicker()**on the field's**onClick**/**onFocus**so clicking anywhere on the field opens the picker (user-gesture-triggered; supported in current Chrome/Safari/Firefox/Edge).*

***Better fix (hotel-appropriate):****replace the two separate native date inputs with a****range picker****— one two-month calendar, click arrival then departure, nights highlighted, and later closed-out / min-stay / availability surfaced inline. Solves the click-target issue for free and is the best-in-class booking pattern.*

***[build note]****apply the chosen fix****everywhere native date inputs appear****— new-reservation search, reservations filter, and any other date field across the app — so the behaviour is consistent.*

### ***3.4 Net***

*The screen is already right; this is refinement, not rework. Keep the list and the hold-first search flow as-is (§3.1). Two moves:****add a known-booking bypass****so search-first isn't the only door (§3.2), and****fix the date-field click target globally****— quick**showPicker()**now, range picker as the real upgrade (§3.3). The date fix is the higher-frequency annoyance; do it first.*

## ***4. Guests***

***Who / what:****the guest CRM — the canonical person record behind every reservation, shared across the Revio suite. Contact & requests, derived preferences, PMS-recorded stay data, a suite-wide privacy flag, portable staff notes, and booking history, all on one profile.*

***Verdict: quietly the strongest screen so far — protect it, don't rework it.****The cross-product data governance is the differentiator and the bones are excellent. Every item below is additive: one missing action that closes a loop from §3, one forward-looking CRM gap, and a low-sample labeling discipline shared with Analytics.*

### ***4.1 Keep — already best-in-class (do not touch)***

***Cross-product data governance.****"Recorded by RevioPMS — shown here, edited there" (read-here / edit-there, single source of truth per domain); privacy "honoured across RevioDirect, RevioCRS and RevioPMS at once" (one flag, suite-wide); notes "visible wherever this guest appears, in every Revio product." This is Revio's ecosystem story and it's rare in this tier —****protect the single-source discipline in any refactor.****Stay data is owned by PMS and correctly read-only here.*

***Derived preferences****— "worked out from this guest's past bookings." Honest labeling (derived, not entered) and the right attribute set (preferred room type, avg stay, lead time, frequency, lifetime accommodation, cancellation behaviour).*

***Privacy toggle****— "Do not recognise this guest across stays," with the honest caveat that history is unchanged and still counts in reports. GDPR-adjacent, correctly scoped, honestly disclosed.*

***Booking history as a list****— correct. Record-shaped data stays tabular (consistent with §2.0 logic); do not chart it.*

*Numbers reconcile again — €390 lifetime accommodation = the single booking's total. Honest data.*

### ***4.2 Add — "New reservation / Book again" on the profile (closes the §3.2 loop)***

*§3.2 recommended a****guest-first bypass****so known bookings skip the availability-shop step. This profile is exactly where that path should originate — and the CTA is missing. Add****"New reservation"****that jumps into the booking flow with****this guest already attached****and their derived defaults pre-selected (preferred room type, typical party). Converges on the same****hold → details → confirm****tail as search-first.****Highest-leverage add on the screen****— it's the concrete home for the bypass §3.2 only described in the abstract.*

### ***4.3 Add — guest merge / de-duplication (forward-looking, spec now)***

*No merge capability is visible. A guest CRM inevitably accumulates duplicates — same person, different email, OTA-vs-direct name spellings — and without merge, bookings, derived preferences, and lifetime value****fragment across duplicate profiles****, quietly corrupting the very intelligence §4.1 is built on. Spec a merge: pick the surviving record, fold history / notes / preferences / privacy flag, keep an audit trail. Standard CRM need; cheap to design now, painful to retrofit once duplicates exist in the wild.*

### ***4.4 Refine — low-sample statistics are labeled with more authority than they have (low/medium)***

*"Average stay 3.0 nights," "Booking frequency 1 stay," "Average lead time 0 days," "Usual room 404," "Usual floor Floor 4" are all derived from a****single****stay. "Average" and "usual" imply a pattern from repetition; at n=1 they're just "the one value." Same class as the Analytics YoY-from-zero labeling (§2.5) — a statistic presented with unearned confidence.*

***Fix (consistent rule, shared with Analytics):****below a sample threshold, either switch language ("Last stay," "Last room") or annotate the sample ("Average stay 3.0n · 1 stay"). Keep "average / usual" framing only once there's enough history to mean it.*

### ***4.5 Question — does the profile hydrate contact fields from linked reservations?***

*Contact & requests (email / phone / company) are empty, yet this guest has a****confirmed Direct stay****. If the profile is the canonical merged record, contact captured at booking should populate here. Confirm the direction:****profile pulls from bookings****(best-in-class — the profile is the merge point), or it's a****separate manual store****(a reservation→profile data-flow gap worth closing).*

### ***4.6 Boundary note — don't let the §2 visual mandate leak here***

*The visual-first rule is****Analytics-scoped.****A guest profile is legitimately field-and-fact based; the derived-preferences block is fine as labeled stats, and booking history stays a list.****No charts here****— that would be exactly the decoration the doc's bar forbids. Flagged explicitly so the mandate isn't over-applied screen to screen.*

### ***4.7 Net***

*The strongest screen in the CRS, and the cross-product governance (§4.1) is the thing to guard. Work here is purely additive: the****"Book again" CTA****(closes §3.2 — do first),****guest merge****(forward gap, spec now), and a****low-sample labeling discipline****shared with Analytics §2.5. One open question on contact hydration (§4.5) to confirm the reservation→profile data flow.*

## ***5. Inventory Calendar***

***Who / what:****the ARI control surface — "availability, rates and restrictions" per room-type per day, plus the bulk-edit tool for changing many cells at once. The operational heart of the CRS. Focus of this pass (per the brief): the at-a-glance grid, and making bulk-edit — especially the****rate****side — easy.*

***Verdict: grid is right and reconciles; bulk-edit is the right tool, but the rate operation is harder than it should be — not because it's wrong, but because its cleverest feature is invisible.****The derived-rate model is genuinely strong; the problem is the user can't see it work, so they can't trust it.*

### ***5.1 Keep — already right (do not touch)***

***The ARI grid.****Physical / Out-of-order / Closed / Available / Sold / Remaining / Rate / Restrictions, per day. Complete and it reconciles — Physical 12 − Sold 1 = Remaining 11 on 24 Aug; Available = Physical − OOO − Closed; and it matches the Analytics Availability tab exactly. Correct control surface; weekend rate uplift (€142 Fri/Sat vs €120 midweek) is coherent.*

***Derived-rate architecture.****One master (Standard Rate) + derived plans (Non-Refundable, Breakfast, Long Stay, Trip.com, Corporate) as offsets that follow it — "manual only" on the derived rows. This is how good revenue management works: set the master, derived plans recompute. Strong; protect it. The only issue is that it's hidden (§5.3).*

***Bulk-edit scope model.****Date range + days-of-week + room types + rate plans. Right primitives; "leave all off = every day" is a good touch.*

***Preview & apply before commit.****Correct for a destructive bulk op across month × room-types × rate-plans (same atomic-discipline as the PMS work). Keep — and make it show the cascade (§5.3).*

### ***5.2 At-a-glance grid — add scan-cues (do not turn it into a chart)***

*It's an editable grid, so keep numbers primary — but flat numbers are hard to scan for exceptions. Two cues:*

***Restrictions row is cryptic.****Each day shows a bare "." which conveys nothing. Render small readable badges — MIN 2, CTA, CTD, closed — so restrictions are legible at a glance without opening a cell.****Biggest at-a-glance weakness.***

***Remaining row is flat.****Grade it by pressure (low remaining → amber/red), reusing the****relative-threshold logic from Analytics §2.3****(% of room-type capacity, not an absolute count), and highlight Closed/OOO cells when non-zero. Subtle shading only — enough to spot tight or closed days, not enough to harm editability.*

### ***5.3 Bulk-edit — the RATE side (the explicit focus): make it easy***

*The rate operation is spread across a long form and its smartest behaviour (the derived cascade) is invisible. Four moves, in priority:*

***Make the derived cascade explicit — the #1 easy win.****The derived rows are greyed with a DERIVED tag, which says "you can't edit these" but not "these move automatically when you change Standard." So a user changing Standard doesn't know whether Non-Refundable will follow or go stale — and that doubt is the whole friction. Add one line by the derived rows:****"Derived plans follow Standard — change it and they recompute."****Ambiguity → reassurance; the user learns they only ever touch Standard.*

***Tab the modal — Rates | Availability | Restrictions.****Today it's one scroll: a price change has to wade past rooms-to-sell, min/max stay, min/max advance, CTA/CTD. Isolate****price + rate-plan selection + preview****in a Rates tab; put inventory in Availability and the stay/advance/CTA-CTD rules in Restrictions. (Matches how the tool is already described — "the rate tab" — so make it one.)*

***Co-locate rate-plan selection with the Price control.****Currently "which plans" lives in the scope block at the top and "Price" is scrolled far down — one logical operation split across a scroll. Put the rate-plan checkboxes adjacent to Price so it reads as a single unit: change THESE plans BY this much.*

***Unit-aware Value + a preview that shows the cascade.****Echo € / % in the Value field based on the chosen operation (Set exact / Increase-% / Decrease-% / Increase-€ / Decrease-€), and show the result inline ("€120 → €132"). Then make****Preview & apply****spell out the blast radius: "Standard €120→€132; 5 derived recomputed (Non-Ref €108→€119, Breakfast €135→€147…)." Safety and clarity in one step.*

### ***5.4 Minor***

***From / To in the bulk modal are native date inputs****(24.08.2026 with the calendar-icon-only picker) — same click-target bug as §3.3. Fold into the global date-field fix.*

***"Set exact price" with derived plans****— make explicit it sets the master only (derived recompute off it), not every plan to that literal figure, so no one expects it to flatten all plans to one price.*

### ***5.5 Net***

*The grid is correct and reconciles; it just needs****scan-cues****— real restriction badges and Remaining-pressure shading (§5.2). Bulk-edit is the right tool, and the****rate side is the priority****: above all,****make the derived cascade visible****(§5.3) — the model is strong but hidden, so users can't yet trust "change Standard, everything follows." Then tab the modal and co-locate plans with price. Do the derived-cascade explainer first; it's one line and it's the difference between the feature feeling clever and feeling risky.*

## ***6. Occupancy-Based Pricing (OBP) — cross-cutting feature spec***

*Not a screen review — a feature to build. Spans the whole Revio ecosystem (RevioLink → Channex, RevioCRS, RevioPMS). Lives primarily in Settings but changes Bulk-edit, the Inventory Calendar, and the booking flow. Written for a developer unfamiliar with hotel-distribution concepts, so it starts with a plain-English primer. Can be lifted into a standalone ecosystem spec for hand-off if preferred; kept here to stay in the running doc.*

### ***6.0 The gap***

*Revio prices****per room, per day****— one rate for a room type on a date, regardless of how many people sleep in it. Many hotels price****per occupancy****: a Double sold to 1 guest is cheaper than the same Double sold to 2. We have no way to express that today. OBP adds it. This is table-stakes for a large share of European properties and OTAs, and its absence blocks those hotels from using Revio at all.*

### ***6.1 Domain primer (read first)***

***Per-room pricing (current):****rate is a function of (room type, rate plan, date). Guest count doesn't affect price.*

***Occupancy-based pricing (OBP):****rate is a function of (room type, rate plan, date,****occupancy****). "Occupancy" here means****number of adults****, 1 up to the room type's max. Children/infants are a separate axis (§6.9) — do not conflate them with adult occupancy.*

***Primary (base) occupancy:****one occupancy level per plan is the anchor. It's the base for any within-plan derivation, and it's the rate/restriction a single-rate channel receives.*

***Two derivation axes — the critical distinction:***

***Plan-to-plan (already exists):****e.g. Non-Refundable = Standard − 10%. This is Revio's current "derived rate plans" (§5).*

***Occupancy-to-occupancy (new with OBP):****within one plan, e.g. 1-guest = 2-guest − €20. These are****orthogonal****. A plan can be per-room or per-person independently of whether it's derived from another plan. When a plan is both derived and per-person, occupancy rates derive from the parent plan's****matching****occupancy (see**cascade**, §6.7). Getting these two axes tangled is the main failure mode — keep them separate in the data model and the UI.*

### ***6.2 Settings surface & where every OBP field lives***

*Settings holds the****property-level****OBP configuration; per-plan and per-room fields live on their own screens (map below). All of it is single-source (§4.1): declared once, read by CRS, PMS, RevioDirect and RevioLink.*

***Settings — property-level OBP config***

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| pricing_model_default | enum per_room / per_person | per_room | The master switch the brief asks for. Sets the default sell_mode every new/existing plan inherits. |
| occupancy_seed_mode | enum flat / derived_down | flat | When a plan first goes per-person, how its occupancy rows seed: all equal to base, or primary set and lower occupancies reduced. |
| occupancy_seed_offset | % or € per step | −10% | Used when occupancy_seed_mode = derived_down: the per-step reduction below primary. Hotel edits after. |
| occupancy_display | enum all / primary_expand | primary_expand | How per-occupancy prices render in calendar + booking engine (§6.5). |
| age_policy | object: age bands | infant 0–2, child 3–11, adult 12+ | Scaffolds the children/infant axis (§6.9); rate-plan child/infant fees reference these bands. Ship the bands now even if child pricing activates later. |
| cm_obp_capability | read-only bool | detected | Whether the connected channel manager supports per-occupancy (§6.7 gate). Governs whether OBP can be enabled or must degrade. |

***Where each OBP field is edited (single source of truth):***

| Lives on | Fields |
| --- | --- |
| Settings (property) | the six above — model default, seed rules, display pref, age policy, CM capability |
| Rooms & Rates → Room Type | max_occupancy, default_occupancy |
| Rooms & Rates → Rate Plan | pricing_model (override), primary_occupancy, rate_mode, parent_rate_plan, occupancy_derivation, children_fee, infant_fee |
| Inventory Calendar / Bulk-edit | the per-date per-occupancy rate values (data, not config) |

***Per-plan override.****Channex sets**sell_mode**per rate plan, so mirror that: the Settings value is the default; a plan may override. Simple hotels flip one switch; advanced hotels run some plans per-room and some per-person. Default: every plan inherits the property model.*

***Toggle behaviour — property pricing model:***

***Per Room → Occupancy-Based:****for every affected plan, expand its single occupancy row into rows**1 … max_occupancy**per**occupancy_seed_mode**; set**primary_occupancy = default_occupancy**; push**sell_mode = per_person**+**options**to the CM; re-send ARI; re-check channel mappings. No rate data lost.*

***Occupancy-Based → Per Room:****collapse to the primary occupancy's rate as a single**max_occupancy**row;**sell_mode = per_room**; push. Reversible.*

*Whole feature and per-plan override are****gated on******cm_obp_capability****(§6.7).*

### ***6.3 Data model & field reference***

*Core change:****rate gains an occupancy dimension.****Today rate is keyed by (room type, rate plan, date); OBP makes it (room type, rate plan, date,****occupancy****). A per-room plan is the****special case of one occupancy row at max occupancy****— same shape as Channex — so per-room and per-person share one schema and switching is a row expand/collapse, not a fork.*

***Room Type***

| Field | Type | Default | Validation | Channex |
| --- | --- | --- | --- | --- |
| max_occupancy | int ≥ 1 | required | ≤ 18 | max_persons ceiling; number of occupancy rows under OBP; also drives "doesn't fit" (§3.1) |
| default_occupancy | int 1…max | = max_occupancy | ≤ max_occupancy | default_occupancy; suggested primary_occupancy for the room's plans |

***Rate Plan***

| Field | Type | Default | Validation | Channex |
| --- | --- | --- | --- | --- |
| pricing_model | enum per_room / per_person | inherits property default | — | sell_mode |
| primary_occupancy | int 1…room.max | = default_occupancy | must exist in options | options[].is_primary = true |
| rate_mode | enum manual / derived / cascade / auto | manual (derived if parent set) | use cascade when derived and per-person | rate_mode |
| parent_rate_plan_id | uuid / null | null | no cycles | parent_rate_plan_id (+ inherit_*) |
| occupancy_derivation | array {occupancy, mode: manual/offset, rules} | manual | one entry per non-primary occupancy | options[].derived_option / auto_rate_settings |
| children_fee | decimal ≥ 0 | 0.00 | — | children_fee (§6.9) |
| infant_fee | decimal ≥ 0 | 0.00 | — | infant_fee (§6.9) |
| meal_type | enum | none | — | meal_type — board basis; e.g. your Breakfast Rate → breakfast |

***Occupancy Option****— the per-occupancy rows under a plan (the ARI store)*

| Field | Type | Notes | Channex |
| --- | --- | --- | --- |
| occupancy | int 1…max | one row per adult count (per-person) or a single max row (per-room) | options[].occupancy |
| is_primary | bool | exactly one true per plan | options[].is_primary |
| rate | decimal | default rate; per-date values live in the calendar / ARI store | options[].rate + daily ARI push |
| derived_option | offset rules | ordered [[rule, arg], …] applied left→right; rules: increase/decrease_by_amount/percent | options[].derived_option |

***Validation — enforce in UI and before every CM push:***

*Exactly****one*** *is_primary**occupancy option per plan.*

***per_room****plan → exactly one option,**occupancy = max_persons**, primary.*

***per_person****plan → one option per occupancy**1 … max_persons**, contiguous, no gaps.*

*occupancy ≤ room.max_occupancy**;**max_persons ≤ room.max_occupancy**;**occupancy ≤ 18**.*

*primary_occupancy**must exist in the options set.*

*Channex ceilings:****≤ 10 rate plans per room type, ≤ 200 per property****— never model occupancy as extra rate plans (§6.7).*

*The two derivation axes stay separate (§6.1):**parent_rate_plan_id**(plan-to-plan) is independent of**occupancy_derivation**(occupancy-to-occupancy); when both are set,**rate_mode = cascade**.*

### ***6.4 Bulk-edit changes (the brief's explicit ask)***

*Builds on the tabbed Rates panel from §5.3. When the targeted plan(s) are per-person:*

***The Price control becomes an occupancy matrix****— one row per occupancy,****1 … room-type max_occupancy****. Each row takes the same operation set as today (Set exact / Increase-% / Decrease-% / Increase-€ / Decrease-€) with its own value.*

***Two entry modes****(mirror Channex, and the "make it easy" bar from §5):*

***Manual per occupancy****— set each occupancy's price explicitly.*

***Primary + offsets****— set the primary occupancy once, then per-occupancy modifiers (+/- % or €). Faster; this is Channex's recommended path and should be the default for a hotel with a simple "each extra guest +€20" rule.*

***Mixed max-occupancy across selected room types:****if the bulk edit spans room types with different caps (e.g. Deluxe max 2, Family max 4), render occupancy rows up to the****highest****cap, and****skip****occupancy rows that exceed a given room type's max when applying (never send occupancy 4 to a 2-cap room). State this in the preview.*

***Preview & apply****shows the full occupancy × plan cascade before commit (extends the §5.3 preview): every occupancy rate that will change, per plan, including derived ones.*

### ***6.5 Inventory Calendar display (the brief's explicit ask)***

*When OBP is on, the single****Rate****row becomes****occupancy-aware.****Default: show the primary-occupancy rate with an OBP badge; the Rate cell****expands****to reveal all occupancies (e.g.**1p €90 · 2p €120 · 3p €140**), or renders inline compactly as**€90 / €120 / €140**.*

***Do not****explode the grid to N permanent rate rows per plan per room type by default — that destroys the at-a-glance scan (§5.2). Expand-on-demand, or compact inline. Per-room plans render exactly as today (one rate).*

### ***6.6 Where it's implemented — ecosystem map***

*OBP is a core data-model change (§6.3), so****every surface that quotes, displays, syncs, or bills a rate must become occupancy-aware.****One per-room surface left behind produces the classic parity failure — guest sees one price on the booking engine, the OTA shows another, the folio bills a third. The pricing model + occupancy rates live****once****(Settings, §6.2) and every product reads them (same single-source discipline as the guest record, §4.1) — no product keeps its own rate copy.*

***RevioCRS (this doc).****Settings toggle (§6.2), calendar display (§6.5), bulk-edit matrix (§6.4), and agent quoting — the availability search already captures****Guests****, so under OBP it resolves the per-occupancy rate for that count, not a flat "from €120." Rate resolution becomes**f(room type, rate plan, date(s), occupancy)**; the "doesn't fit" guard (§3.1) pairs with it.*

***RevioPMS.****The stay is where money is actually collected, so a per-room folio under an OBP property is a guaranteed parity break. Needs: folio rate line = occupancy rate for the adult count;****re-resolve when occupancy changes mid-stay****(extra bed, added guest);****room moves / upgrades****across room types re-price; walk-ins quoted at occupancy; night audit posts the occupancy rate per night. Shared pricing model means CRS quote = PMS bill by construction.*

***RevioDirect (booking engine).****The most visible and most parity-critical surface. The occupancy selector (adults) drives the displayed price, which must match both the OTAs (parity) and the eventual folio; per-room booking-engine pricing while OTAs show per-occupancy = direct guests booking at the wrong price. Multi-room bookings price each room's occupancy independently. (The CRS "Booking Engine" screen configures RevioDirect; the pricing model flows through — it isn't re-declared there.)*

***RevioLink (channel manager).****The outbound sync layer (§6.7)****and the inbound path****: OTA/channel bookings arrive with a guest count and must be landed at the matching occupancy so the downstream folio reconciles. Reservation ingestion must capture occupancy.*

***Read-through beneficiaries — no core work required, but opportunities:***

***Analytics (§2)****reads actual booked rates, so ADR / RevPAR / revenue stay correct with zero change. New dimension worth adding later: ADR by occupancy and single-vs-double mix — genuine revenue-management insight OBP unlocks.*

***Guests (§4)****derived preferences could gain****typical party size****, pre-filling occupancy in the §4.2 "Book again" flow so a known guest is quoted at their usual occupancy in one click.*

### ***6.7 Channex contract (verified against docs — the sync layer RevioLink writes)***

*Rate plan carries**sell_mode**:**per_room**|**per_person**.*

***per_room****→ send****one****occupancy option at max occupancy; Channex pushes ARI only for that occupancy.*

***per_person****→ send****one occupancy option per adult count, 1 … max_persons****; Channex pushes ARI for each.*

*Each****occupancy option****:**{ occupancy: int, is_primary: bool, rate: int, derived_option?: object }**.*

*is_primary**marks the base occupancy (base for within-plan derivation; the option that carries restrictions to single-rate channels).*

*Rate-plan****rate_mode****:**manual**|**derived**|**cascade**|**auto**.*

*manual**— each occupancy rate set explicitly.*

*derived**— rate derived from**parent_rate_plan**for the****primary****occupancy only.*

*cascade**— rate derived from**parent_rate_plan**for****each****occupancy.****← use this for a plan that is both derived-from-a-parent AND per-person****(axis-1 + axis-2 together, §6.1).*

*auto**— computed from the primary occupancy +**auto_rate_settings**.*

***derived_option****= ordered modifier rules on a value, applied left-to-right:**{ "rate": [["increase_by_percent","5"],["increase_by_amount","12"]] }**→ 100 → 105 → 117. Rules:**increase_by_amount**,**increase_by_percent**,**decrease_by_amount**,**decrease_by_percent**.*

***Mapping Revio → Channex:***

*Revio property/plan pricing model →**sell_mode**.*

*Revio plan-to-plan derivation (Non-Ref from Standard) →**parent_rate_plan_id**+**rate_mode**(**derived**if only the primary occupancy follows the parent;**cascade**if every occupancy follows) + the**inherit_***flags for restrictions.*

*Revio within-plan occupancy offsets → per-option**derived_option**, or**auto_rate_settings**for the simple "flat delta per extra guest" case.*

*Daily per-occupancy rates go out via the****Availability & Rates (ARI) endpoint****(**POST /api/v1/restrictions**) — verified contract in §6.7a below.*

***Limits to enforce in UI:****per-person up to****18 occupancy****;****max 10 rate plans per room type / 200 per property.****Channex explicitly warns against modelling occupancy as separate rate plans — we must use per-person options, not plan-per-occupancy, or we blow the plan budget and the OTA mappings.*

***Capability gate — the connected CM matters.****RevioCRS connects through exactly one channel manager:****RevioLink****(Channex — full OBP support)****or a partner's existing third-party CM****, which may be per-room only. OBP's downstream reach is therefore gated by the connected CM's capability. If it can't express per-occupancy rates, either****disable OBP for that property****or****degrade to sending the primary-occupancy rate only****, and surface the limitation so the hotel isn't surprised by flattened OTA pricing.****Detect capability at connection time — don't assume RevioLink.***

### ***6.7a Daily ARI push — the per-occupancy contract (verified)***

*This is how the actual per-date prices leave RevioLink. No guessing left — the fields below are confirmed against the Channex ARI docs.*

***Endpoint:*** *POST /api/v1/restrictions**. Body is**{ "values": [ …change objects… ] }**— one array, many change objects, batched.*

***Two rate shapes on a change object — this is the OBP crux:***

***Per-room plan →******rate****(single scalar).**{ property_id, rate_plan_id, date | date_from+date_to, rate }**.*

***Per-person plan →******rates****(array of**{occupancy, rate}**). One change object carries every occupancy for the date/range:
 {  "property_id": "…",  "rate_plan_id": "…",  "date_from": "2026-09-01",  "date_to": "2026-09-10",  "rates": [    { "occupancy": 1, "rate": 9000 },    { "occupancy": 2, "rate": 12000 }  ]}*

*So a per-person daily push is****not****N separate calls per occupancy — it's one change object with a**rates**array. Send only the occupancies you're changing.*

***Rate value format:****either an integer in the currency's****minor unit****(**12000**= €120.00) or a decimal****string****(**"120.00"**). Pick one convention and hold it everywhere to avoid float drift; integer-minor-unit is safest.****Rate must be > 0****(a 0 or negative rate is rejected per-object with a warning).*

***Restrictions ride the same call****(min_stay_arrival, min_stay_through, min_stay, max_stay, closed_to_arrival, closed_to_departure, stop_sell) — these are****per rate plan, not per occupancy****, so they sit at the top of the change object alongside**rates**. This confirms §6.7's "primary occupancy carries restrictions" — restrictions have no occupancy dimension.*

***Batching & efficiency (matches §6.4 bulk-edit):***

*date_from**/**date_to**+ optional**days: ["sa","su"]**express a whole range in one object — e.g. base rate for a year, then a weekend override, in two objects.*

***Last-Win / FIFO:****objects apply in order; a later object overrides an earlier one for overlapping dates. This lets bulk-edit send "set base, then override weekends" cheaply — the same mental model as the §6.4 preview.*

***Rate limits:****20 ARI calls/min per property (10 of them restrictions/price); up to 10 MB per call. Bulk-edit must****batch into a queue/outbox****, not fire per-cell — combine all occupancy × date changes into as few**values**arrays as possible.*

***Error handling — the sharp edge:****invalid objects return****HTTP 200****with a**meta.warnings[]**array; the good objects still commit. So a 200 does****not****mean everything applied. RevioLink must****parse******meta.warnings******on every push****and surface partial failures (e.g. a rejected occupancy rate) back to the user — silently trusting the 200 will let bad per-occupancy rates vanish without the hotel knowing.*

***Reading back:*** *GET /api/v1/restrictions?filter[property_id]=…&filter[date][gte]=…&filter[date][lte]=…&filter[restrictions]=rate**returns**{ rate_plan_id: { date: { rate: … } } }**. Availability is separate —**GET/POST /api/v1/availability**is****per room type, not per rate plan or occupancy****(availability has no occupancy dimension; only rate does).*

### ***6.8 OTA behaviour (set expectations in the UI)***

***Booking.com-class channels:****full per-occupancy mapping; the****primary****occupancy sends the shared restrictions.*

***Single-rate channels (e.g. Airbnb):****only one rate maps — send the****primary/lowest****occupancy rate; the channel's own "included guests + price per extra guest" handles increments (a single flat increment only, no per-step curve). Surface this limitation where a hotel maps such a channel, so they know their fine-grained occupancy curve flattens there.*

### ***6.9 Children / infants — the adjacent axis (scope note)***

*OBP as specced above =****adult****occupancy (rows 1…max). Children/infants are a****separate****axis: Channex exposes**children_fee**/**infant_fee**per rate plan, applied per the hotel's****age policy****. Do****not****fold child pricing into the adult-occupancy rows. Flagged as the natural****next****feature after OBP ships; note it now so the data model leaves room (age policy + child/infant fees per plan) rather than being retrofitted.*

### ***6.10 Migration & back-compat***

***Existing data is per-room.****Migrate each plan to a single occupancy option at max occupancy, rate = current rate. No data loss, no visible change.*

***Enabling OBP on a plan:****seed occupancy rows from the current flat rate (simplest: every occupancy = current rate; or primary = current rate and lower occupancies derived down by a default offset the hotel then edits).*

***Switching back to per-room:****collapse to the primary/max-occupancy rate. Reversible.*

***On any model switch:****PUT the plan's**sell_mode**to Channex and re-send ARI; re-check channel mappings (Booking.com occupancy lines, Airbnb single rate). Treat as a sync event, not just a local config change.*

### ***6.11 Build order***

*Data model: occupancy dimension on rates,**pricing_model**+**primary_occupancy**on plans,**max/default_occupancy**on room types; per-room as the one-row special case (§6.3).*

*Settings toggle (property default + per-plan override) (§6.2).*

*Channex sync:**sell_mode**, occupancy**options**,**rate_mode**incl.**cascade**, and the daily per-occupancy ARI push via**POST /restrictions**using the**rates**array (§6.7 + verified contract §6.7a) — with a batching queue and**meta.warnings**parsing.*

*Bulk-edit occupancy matrix + primary-plus-offsets mode (§6.4).*

*Calendar per-occupancy display (§6.5).*

*Booking-flow rate resolution by guest count —****CRS + RevioDirect****— plus****PMS****folio/night-audit resolution and****RevioLink inbound****occupancy capture (§6.6).*

*Migration + model-switch sync (§6.10).*

*(Later) children/infant axis (§6.9).*

### ***6.12 Net***

*Channex supports OBP natively, and it sits cleanly on top of the derived-plan model already in the product — so this is mapping + UI, not a pricing-engine rebuild. The whole risk concentrates in one place:****keep the two derivation axes (plan-to-plan vs occupancy-to-occupancy) distinct****, and use Channex**cascade**where they combine. Store per-room as the single-occupancy special case so the two models share one schema. Everything else — Settings toggle, bulk-edit matrix, calendar display, occupancy-aware quoting — follows from that.*
