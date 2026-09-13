// Local design preview only. No backend, customer data, or unpublished API contracts.
const iconPaths={
 introduction:'<path d="m12 3 9 9-9 9-9-9Z"/><path d="m8 12 4-4 4 4-4 4Z"/>',
 concepts:'<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4Z"/><path d="M13 7a3 3 0 0 1 3-3h5v15h-5a4 4 0 0 0-3 2"/>',
 platform:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 'platform-dashboard':'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 'platform-accounts':'<path d="M3 21h18M5 21V5l7-3 7 3v16M9 21v-5h6v5M8 8h1m6 0h1M8 11h1m6 0h1"/>',
 'platform-lists':'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 'platform-roles':'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 1 2 5.3M17 17h1a3 3 0 0 1 3 3"/>',
 'platform-billing':'<path d="M5 3h14v18l-7-3-7 3Z"/><path d="M8 8h8M8 12h6"/>',
 'platform-payments':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
 'platform-analytics':'<path d="M4 19V5m0 14h17M8 16v-4m4 4V8m4 8v-7m4 7V4"/>',
 'platform-activity':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 'platform-settings':'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6v-2.6h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L9 6.6l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V5h2.6v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v2.6h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
 link:'<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
 crs:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
 pms:'<path d="M4 21V5l8-3 8 3v16M2 21h20M9 21v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1"/>',
 direct:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18m-9 4 4 3-4 3"/>',
 integrations:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h6a3 3 0 0 1 3 3v6M6 9v6a3 3 0 0 0 3 3h6"/>',
 api:'<path d="m7 6-6 6 6 6m10-12 6 6-6 6m-3-15-4 18"/>',
 updates:'<path d="M3 11a9 9 0 1 1 3 8M3 4v7h7m2-4v5l3 2"/>'
};
const icon=id=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[id]||iconPaths.concepts}</svg>`;
const section = (id, title, body) => `<section aria-labelledby="${id}"><h2 id="${id}">${title}</h2>${body}</section>`;
const note = (title, body) => `<div class="callout"><span class="symbol" aria-hidden="true">ⓘ</span><div><strong>${title}</strong><p>${body}</p></div></div>`;
const link = (id, label) => `<a class="inline-link" href="?page=${id}">${label}</a>`;
const cards = `<div class="cards">${[
  ['platform-dashboard','◈','Platform foundations','Dashboards, companies, accounts, billing, payments, analytics and settings.'],
  ['link','⇄','RevioLink','Keep your room availability and rates connected to your booking channels.'],
  ['crs','▦','RevioCRS','Manage reservations, rate plans and guest information in one place.'],
  ['pms','⌂','RevioPMS','Bring your front desk, housekeeping and daily operations together.'],
  ['direct','↗','RevioDirect','Give guests a direct path from your hotel website to a reservation.'],
].map(([id, icon, title, desc])=>`<a class="card" href="?page=${id}"><span class="card-icon" aria-hidden="true">${icon}</span><span class="arrow" aria-hidden="true">↗</span><h3>${title}</h3><p>${desc}</p></a>`).join('')}</div>`;
const platformCards = `<div class="cards">${[
  ['platform-dashboard','▦','Dashboard','Start with today’s arrivals, exceptions and connected-product health.'],
  ['platform-accounts','⌂','Companies & properties','Keep ownership, property scope and workspace context explicit.'],
  ['platform-lists','≡','Lists & search','Find reservations, guests, rooms and financial records safely.'],
  ['platform-roles','◉','Accounts & permissions','Give each team member the access their role requires.'],
  ['platform-billing','▤','Billing & subscriptions','Understand platform invoices separately from guest folios.'],
  ['platform-payments','€','Payments','Reconcile provider status, invoice state and reservation references.'],
  ['platform-analytics','⌁','Analytics & reports','Turn occupancy, pickup, revenue and operations into decisions.'],
  ['platform-activity','◷','Activity & events','Follow changes, warnings and audit history with a stable reference.'],
  ['platform-settings','⚙','Settings & security','Keep property configuration and sensitive controls discoverable.'],
].map(([id, icon, title, desc])=>`<a class="card" href="?page=${id}"><span class="card-icon" aria-hidden="true">${icon}</span><span class="arrow" aria-hidden="true">↗</span><h3>${title}</h3><p>${desc}</p></a>`).join('')}</div>`;
const pages = {
  introduction: {title:'Welcome to Revio', group:'Getting started', section:'guides', lead:'Everything you need to understand your platform, connect your products and run your hotel with confidence.', body:
    `<p class="intro">Start with the essentials, explore your product, or find the answer to a specific question. This is your guide to how Revio works together.</p>`+
    note('One hotel. One shared foundation.','Revio products share core hotel data. Adding another Revio product does not mean creating your property or reservations all over again.')+
    section('products','Find your workspace',cards)+
    section('start','A good place to start',`<ol class="steps"><li><strong>Get to know the platform</strong><p>Understand how ${link('concepts','room types, rate plans and reservations')} fit together.</p></li><li><strong>Explore your daily workspace</strong><p>Choose your product above to see where each part of hotel work belongs.</p></li><li><strong>Understand your connections</strong><p>Learn the difference between ${link('integrations','a shared product and an external integration')}.</p></li></ol>`)+
    section('together','Better together, without duplicate work',`<p>RevioLink handles channel distribution. RevioCRS manages the commercial reservation workflow. RevioPMS supports operations at the property. RevioDirect provides the guest-facing booking experience, configured through CRS.</p>`)+
    section('model','One workflow, different workspaces',`<p>Think of a stay as one shared record moving through several jobs. A guest searches on Direct, the commercial terms are resolved by CRS, Link distributes the sellable inventory and PMS turns the reservation into an operational stay.</p><p>The same separation helps when something looks wrong: first identify which product owns the decision, then follow the record to the product that displays or delivers it.</p>`)+
    section('about','About this documentation',`<p>This preview shows the planned information architecture across setup, product workflows, integrations and the future API reference. Articles are intentionally labelled by review status and will be checked against the current product before publication.</p>`), next:'concepts'},
  concepts:{title:'The essentials',group:'Getting started',section:'guides',lead:'A few shared concepts make every Revio product easier to understand.',body:
    section('property','Your property',`<p>The hotel is the shared context for rooms, rates, guests and reservations. Product access determines which workspaces are available; it does not create separate copies of the hotel.</p>`)+
    section('rooms','Room types and physical rooms',`<p>A room type describes what a guest can book, such as a Double Room. A physical room is the individual space assigned during operations, such as room 204.</p>`)+
    section('inventory','Availability is date-specific',`<p>Sellable availability is calculated for a room type and stay dates. Reservations, temporary holds, out-of-order rooms, restrictions and the property’s inventory all contribute to the result.</p><p>That is why a physical room that looks empty is not automatically a room that can be sold for every arrival date.</p>`)+
    section('rates','Rate plans',`<p>A rate plan describes how a stay is sold. Keep the room type, dates and applicable conditions in view when comparing rates between systems.</p><p>Cancellation rules, inclusions and derived pricing are part of the offer. A matching display name does not prove that two plans are equivalent.</p>`)+
    section('reservation','Reservations',`<p>The commercial booking and the operational stay are connected. Products support different parts of that same workflow rather than independent reservation lists.</p><p>A hold, a confirmed reservation, a checked-in stay and a checked-out folio are different states. Always read the status before acting.</p>`)+
    section('money','Money and tax context',`<p>Money is stored as integer minor units together with an ISO currency code. Taxes and fees should keep their own labels and remain traceable to the property rules that produced them.</p>`),next:'link'},
  link:{title:'RevioLink',group:'Products',section:'guides',lead:'Your connection between hotel inventory and online booking channels.',body:
    section('overview','What RevioLink does',`<p>RevioLink is the channel manager. Its role is to distribute availability, rates and restrictions and receive channel reservation updates.</p>`)+
    section('mapping','Room and rate mapping',`<p>A connection needs the correct room types and rate plans on both sides. Rate-plan mapping is specific to the room type; matching a plan name alone is not enough.</p>`)+
    note('A successful request is not the whole story','Channel responses can contain warnings. Mapping and the actual result at the channel must be considered alongside delivery status.')+
    section('ownership','Where pricing is managed',`<p>When connected to CRS, the pricing model belongs to CRS. In a standalone Link setup, Link owns it. This avoids the products disagreeing about whether prices are per room or per person.</p>`)+
    section('delivery','From edit to channel',`<p>A calendar edit is saved to the hotel’s inventory first, then translated into the destination channel’s contract. The destination may accept, warn about or reject part of that update.</p><p>Read the recorded outcome and warning detail, then verify the actual channel value for the same room, rate plan and dates.</p>`)+
    section('recovery','When delivery differs',`<p>Keep the original decision visible while investigating. Check mapping, active status, channel capability and the last recorded outcome before sending another update.</p><p>If a reservation cannot be mapped, preserve its reference and escalate it as a recoverable exception rather than guessing a substitute product.</p>`)+
    section('connections','External connections',`<p>Using Link with a third-party PMS or CRS requires a supported connection and a clear ownership model. See ${link('integrations','integration concepts')}.</p>`),next:'crs'},
  crs:{title:'RevioCRS',group:'Products',section:'guides',lead:'The central workspace for reservations, rates and guest information.',body:
    section('overview','A commercial source of truth',`<p>CRS brings together the reservation workflow, rate plans, guest records and reporting. Connected products build on the same hotel data.</p>`)+
    section('guests','Guest information',`<p>A guest profile brings contact information together. OTA-provided relay addresses need to remain distinguishable from a guest’s direct contact details.</p>`)+
    section('distribution','Distribution and direct bookings',`<p>RevioLink handles channel distribution. The guest-facing RevioDirect booking experience is configured from CRS.</p>`)+
    section('lifecycle','A reservation has a lifecycle',`<p>Start with search and availability, move through a hold or booking attempt, then confirm the reservation and its commercial terms. Later changes, cancellations, no-shows and departures must preserve the history of what was agreed.</p><p>When a result is uncertain, search for the existing reference before repeating the action.</p>`)+
    section('rates','Rates, restrictions and guest context',`<p>CRS brings the room type, rate plan, dates, occupancy, policies and guest information into one commercial view. This is the context that downstream products need in order to display or deliver a stay correctly.</p>`)+
    section('reports','Reports answer a scoped question',`<p>Use a report to answer a defined question about pickup, occupancy, production, cancellations or guests. Keep the property, date range, timezone and status filters with the result.</p>`)+
    section('operations','Adding PMS',`<p>Adding RevioPMS opens operational workflows for the same hotel. It should not require exporting and re-importing your reservations. The reservation remains the commercial reference while PMS records the work around the stay.</p>`),next:'pms'},
  pms:{title:'RevioPMS',group:'Products',section:'guides',lead:'A connected workspace for the people running your property every day.',body:
    section('desk','Front desk',`<p>PMS supports operational work around arrivals, stays and departures. A physical room assignment is distinct from the room type originally booked.</p>`)+
    section('housekeeping','Housekeeping and maintenance',`<p>Room readiness and maintenance work belong in the operational workspace. Clear status and responsibility help the team understand what is ready and what needs attention.</p>`)+
    section('folios','Guest folios',`<p>Folios bring stay charges and recorded payments together. Hotel guest billing is separate from the hotel’s subscription to Revio.</p>`)+
    section('day','The property day is a sequence',`<p>Arrivals, check-ins, in-house work, departures, housekeeping and maintenance produce a changing operational picture. Each team should be able to see what is pending without rewriting the reservation.</p><p>Use the status that describes the real condition of the room or folio, not a status that merely makes the queue look clear.</p>`)+
    section('exceptions','Exceptions need a handover',`<p>A missing payment, unresolved maintenance issue, room move or late departure should remain visible with an owner and next action. Closing the day is a review of exceptions, not a way to hide them.</p>`)+
    section('shared','Connected to reservations',`<p>With RevioCRS, PMS works on shared records. A third-party CRS needs a supported integration rather than a second, independently edited booking copy.</p>`),next:'direct'},
  direct:{title:'RevioDirect',group:'Products',section:'guides',lead:'The guest-facing booking experience for your hotel.',body:
    section('overview','Direct reservations',`<p>RevioDirect provides the public booking surface. Guests explore availability and select their stay, while configuration is managed from CRS.</p>`)+
    section('shared','Connected availability',`<p>Direct booking uses the platform’s inventory foundation rather than a separate room stock. Reservation confirmation must safely convert availability into a booking.</p>`)+
    section('journey','The guest journey',`<p>A guest chooses dates and occupancy, compares room and rate options, enters the required details and receives a confirmation. Every step should keep the selected property, dates, price and conditions visible.</p><p>Validation messages should explain how to recover without exposing internal errors or making the guest repeat a successful payment or booking.</p>`)+
    section('content','Content has an owner',`<p>Room names, descriptions, amenities, images, policies and contact details need an approved source. RevioDirect presents that content; CRS remains the place where the commercial offer is configured.</p>`)+
    section('review','Before publishing',`<p>Review property content, room descriptions, images, policies and the full guest flow. Test validation and unavailable dates as well as the successful booking path.</p>`)+
    note('Payment methods depend on the property setup','This preview does not advertise specific payment methods or make real payments. Those details must be checked against the active configuration.'),next:'integrations'},
  platform:{title:'Platform',group:'Platform',section:'platform',lead:'The shared workspace around your hotel, its people and its commercial activity.',body:
    section('areas','Everything around the hotel',platformCards)+
    section('workflow','How the areas connect',`<p>Start with the dashboard, open the list or report that answers the question, then follow the record into CRS, PMS, Link or Direct. Billing and payment status should always be reconciled against the reservation or folio they belong to.</p>`)+
    section('boundaries','A clear boundary for internal operations',`<p>Operator tools for tenant support, provisioning and platform administration are documented separately and are not part of the public hotel workspace.</p>`)+
    note('One source, many views','The same property, reservation and guest context should be traceable across the products. A summary page is a starting point, not a second copy of the record.'),next:'platform-dashboard'},
  integrations:{title:'How integrations fit together',group:'Integrations',section:'integrations',lead:'Shared products, one-time imports and ongoing synchronization are different things.',body:
    section('shared','Between Revio products',`<p>Products share the same foundation. Activating an additional product is not a data migration.</p>`)+
    section('external','With another provider',`<p>A third-party PMS, CRS or channel manager needs a supported connector. Each connection must define ownership, supported events and how errors are reconciled.</p>`)+
    section('terms','Three useful distinctions',`<div class="table-wrap"><table><thead><tr><th>Concept</th><th>Purpose</th></tr></thead><tbody><tr><td>Import / export</td><td>Move a snapshot of data between systems.</td></tr><tr><td>Mapping</td><td>Match each external room type or rate plan to its Revio equivalent.</td></tr><tr><td>Synchronization</td><td>Keep agreed changes flowing between systems over time.</td></tr></tbody></table></div>`)+
    section('scope','Agree on the scope first',`<p>Decide who owns rates, inventory and reservations before enabling writes. Import support alone does not mean a provider is supported for live synchronization.</p>`)+
    section('ownership','Every field needs an owner',`<p>For each connection, write down which system owns rates, availability, reservations, guest contact details, payment status and content. A connector should move an agreed change, not create a second authority.</p>`)+
    section('retries','Retries must be safe',`<p>Network timeouts and duplicate events are normal integration conditions. Use stable identifiers, idempotent processing and a visible reconciliation path so retrying does not create a second reservation or payment.</p>`)+
    section('security','Integration security',`<p>Keep credentials in the configured secret store, restrict access by role and log safe references rather than raw keys or card data. Internal routes are not public API contracts.</p>`)+
    note('Connector availability must be confirmed','The combinations described here explain the architecture. They are not a list of released third-party integrations.'),next:'api'},
  api:{title:'API reference',group:'Developer resources',section:'api',lead:'A dedicated home for reviewed integration contracts.',body:
    note('Planned documentation','This is a design preview, not a published Revio public API contract. No endpoints, keys or rate limits are promised here.')+
    section('contract','What belongs here',`<p>Once approved and implemented, each endpoint should document authentication, permissions, request fields, responses, errors and realistic examples.</p>`)+
    section('auth','Authentication and scope',`<p>Every public contract should explain how a client authenticates, which property or company it can access and which role is required. A credential must never grant a wider scope than the integration needs.</p>`)+
    section('events','Events and webhooks',`<p>Event documentation should explain signatures, retries, duplicate delivery and versioning. Examples must follow the actual implementation.</p>`)+
    section('versioning','Versioning and compatibility',`<p>Document the version of the contract, required fields, additive changes and deprecations. A client should be able to tell whether a response changed because of its requested version or because the data changed.</p>`)+
    section('safety','Safe examples',`<p>Documentation examples must use dummy identifiers and no real guest information or secret keys. Internal routes are not automatically public integration endpoints.</p>`)+
    section('testing','Test without customer data',`<p>Use a test property and synthetic guests when demonstrating requests. A successful test response proves only that the test contract worked; it does not authorize a live write.</p>`),next:'updates'},
  updates:{title:'Documentation updates',group:'What’s new',section:'updates',lead:'A clear record of changes to this documentation preview.',body:
    section('preview','12 September 2026',`<h3>Expanded product documentation preview <span class="pill">Preview</span></h3><p>Product-specific top navigation, grouped sidebars and a broader set of task-guide drafts added across RevioLink, RevioCRS, RevioPMS, RevioDirect and Integrations. A three-column reading layout, search, status labels, light and dark themes, and a clear next-article path are included.</p>`)+
    section('scope','What this update does not change',`<p>No customer product screens, data, payment configuration or production services have been changed by this preview.</p>`)+
    section('status','How an article becomes trustworthy',`<p>Draft means the wording is proposed. Code checked means the source was compared. UI verified means the current screen was exercised. Published means the article passed the content, accessibility and release review.</p>`)+
    section('next','Next for the documentation',`<p>Review the design, verify task guides against the products, add approved screenshots and then maintain the published service from versioned content.</p>`),next:'introduction'}
};
for (const [id, draft] of Object.entries(window.REVIO_DOCS_DRAFTS || {})) {
  const navGroup=draft.navGroup || (draft.group.includes('·') ? draft.group.split('·').slice(1).join('·').trim() : 'Guides');
  pages[id] = {...draft, navGroup, body:draft.sections.map(([id,title,body])=>section(id,title,body)).join('')};
}
pages.introduction.navGroup='Overview';
pages.concepts.navGroup='Overview';
pages.platform.navGroup='Overview';
for (const product of ['link','crs','pms','direct']) { pages[product].section=product; pages[product].navGroup='Overview'; }
pages.api.section='api';
pages.api.navGroup='Reference';
pages.updates.navGroup='Changelog';
const collections = [
  ['guides','Start here','introduction'], ['platform','Platform','platform'], ['link','RevioLink','link'],
  ['crs','RevioCRS','crs'], ['pms','RevioPMS','pms'], ['direct','RevioDirect','direct'],
  ['integrations','Integrations','integrations'], ['api','API reference','api'], ['updates','Updates','updates']
];
document.querySelector('.top-nav').innerHTML=collections.map(([id,title,page])=>`<a href="?page=${page}" data-section="${id}">${title}</a>`).join('');
const article=document.querySelector('#article');
document.querySelector('.brand').innerHTML='<span class="logo-crop"><img class="logo-white" src="assets/revio-white.png" alt="Revio"><img class="logo-dark" src="assets/revio-dark.png" alt="Revio"></span><span class="docs-label">docs</span>';
try{document.body.classList.toggle('dark',localStorage.getItem('revio-docs-theme')!=='light');}catch{}
function themeLabel(){document.querySelector('#theme').textContent=document.body.classList.contains('dark')?'☀':'☾';}
themeLabel();
const dialog=document.querySelector('#search-dialog');
let observer;
function render(){
  const id=new URLSearchParams(location.search).get('page')||'introduction';
  const page=pages[id];
  const currentSection=page?.section||'guides';
  const sectionEntries=Object.entries(pages).filter(([,p])=>p.section===currentSection);
  const bucketOrder=['Overview','Account basics','Workspace','Calendar','Connections','Bookings','Inventory','Guests','Front desk','Property','Operations','Content','Guest journey','Billing','Payments','Analytics','Governance','Configuration','Connectors','Data movement','Developer resources','Troubleshooting','Reference','Changelog','Guides'];
  const buckets=[...new Set([...bucketOrder,...sectionEntries.map(([,p])=>p.navGroup||'Guides')])]
    .map(group=>[group,sectionEntries.filter(([,p])=>(p.navGroup||'Guides')===group).map(([key,p])=>[key,key,p.title])])
    .filter(([,items])=>items.length);
  const sharedItems=[['concepts','The essentials'],['integrations','Integration concepts'],['support-and-faq','Support & FAQ']]
    .filter(([key])=>pages[key] && pages[key].section!==currentSection);
  const sharedGroup=sharedItems.length ? [['Shared help',sharedItems.map(([key,label])=>[key,pages[key].section,pages[key].title||label])]] : [];
  const scopedGroups=[...buckets,...sharedGroup];
  document.querySelector('#sidebar').innerHTML=scopedGroups.map(([title,items])=>`<div class="nav-group"><h3>${title}</h3>${items.map(([key,iconId,label])=>`<a href="?page=${key}" ${id===key?'class="active" aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${icon(iconId||pages[key]?.section)}</span>${label}</a>`).join('')}</div>`).join('')+`<div class="sidebar-bottom"><strong>Revio documentation</strong><span>Local design preview · September 2026</span><a href="?page=support-and-faq">Need help? <b>→</b></a></div>`;
  if(!page){article.innerHTML='<h1>Page not found</h1><p>This article is not part of the preview.</p><a class="inline-link" href="?page=introduction">Back to introduction</a>';document.querySelector('#toc-links').innerHTML='';return;}
  document.title=`${page.title} — Revio Docs`;
  const review=page.review || 'Draft · Content review pending';
  const statusClass=review.startsWith('Code checked')?'checked':'draft';
  article.innerHTML=`<div class="eyebrow">${page.group}</div><div class="title-row"><h1>${page.title}</h1><button class="copy" id="copy-link">Copy link ⧉</button></div><div class="article-meta"><span class="status-badge ${statusClass}">${review}</span><span class="meta-note">Local preview · verify before publishing</span></div><p class="lead">${page.lead}</p>${page.body}<div class="article-footer"><span>${review}</span><span>Revio Docs</span></div><a class="next" href="?page=${page.next}"><small>Read next</small><span>${pages[page.next].title} →</span></a>`;
  document.querySelectorAll('.top-nav a').forEach(a=>{a.classList.toggle('active',a.dataset.section===page.section);if(a.dataset.section===page.section)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const headings=[...article.querySelectorAll('h2[id]')];
  document.querySelector('#toc-links').innerHTML=headings.map((h,i)=>`<a href="#${h.id}" ${i===0?'class="active"':''}>${h.textContent}</a>`).join('');
  observer?.disconnect();
  observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)document.querySelectorAll('#toc-links a').forEach(a=>a.classList.toggle('active',a.hash===`#${e.target.id}`));},{rootMargin:'-135px 0px -55% 0px',threshold:0});
  headings.forEach(h=>observer.observe(h));
  document.querySelectorAll('.nav-group a, a.card').forEach(a=>{const key=new URL(a.href).searchParams.get('page');const target=a.querySelector('.nav-icon,.card-icon');if(target && !target.querySelector('svg'))target.innerHTML=icon(key);});
  document.querySelector('#copy-link').onclick=async e=>{try{await navigator.clipboard.writeText(location.href);e.target.textContent='Link copied ✓';}catch{e.target.textContent='Copy from address bar';}};
}
function closeMenu(){document.body.classList.remove('menu-open');document.querySelector('#menu').setAttribute('aria-expanded','false');}
document.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;const url=new URL(a.href);if(url.origin===location.origin&&url.searchParams.has('page')){e.preventDefault();history.pushState({},'',url);render();window.scrollTo(0,0);closeMenu();if(dialog.open)dialog.close();article.focus({preventScroll:true});}});
window.addEventListener('popstate',()=>{render();closeMenu();});
document.querySelector('#theme').onclick=()=>{const dark=document.body.classList.toggle('dark');themeLabel();try{localStorage.setItem('revio-docs-theme',dark?'dark':'light');}catch{}};
document.querySelector('#menu').onclick=()=>{const open=document.body.classList.toggle('menu-open');document.querySelector('#menu').setAttribute('aria-expanded',String(open));};
function search(){const query=document.querySelector('#search-input').value.toLowerCase().trim();const results=Object.entries(pages).filter(([,p])=>(p.title+' '+p.group+' '+p.lead+' '+p.body.replace(/<[^>]+>/g,' ')).toLowerCase().includes(query));document.querySelector('#search-results').innerHTML=results.length?results.map(([id,p])=>`<a href="?page=${id}">${p.title}<small>${p.group}</small></a>`).join(''):'<p>No matching articles. Try “rates”, “guest” or “integration”.</p>';}
function openSearch(){dialog.showModal();document.body.classList.add('modal-open');search();document.querySelector('#search-input').focus();}
document.querySelector('#search-open').onclick=openSearch;
const mobileSearch=document.createElement('button');
mobileSearch.id='mobile-search';
mobileSearch.textContent='⌕';
mobileSearch.setAttribute('aria-label','Search documentation');
mobileSearch.onclick=openSearch;
document.querySelector('#menu').before(mobileSearch);
document.querySelector('#search-close').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>document.body.classList.remove('modal-open'));
document.querySelector('#search-input').addEventListener('input',search);
document.querySelector('#search-input').addEventListener('keydown',e=>{if(e.key==='Enter')document.querySelector('#search-results a')?.click();});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();openSearch();}if(e.key==='Escape')closeMenu();});
render();
