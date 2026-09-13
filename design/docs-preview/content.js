// Reviewed drafting inputs, not a published user manual. No live requests or customer data.
window.REVIO_DOCS_DRAFTS = {
  setup: {title:'Prepare your hotel setup',group:'Start here',section:'guides',lead:'Agree what you are moving before connecting any system.',next:'concepts',sections:[
    ['before','Before you start','<p>Identify the property, products you will use and the person responsible for checking the setup. Keep the current system running until the agreed cutover checks are complete.</p>'],
    ['prepare','Prepare the essentials','<ol class="steps"><li><strong>Rooms and rates</strong><p>List room types, physical rooms where relevant, occupancy, currencies and active rate plans.</p></li><li><strong>Reservations and channels</strong><p>Agree which existing bookings need transferring and which external connections are supported.</p></li><li><strong>People and permissions</strong><p>Name the people who manage setup and those who only need daily operational access.</p></li></ol>'],
    ['check','Verify before cutover','<p>Compare selected dates and room types with the original system. Check availability, the applicable rate plan and restrictions. A successful import does not prove that an ongoing channel connection works.</p>'],
    ['help','If something differs','<p>Stop the cutover and record the exact room type, rate plan, dates and difference. Do not overwrite the other system repeatedly while ownership is unclear.</p>'],
  ]},
  'link-sync': {title:'Read the Sync Center',group:'RevioLink · Troubleshooting',section:'link',lead:'Separate a delivered update, a warning and a channel limitation.',next:'link-mapping',review:'Code checked · UI review pending',sections:[
    ['open','Choose the right view','<p>Open <strong>Sync Center</strong>. Use <strong>Activity</strong> for the push/pull feed, <strong>Errors</strong> for issues requiring attention and <strong>Audit Log</strong> for recorded changes.</p>'],
    ['status','Read the result, not just its colour','<p>Review the channel, time and outcome for the operation you are checking. Pending, warning, skipped and no-op entries do not establish that a rate reached the OTA. Read any explanation or warning attached to the entry.</p>'],
    ['limits','Channel limitations are different from failures','<p>The screen lists channel limitations separately. A restriction unsupported by the destination cannot be fixed by sending it repeatedly. Confirm which restrictions that channel supports.</p>'],
    ['verify','Verify the intended result','<p>Match the property, room type, rate plan and dates to the change you made. If the channel still differs, include these details and the activity outcome in your support report. Do not share integration keys.</p>'],
  ]},
  'link-mapping': {title:'Understand room and rate mapping',group:'RevioLink · Connections',section:'link',lead:'Names alone are not enough to identify the product you sell.',next:'link-sync',sections:[
    ['match','What must match','<p>Mapping connects an external room type and rate plan to their Revio counterparts. A channel rate plan belongs to a particular room type: the same “Standard” label used for two room types does not make it one mapping.</p>'],
    ['check','Check a mapping','<ol class="steps"><li><strong>Confirm the property</strong><p>Do not compare similarly named rooms belonging to different hotels.</p></li><li><strong>Identify the room type</strong><p>Compare capacity and the actual external identifier, not only the display name.</p></li><li><strong>Identify the rate plan</strong><p>Check meals, cancellation conditions, active status and whether the price is derived.</p></li></ol>'],
    ['verify','Verify beyond the connection label','<p>Check a known date and the actual selling product at the channel. A green connection does not prove that every room and rate is mapped correctly.</p>'],
    ['escalate','When to ask for help','<p>If a booking arrives with an unrecognised mapping, preserve its reference and report the missing match. Do not guess a substitute room type merely to clear an error.</p>'],
  ]},
  'crs-reservations': {title:'Reservations and inventory holds',group:'RevioCRS · Bookings',section:'crs',lead:'A temporary hold and a confirmed reservation are different stages.',next:'crs',sections:[
    ['context','Start with the right stay','<p>Confirm the property, arrival and departure dates, guest count, room type and rate plan. Availability is date-specific; a vacant physical room is not by itself proof that a stay can be sold.</p>'],
    ['hold','Understand a hold','<p>A hold temporarily reserves inventory during the booking flow. It has an expiry and is not a completed reservation. Do not promise confirmation based only on a room selection or a running countdown.</p>'],
    ['confirmation','Verify confirmation','<p>After completing the booking flow, verify the reservation reference, status, dates and price in the reservation record. If confirmation is uncertain, search for an existing record before trying again.</p>'],
    ['change','Changing an existing stay','<p>Review the new dates and applicable price before confirming a modification. If a change fails, check the original record and its status. Avoid creating a second reservation as a workaround without resolving the first one.</p>'],
  ]},
  'pms-readiness': {title:'Check room readiness',group:'RevioPMS · Housekeeping',section:'pms',lead:'Cleaning status, occupancy and an out-of-order room answer different questions.',next:'pms',review:'Code checked · UI review pending',sections:[
    ['views','Choose a housekeeping view','<p>Open <strong>Housekeeping</strong>. <strong>Smart order</strong> prioritises the cleaning queue; <strong>By floor</strong> groups physical rooms. Check the property shown before updating a room.</p>'],
    ['read','Read the room tile','<p>Use the room number, room type, occupancy and cleaning state together. A room can be vacant without being ready for a guest. Arrival and departure indicators help explain why a room needs attention.</p>'],
    ['update','Update only what you have verified','<p>Use the actions available to your role to record the cleaning or inspection work actually completed. Follow the hotel’s inspection process before treating a room as ready.</p>'],
    ['outoforder','Handle an out-of-order room','<p>Out of order is not another word for dirty. It affects sellable availability. Resolve the underlying maintenance problem before returning the room to service, and verify any channel updates separately.</p>'],
  ]},
  'direct-checklist': {title:'Review your booking page',group:'RevioDirect · Launch checklist',section:'direct',lead:'Walk through what a guest sees before sharing the booking link.',next:'direct',sections:[
    ['content','Check the hotel content','<p>Review the hotel name, branding, room descriptions, photographs, amenities and contact information configured through RevioCRS. Use only approved hotel images.</p>'],
    ['price','Check a sample stay','<p>Choose known dates and guest counts. Compare the displayed rate, included taxes and fees, room type and conditions with the intended offer. Use a test property for booking tests, not live inventory without an agreed test plan.</p>'],
    ['edgecases','Try the difficult cases','<p>Check unavailable dates, invalid or missing details and a mobile screen. Alternative dates should be understood as different stays, not a guarantee that the original dates are available.</p>'],
    ['confirm','Verify the complete flow','<p>On an authorised test setup, check confirmation and the resulting CRS reservation. Payment and guarantee behavior depends on the configured provider and mode; never assume that a test-mode success validates live payments.</p>'],
  ]},
  'roles-and-access': {title:'Set up roles and access',group:'Start here · Account',section:'guides',lead:'Give each team member the access they need for their work.',next:'properties-and-currencies',navGroup:'Account basics',sections:[
    ['principle','Start with responsibility','<p>List who configures the hotel, who handles reservations and who works at the front desk. Access should follow the job, not be copied from the first account created.</p>'],
    ['invite','Invite the right people','<ol class="steps"><li><strong>Use a named account</strong><p>Each person should sign in with their own account so changes can be traced to a real operator.</p></li><li><strong>Choose the smallest useful role</strong><p>Do not grant configuration or billing access to a user who only needs daily operations.</p></li><li><strong>Remove stale access</strong><p>Review former staff and temporary accounts before launch and after a team change.</p></li></ol>'],
    ['review','Review access regularly','<p>Access is part of the hotel setup. Record who approved it and revisit it when a person changes responsibilities.</p>'],
  ]},
  'properties-and-currencies': {title:'Prepare property details',group:'Start here · Account',section:'guides',lead:'Keep the property identity, local settings and currency consistent.',next:'roles-and-access',navGroup:'Account basics',sections:[
    ['identity','Confirm the identity','<p>Check the property name, address, timezone, contact details and approved logo before connecting channels or publishing a direct booking page.</p>'],
    ['money','Keep money unambiguous','<p>Prices are integer minor units paired with an ISO currency code. A display preference must not silently change the currency used for a reservation or invoice.</p>'],
    ['cutover','Record the baseline','<p>Save a short baseline of room types, rate plans, taxes and policies. It gives the team something concrete to compare after an import or configuration change.</p>'],
  ]},
  'support-and-faq': {title:'Support and frequently asked questions',group:'Start here · Help',section:'guides',lead:'Find the fastest safe answer before changing a live hotel setup.',next:'setup',navGroup:'Help',sections:[
    ['where','Where should I start?','<p>Start with the product collection that owns the work: CRS for reservations and rates, PMS for property operations, Link for channel delivery and Direct for the guest booking surface.</p>'],
    ['evidence','What should I include in a support request?','<p>Include the property, product, exact dates, room type, rate plan, reference or channel and the observed result. Screenshots are helpful when they do not expose guest data or secrets.</p>'],
    ['safe','What should I avoid?','<p>Do not send card numbers, API keys or full guest identity documents. Do not retry a failed booking until you have checked whether the first attempt created a reservation.</p>'],
    ['status','How do I know an answer is ready?','<p>Published articles are reviewed against the current product. Draft articles are clearly labelled and should be confirmed with support before being used as an operating procedure.</p>'],
  ]},
  'link-calendar': {title:'Edit availability in the calendar',group:'RevioLink · Calendar',section:'link',lead:'Change inventory for the exact room type and dates you mean to sell.',next:'link-restrictions',navGroup:'Calendar',sections:[
    ['scope','Choose the correct scope','<p>Confirm the property, date range, room type and active rate plan before editing. A calendar cell represents a specific combination, not a generic “standard” value.</p>'],
    ['edit','Make a controlled change','<ol class="steps"><li><strong>Select the dates</strong><p>Use the smallest range that expresses the hotel’s decision.</p></li><li><strong>Enter a valid value</strong><p>Keep rates in integer minor units and check the currency shown by the property.</p></li><li><strong>Save and read the result</strong><p>Stay on the calendar long enough to confirm the saved row and any warning returned by the channel.</p></li></ol>'],
    ['verify','Verify delivery','<p>Compare the saved value with the channel after the normal delivery window. A successful save is not the same as an accepted OTA update.</p>'],
  ]},
  'link-restrictions': {title:'Apply booking restrictions',group:'RevioLink · Calendar',section:'link',lead:'Use minimum stay, closed-to-arrival and stop-sell rules without hiding their scope.',next:'link-connections',navGroup:'Calendar',sections:[
    ['meaning','Know what each restriction means','<p>Minimum length of stay limits the number of nights. Closed to arrival and closed to departure limit the start or end date. Stop sell prevents the product being sold. They are not interchangeable.</p>'],
    ['scope','Check room and plan scope','<p>A restriction may apply to the room type or to one rate plan. If plans differ, review the plan-specific rows instead of assuming that the room-level value covers every offer.</p>'],
    ['channel','Expect channel differences','<p>Channels do not all support the same restrictions. Read the channel limitation or warning and document the intended fallback with the hotel.</p>'],
  ]},
  'link-connections': {title:'Connect a booking channel',group:'RevioLink · Connections',section:'link',lead:'Prepare a channel connection with ownership and mapping agreed first.',next:'link-audit',navGroup:'Connections',sections:[
    ['before','Before connecting','<p>Confirm the channel account, property identifier, room types, active rate plans and the system that owns rates and inventory.</p>'],
    ['map','Map before you sell','<p>Complete the room and rate mapping and test a known date. Do not activate a paid channel until the hotel has reviewed the mapping and agreed the cutover.</p>'],
    ['observe','Observe the first delivery','<p>Watch the activity feed, warnings and audit trail after the first push. A green connection indicator is only one part of the check.</p>'],
  ]},
  'link-audit': {title:'Use the delivery audit trail',group:'RevioLink · Troubleshooting',section:'link',lead:'Keep a traceable explanation of what changed and what the channel accepted.',next:'link-sync',navGroup:'Troubleshooting',sections:[
    ['activity','Activity is the timeline','<p>Use the activity feed to understand when a push or pull occurred and which property and channel it concerned.</p>'],
    ['errors','Errors need an owner','<p>Move from the error counter to the detailed entry. Record the affected room, rate, dates and next action instead of clearing the counter without a resolution.</p>'],
    ['audit','Audit is the record','<p>Use the audit log when you need to explain who changed a value or when a mapping was updated. Treat it as evidence, not as a replacement for a live channel check.</p>'],
  ]},
  'crs-rates': {title:'Create and review rate plans',group:'RevioCRS · Rates',section:'crs',lead:'Make the commercial rules behind a price explicit.',next:'crs-availability',navGroup:'Configuration',sections:[
    ['model','Define the offer','<p>Give each rate plan a clear name, cancellation conditions, meal inclusion and active status. Similar display names are not enough when a hotel has several room types.</p>'],
    ['price','Review the price logic','<p>Check whether the plan is manual or derived and which room type it belongs to. Compare a known date, occupancy and currency before publishing.</p>'],
    ['change','Change deliberately','<p>When a rate plan changes, note whether existing reservations keep their original terms. Communicate the change before pushing it to channels.</p>'],
  ]},
  'crs-availability': {title:'Review availability and restrictions',group:'RevioCRS · Inventory',section:'crs',lead:'See what can be sold before a guest or channel receives a price.',next:'crs-reports',navGroup:'Inventory',sections:[
    ['inputs','Read the inputs together','<p>Availability depends on room type, physical inventory, reservations, holds, out-of-order rooms and the stay dates. One empty room tile is not a complete availability calculation.</p>'],
    ['holds','Account for temporary holds','<p>A hold reserves inventory for a limited time. Check its expiry and status before concluding that a room is permanently unavailable.</p>'],
    ['publish','Publish after review','<p>Compare CRS availability with Direct and a connected channel for the same dates. Investigate differences before changing multiple systems.</p>'],
  ]},
  'crs-reports': {title:'Use CRS reports',group:'RevioCRS · Reporting',section:'crs',lead:'Turn reservation activity into a reviewable operational picture.',next:'crs-guests',navGroup:'Reporting',sections:[
    ['question','Start with a question','<p>Choose whether you need occupancy, production, cancellations, pickup or guest information. A report is useful when its date range and property scope are explicit.</p>'],
    ['filters','Make filters visible','<p>Record arrival dates, booking dates, room type, rate plan and status filters used for the report. This makes a repeated report comparable.</p>'],
    ['export','Export safely','<p>Use the export capability for an authorised business purpose. Remove unnecessary guest fields before sharing a file outside the hotel team.</p>'],
  ]},
  'crs-guests': {title:'Manage guest profiles',group:'RevioCRS · Guests',section:'crs',lead:'Keep guest information useful, accurate and appropriately protected.',next:'crs-waitlist',navGroup:'Guests',sections:[
    ['identity','Separate identity from a booking','<p>A guest profile can be reused, while a reservation describes one stay. Review the reservation context before changing a shared profile.</p>'],
    ['contact','Check contact channels','<p>Keep a guest’s direct email and phone distinguishable from an OTA relay address. Use the channel-provided address only for the purpose it supports.</p>'],
    ['privacy','Share the minimum','<p>Export or disclose only the fields needed for the task. Do not place identity documents, card numbers or secrets into notes or screenshots.</p>'],
  ]},
  'crs-waitlist': {title:'Handle a waitlist request',group:'RevioCRS · Bookings',section:'crs',lead:'Keep a request visible without treating it as confirmed inventory.',next:'crs-reservations',navGroup:'Bookings',sections:[
    ['request','Record the request','<p>Capture the requested dates, room type, occupancy and a reliable contact. A waitlist entry is a request, not a reservation or a hold.</p>'],
    ['review','Review changes','<p>When inventory opens, recalculate the price and conditions for the requested dates. Do not promise the original offer if the rate plan has changed.</p>'],
    ['convert','Convert intentionally','<p>Only a confirmed booking should consume inventory. Check for an existing reservation before converting a waitlist request.</p>'],
  ]},
  'pms-front-desk': {title:'Run arrivals and departures',group:'RevioPMS · Front desk',section:'pms',lead:'Keep the operational stay aligned with the reservation.',next:'pms-rooms',navGroup:'Front desk',sections:[
    ['arrivals','Prepare arrivals','<p>Review today’s arrivals, payment or guarantee state, room readiness and special requests before assigning a physical room.</p>'],
    ['checkin','Check in carefully','<p>Confirm the guest and reservation, then record the actual room assignment. A room type on the reservation is not the same as a physical room number.</p>'],
    ['departures','Close departures','<p>Confirm the folio, payment status and departure details. A checked-out room still needs housekeeping and inspection before it can be sold again.</p>'],
  ]},
  'pms-rooms': {title:'Manage rooms and inventory',group:'RevioPMS · Property',section:'pms',lead:'Keep physical rooms, room types and sellable inventory in agreement.',next:'pms-maintenance',navGroup:'Property',sections:[
    ['types','Room type is the sellable unit','<p>Room types describe what a guest books. Physical rooms are the operational units assigned to a stay. Keep both names and capacities clear.</p>'],
    ['status','Use the right status','<p>Vacant, dirty, inspected, occupied and out of order answer different questions. Do not mark a room ready to hide a maintenance issue.</p>'],
    ['check','Check the consequence','<p>After a room status or inventory change, review the effect on arrivals and connected availability. Operations and distribution should agree before the hotel sells the room.</p>'],
  ]},
  'pms-maintenance': {title:'Record maintenance work',group:'RevioPMS · Operations',section:'pms',lead:'Make an unavailable room explainable and recoverable.',next:'pms-close-day',navGroup:'Operations',sections:[
    ['ticket','Describe the issue','<p>Record the room, problem, priority and person responsible. “Out of order” is an inventory consequence, not a maintenance description.</p>'],
    ['followup','Keep the follow-up visible','<p>Update the task when work starts, when it is inspected and when the room returns to service. Avoid closing a task because the room is needed for an arrival.</p>'],
    ['restore','Restore after inspection','<p>Only return the room to sellable status after the hotel’s inspection is complete, then verify the resulting availability.</p>'],
  ]},
  'pms-close-day': {title:'Prepare for close of day',group:'RevioPMS · Operations',section:'pms',lead:'Finish the operating day with a clear, reviewable handover.',next:'pms-readiness',navGroup:'Operations',review:'Code checked · UI review pending',sections:[
    ['reconcile','Reconcile the basics','<p>Review arrivals, departures, in-house stays, open folios, payments and unresolved room tasks before closing the day.</p>'],
    ['exceptions','Resolve exceptions','<p>Record why a folio, room or reservation remains open. Closing a day should surface an exception, not make it disappear.</p>'],
    ['handover','Leave a handover','<p>Note the next operating date, outstanding tasks and the person responsible. A close-of-day result should be understandable to the next shift.</p>'],
  ]},
  'direct-branding': {title:'Prepare the direct booking brand',group:'RevioDirect · Content',section:'direct',lead:'Make the guest-facing page look like the hotel before sending traffic to it.',next:'direct-booking-flow',navGroup:'Content',sections:[
    ['identity','Use approved identity','<p>Check the hotel name, logo, colours, contact details and destination links. Keep placeholder artwork out of a guest-facing launch.</p>'],
    ['rooms','Describe what is sold','<p>Room names, capacities, amenities, images and policies should match the offer configured in CRS. Do not promise an amenity that the property has not approved.</p>'],
    ['mobile','Review the small screen','<p>Check the page on a phone: navigation, room cards, date selection, errors and confirmation must remain readable without accidental horizontal scrolling.</p>'],
  ]},
  'direct-booking-flow': {title:'Test the direct booking flow',group:'RevioDirect · Guest journey',section:'direct',lead:'Test the path a guest takes from dates to confirmation.',next:'direct-checklist',navGroup:'Guest journey',sections:[
    ['search','Search for a real scenario','<p>Use an approved test property and known dates. Check an available stay, an unavailable stay and a changed guest count.</p>'],
    ['validate','Check validation','<p>Leave required fields empty, use an invalid value and recover from an error. The message should explain what the guest can do next without exposing internal details.</p>'],
    ['confirm','Check the result','<p>Confirm the reference, dates, guest details and price in the resulting reservation. If payment is enabled, test mode and live mode must be treated as different environments.</p>'],
  ]},
  'integration-channex': {title:'Channel connection principles',group:'Integrations · RevioLink',section:'integrations',lead:'Keep distribution reliable when one hotel sells through several channels.',next:'integration-stripe-test',navGroup:'Connectors',review:'Code checked · Content review pending',sections:[
    ['mapping','Map each room and rate','<p>A Channex rate plan belongs to one room type. A hotel with three room types needs the matching plan for each room type, even when the display name is identical.</p>'],
    ['warnings','Read warnings inside success','<p>An HTTP success response can still contain a channel rejection in its warnings. Treat the warning as part of the outcome and show it to the operator.</p>'],
    ['reconcile','Reconcile bookings','<p>When a booking cannot be mapped, keep the failure visible and recoverable. Do not acknowledge a rejected revision as if it were imported successfully.</p>'],
  ]},
  'integration-stripe-test': {title:'Use Stripe test mode safely',group:'Integrations · Payments',section:'integrations',lead:'Validate payment and invoice flows without touching live funds.',next:'integration-imports',navGroup:'Payments',sections:[
    ['mode','Confirm the environment','<p>This documentation preview assumes test-mode payments. Test keys, test products and test webhooks must remain separate from any live configuration.</p>'],
    ['checkout','Test the customer path','<p>Use Stripe’s test cards to exercise success, decline, refund and duplicate-submit paths. Never paste a card number or secret key into this documentation.</p>'],
    ['invoice','Keep responsibilities clear','<p>Payment collection and the hotel’s invoice presentation are related but different concerns. Confirm which system is the source of the customer-facing document before launch.</p>'],
  ]},
  'integration-imports': {title:'Plan imports and exports',group:'Integrations · Data movement',section:'integrations',lead:'Move a clean snapshot between systems without creating a second source of truth.',next:'integration-webhooks',navGroup:'Data movement',sections:[
    ['snapshot','Treat an import as a snapshot','<p>Import and export move a point-in-time set of data. They do not automatically create an ongoing synchronization.</p>'],
    ['mapping','Map before loading','<p>Match property, room type, rate plan, tax and policy identifiers before importing reservations. Preserve the original reference so the result can be reconciled.</p>'],
    ['dryrun','Preview the effect','<p>Use a dry run or a test property where available. Count created, updated, skipped and failed records and resolve failures before a cutover.</p>'],
  ]},
  'integration-webhooks': {title:'Design reliable webhooks',group:'Integrations · Developer resources',section:'integrations',lead:'Make external events safe to retry and easy to investigate.',next:'api',navGroup:'Developer resources',sections:[
    ['contract','Document the contract','<p>Describe the event name, payload, identifier, timestamp and version. Examples must use dummy identifiers and current field names.</p>'],
    ['delivery','Expect retries','<p>Consumers should verify the signature, acknowledge quickly and handle duplicate delivery. A timeout is not proof that the event was never processed.</p>'],
    ['observe','Make failures visible','<p>Record delivery attempts and a safe error reason. Do not include secrets or full guest data in logs sent to an external provider.</p>'],
  ]},
  'platform-dashboard': {title:'Read the hotel dashboard',group:'Platform · Overview',section:'platform',lead:'Start each day with the numbers and exceptions that need attention.',next:'platform-accounts',navGroup:'Overview',sections:[
    ['purpose','What the dashboard is for','<p>The dashboard is a starting point for a property team: today’s arrivals and departures, occupancy signals, outstanding work and the health of connected products.</p>'],
    ['widgets','Read a number in context','<p>Every metric needs a property, date range and timezone. A quiet widget may mean there is no activity, a filter is active or the user lacks access to its underlying data.</p>'],
    ['action','Move from signal to action','<p>Use the linked reservation, operations, sync or analytics view to investigate. The dashboard is a summary, not a replacement for the underlying record.</p>'],
  ]},
  'platform-accounts': {title:'Manage companies and properties',group:'Platform · Workspace',section:'platform',lead:'Keep company ownership and hotel-level work clearly separated.',next:'platform-roles',navGroup:'Workspace',sections:[
    ['model','Company and property','<p>A company can own or operate one or more properties. Property data, staff access and integrations must be scoped to the hotel they belong to.</p>'],
    ['switch','Check your active property','<p>Before changing rates, rooms, bookings or settings, confirm the property in the current workspace. Similar hotel names are not a safe identifier.</p>'],
    ['growth','Add another property carefully','<p>Adding a property should create a clean scope, not a copy that silently shares inventory or reservations. Review rooms, currencies, policies and permissions independently.</p>'],
  ]},
  'platform-lists': {title:'Use lists, filters and search',group:'Platform · Workspace',section:'platform',lead:'Find the record you need without losing its property or status context.',next:'platform-roles',navGroup:'Workspace',sections:[
    ['list','Start with the right list','<p>Reservations, guests, rooms, channels and financial records have different lists. Open the list owned by the workflow instead of searching a broad result and guessing what it represents.</p>'],
    ['filter','Make filters visible','<p>Keep property, dates, status, room type, channel and payment state in view while you work. A filtered list is not the same as the complete record set.</p>'],
    ['result','Open the record before acting','<p>Use the stable reference and current status to confirm the result. If two records look alike, compare their property and dates before editing or exporting either one.</p>'],
  ]},
  'platform-roles': {title:'Accounts, teams and permissions',group:'Platform · Workspace',section:'platform',lead:'Give staff the access needed for their role and protect sensitive areas.',next:'platform-billing',navGroup:'Workspace',sections:[
    ['roles','Use role-based access','<p>Separate daily hotel operations from configuration, billing, integrations and company administration. Access should be granted to a named person and reviewed when responsibilities change.</p>'],
    ['sensitive','Protect sensitive areas','<p>Payment configuration, guest exports, API credentials and company billing require a smaller audience than housekeeping or reservation lookup.</p>'],
    ['trace','Keep actions attributable','<p>Shared logins make an operational record difficult to trust. Use individual accounts and retain the audit trail for important changes.</p>'],
  ]},
  'platform-billing': {title:'Billing and subscriptions',group:'Platform · Billing',section:'platform',lead:'Separate the hotel’s customer billing from the operations team’s folios.',next:'platform-payments',navGroup:'Billing',sections:[
    ['scope','Know which bill you are viewing','<p>Platform subscription billing describes the hotel’s relationship with Revio. A guest folio describes one stay. They must not be merged into one ambiguous invoice.</p>'],
    ['plans','Review a plan change','<p>Before changing a subscription, check the property, product entitlement, currency, effective date and whether an existing invoice or payment is open.</p>'],
    ['invoice','Keep invoice history clear','<p>Every invoice should show its issuer, customer, line items, tax treatment, currency, status and payment reference without exposing payment credentials.</p>'],
  ]},
  'platform-payments': {title:'Payments and payment methods',group:'Platform · Payments',section:'platform',lead:'Collect money safely while keeping the hotel’s accounting record understandable.',next:'platform-analytics',navGroup:'Payments',sections:[
    ['provider','Know the payment provider','<p>Confirm whether the current flow is test or live mode, which provider owns the checkout and where the resulting payment status is recorded.</p>'],
    ['methods','Keep card data out of Revio','<p>Store only gateway references and non-sensitive display details such as brand and last four digits. Never write a full card number into a reservation, note or export.</p>'],
    ['reconcile','Reconcile the outcome','<p>Match checkout result, payment status, invoice and reservation reference. A browser success page alone is not proof that money was captured.</p>'],
  ]},
  'platform-analytics': {title:'Analytics and reports',group:'Platform · Analytics',section:'platform',lead:'Turn hotel activity into decisions without hiding the assumptions.',next:'platform-activity',navGroup:'Analytics',sections:[
    ['question','Start with a business question','<p>Choose whether you need occupancy, pickup, revenue, channel performance, housekeeping workload or product usage. Different questions need different time windows.</p>'],
    ['filters','Make the scope explicit','<p>Record property, date range, timezone, room type, channel and status filters. A number without its scope cannot be compared safely.</p>'],
    ['export','Share the smallest useful file','<p>Use exports for an authorised purpose and remove guest fields that are not needed. Keep the report definition with the exported result.</p>'],
  ]},
  'platform-activity': {title:'Activity, events and audit history',group:'Platform · Governance',section:'platform',lead:'Understand what happened, when it happened and who needs to act.',next:'platform-settings',navGroup:'Governance',sections:[
    ['activity','Activity is the operational timeline','<p>Use activity to follow reservations, housekeeping work, payments and connection events in the order they occurred.</p>'],
    ['events','Events explain system changes','<p>An event records a meaningful transition, such as a reservation confirmed or a channel update rejected. It should carry a stable reference and safe detail.</p>'],
    ['audit','Audit history is evidence','<p>Use the audit trail to answer who changed a setting, mapping or financial value. Do not edit history to make a failed operation look successful.</p>'],
  ]},
  'platform-settings': {title:'Settings, notifications and security',group:'Platform · Configuration',section:'platform',lead:'Keep configuration discoverable without making sensitive controls easy to misuse.',next:'platform-dashboard',navGroup:'Configuration',sections:[
    ['organise','Organise by responsibility','<p>Group property identity, rooms and rates, taxes and policies, users, notifications, integrations and billing so a team knows where a decision belongs.</p>'],
    ['change','Change one setting at a time','<p>Record the old value, new value, reason and approver for a consequential change. Re-check the affected product after saving.</p>'],
    ['secure','Protect the control plane','<p>Use strong authentication, least-privilege roles, secure secret storage and a reviewable audit trail. Security guidance is internal and must never be replaced by a screenshot.</p>'],
  ]},
};
