import type { Translations } from "@revio/ui/i18n";

/**
 * Booking Engine — how the hotel configures RevioDirect („система за директни резервации“ in prose,
 * „Директни резервации“ as the screen name, matching the navigation).
 *
 * Deliberately NOT translated here: the live preview of the guest page (`EnginePreview`, the words on
 * the hero preview) and the placeholder default headline. Those show what a GUEST sees, which is the
 * booking page's language, not the receptionist's.
 *
 * `presets`, `fonts` and `overlays` word core's `BOOKING_PRESETS`, `BOOKING_FONTS` and
 * `HERO_OVERLAY_LEVELS` by key; `slug` words `slugRejectionReason` by reason. A drift test holds the
 * English of all of them to their source.
 */
export interface BookingEngineStrings {
  title: string;
  subtitle: (property: string) => string;
  openPage: string;
  nav: {
    overview: string; overviewBlurb: string;
    look: string; lookBlurb: string;
    payments: string; paymentsBlurb: string;
    extras: string; extrasBlurb: string;
    emails: string; emailsBlurb: string;
    photos: string; photosBlurb: string;
    label: string; elsewhere: string;
  };
  overview: {
    linkTitle: string;
    linkSub: string;
    taking: string;
    paused: string;
    notSetUp: string;
    guestsBookAt: string;
    notPublished: string;
    funnelTitle: string;
    funnelSub: string;
  };
  link: {
    address: string;
    yourAddress: string;
    creating: string;
    create: string;
    builtLead: string;
    locked: string;
    builtTail: string;
    copied: string;
    copy: string;
    permanent: string;
    saving: string;
    pause: string;
    start: string;
    live: string;
    pausedNote: string;
    saved: string;
  };
  funnel: {
    emptyTitle: string;
    emptyBody: string;
    nobodyDecided: string;
    booked: string;
    left: string;
    timedOut: string;
    opened: string;
    openedHint: string;
    leftForm: string;
    leftHint: string;
    ranOut: string;
    ranOutHint: string;
    looking: (n: number) => string;
    nightsWanted: string;
    nightsWhy: string;
    leadDays: string;
    leadWhy: string;
    night: (n: number) => string;
    day: (n: number) => string;
    didNot: string;
    median: string;
    byRoom: string;
    noRooms: string;
    room: string;
    of: (a: number, b: number) => string;
    byRoomNote: string;
    inferred: string;
  };
  look: {
    tabPage: string;
    tabPhoto: string;
    photoTitle: string;
    photoSub: string;
    pageTitle: string;
    pageSub: string;
    base: string;
    baseHint: string;
    colour: string;
    colourHint: string;
    pickColour: string;
    inherited: (v: string) => string;
    headings: string;
    headingsHint: string;
    inheritFont: (font: string) => string;
    headline: string;
    headlineHint: string;
    supporting: string;
    trust: string;
    trustHint: string;
    savedLive: string;
    saving: string;
    saveAppearance: string;
    preview: string;
    previewHint: string;
    reset: string;
  };
  presets: Record<string, { label: string; blurb: string }>;
  fonts: Record<string, string>;
  logo: {
    title: string;
    alt: string;
    none: string;
    uploading: string;
    upload: string;
    useEmail: string;
    inheritedNote: string;
    ownNote: string;
    emptyNote: string;
    tooBig: (kb: number) => string;
  };
  hero: {
    uploading: string;
    replace: string;
    use: string;
    savedLive: string;
    help: string;
    frame: string;
    frameHint: string;
    top: string;
    bottom: string;
    shade: string;
    shadeHint: string;
    darkEnough: string;
    needs: (floor: number, atFloor: boolean, alpha: number) => string;
    saving: string;
    saveSettings: string;
    saved: string;
    aboutToSave: string;
    onPage: string;
    remove: string;
    keep: string;
    none: string;
    tooBig: (mb: string) => string;
    unreadable: string;
    narrow: (w: number) => string;
    portrait: string;
  };
  overlays: Record<string, { label: string; blurb: string }>;
  payments: {
    title: string;
    sub: string;
    instant: string;
    requests: string;
    connectedLead: string;
    connectedBold: string;
    connectedTail: string;
    verifying: string;
    notConnected: string;
    badge: { connected: string; verifying: string; none: string };
    opening: string;
    continue: string;
    connect: string;
    checkAgain: string;
    demo: string;
    lastChecked: (when: string) => string;
    failed: string;
  };
  extras: {
    title: string;
    sub: string;
    empty: string;
    cancel: string;
    saving: string;
    add: string;
    addOne: string;
    save: string;
    aNight: string;
    perStay: string;
    onPage: string;
    staffOnly: string;
    retire: (name: string) => string;
    name: string;
    namePlaceholder: string;
    price: (currency: string) => string;
    charged: string;
    oncePerStay: string;
    perNight: string;
    line: string;
    optional: string;
    linePlaceholder: string;
    sellIt: string;
  };
  errors: {
    chooseHotel: string;
    slugTaken: (slug: string) => string;
    slug: { short: string; long: (max: number) => string; reserved: string; chars: string };
    chooseImage: string;
    logoTooBig: (kb: number) => string;
    notLogoType: string;
    heroTooBig: (mb: string) => string;
    stripeCreate: string;
    stripeStart: string;
    answered: string;
    extraName: string;
    extraPrice: string;
    extraGone: string;
  };
}

export const bookingEngine: Translations<BookingEngineStrings> = {
  en: {
    title: "Booking Engine",
    subtitle: (p) => `${p} · your own booking page — no commission, and it sells from the same inventory as every channel`,
    openPage: "Open your page",
    nav: {
      overview: "Overview", overviewBlurb: "How the page is doing, and its address",
      look: "Look", lookBlurb: "Colours, words, logo and the background photo",
      payments: "Taking payment", paymentsBlurb: "Instant confirmation, or requests you accept",
      extras: "Extras", extrasBlurb: "What a guest can add to their stay",
      emails: "Guest emails", emailsBlurb: "The confirmation a guest receives after booking here",
      photos: "Room photos & descriptions", photosBlurb: "What each room shows on the page — kept with the room",
      label: "Settings sections", elsewhere: "Elsewhere",
    },
    overview: {
      linkTitle: "Your link",
      linkSub: "Where guests book. Printed on QR codes and pasted into bios, so treat it as permanent once you share it.",
      taking: "Taking bookings",
      paused: "Paused",
      notSetUp: "Not set up",
      guestsBookAt: "Guests can book at",
      notPublished: "Your booking page isn't published yet. Choose your address now — we reserve it, and it becomes a working link the moment your page goes live.",
      funnelTitle: "How your booking page is doing",
      funnelSub: "The last 30 days — every guest who opened a booking form, and how it ended. No commission was paid on any of these.",
    },
    link: {
      address: "Your address",
      yourAddress: "your-address/",
      creating: "Creating…",
      create: "Create link & start taking bookings",
      builtLead: "We built this from your hotel's name — most hotels keep it. Change it now if you want something shorter or more recognisable, because ",
      locked: "it is set once and then locked",
      builtTail: ": guests, QR codes and printed material depend on it. You can pause bookings at any time without losing the address.",
      copied: "Copied",
      copy: "Copy",
      permanent: "Permanent. If you truly need it changed, contact us — we redirect the old address rather than break it.",
      saving: "Saving…",
      pause: "Pause bookings",
      start: "Start taking bookings",
      live: "Guests can book right now.",
      pausedNote: "Paused — anyone opening your link sees that online booking is closed. The address stays yours.",
      saved: "Saved.",
    },
    funnel: {
      emptyTitle: "Nobody has opened a booking form yet",
      emptyBody: "This fills in on its own the first time a guest reaches the booking page. Share your link and it starts counting.",
      nobodyDecided: "nobody decided yet",
      booked: "booked",
      left: "Left",
      timedOut: "Timed out",
      opened: "Opened a booking",
      openedHint: "Guests who reached the form",
      leftForm: "Left the form",
      leftHint: "Saw the total and went back — a price or trust signal",
      ranOut: "Ran out of time",
      ranOutHint: "Interrupted rather than put off — the ones an email can still win back",
      looking: (n) => `${n === 1 ? "guest is" : "guests are"} filling in the form right now — not counted either way until they finish.`,
      nightsWanted: "Nights they wanted",
      nightsWhy: "A longer stay abandoning more often usually means a minimum-stay rule or a price that only bites past a few nights.",
      leadDays: "Days before arrival",
      leadWhy: "Last-minute lookers abandoning more often points at the deposit or the card step, not the rate.",
      night: (n) => `${n} night${n === 1 ? "" : "s"}`,
      day: (n) => `${n} day${n === 1 ? "" : "s"}`,
      didNot: "did not",
      median: "Typical (middle) value, so one long booking cannot move it.",
      byRoom: "By room — booked out of the guests who opened that room",
      noRooms: "No rooms opened in this period.",
      room: "Room",
      of: (a, b) => `${a} of ${b}`,
      byRoomNote: "Each room is measured against its own visitors, not the hotel total — otherwise the room nobody opens always looks like the worst one, when what it has is a visibility problem.",
      inferred: "Part of this range predates the day we started recording where a hold came from and which visit it belonged to. Those older figures are inferred rather than measured, and one guest who compared two rooms may count twice in them.",
    },
    look: {
      tabPage: "Colours, words & logo",
      tabPhoto: "Background photo",
      photoTitle: "Background photo",
      photoSub: "A photo of your hotel behind the headline on your page. Optional — without one, the page uses the colour and shape of the base you picked.",
      pageTitle: "Colours, words & logo",
      pageSub: "Pick a base, then change only what you want. Anything left blank follows your email branding — editing here never changes your emails.",
      base: "Base",
      baseHint: "Sets the neutrals and the shape. Your colour sits on top of whichever you choose.",
      colour: "Colour",
      colourHint: "Blank inherits your email brand colour.",
      pickColour: "Pick a colour",
      inherited: (v) => `${v} (inherited)`,
      headings: "Headings",
      headingsHint: "Body text is always the same sans — prices need its numerals.",
      inheritFont: (f) => `Inherit from email (${f})`,
      headline: "Headline",
      headlineHint: "The first thing a guest reads. Blank uses the platform wording.",
      supporting: "Supporting line",
      trust: "Show the “why book direct” row",
      trustHint: "No booking fees · nothing charged today · live availability. Every claim is one the platform actually keeps, so it is safe to leave on.",
      savedLive: "Saved — your booking page is updated",
      saving: "Saving…",
      saveAppearance: "Save appearance",
      preview: "Live preview",
      previewHint: "Updates as you type. Nothing is live until you save.",
      reset: "Back to inherited",
    },
    presets: {
      clean: { label: "Clean", blurb: "Cool neutrals, white cards, a soft wash of your colour. Reads as modern and precise." },
      warm: { label: "Warm", blurb: "Sand ground, cream cards, softer corners. Reads as hospitable rather than technical." },
      bold: { label: "Bold", blurb: "Your colour as a full banner with the headline reversed out of it. Confident, high contrast." },
    },
    fonts: { sans: "Sans", serif: "Serif headings" },
    logo: {
      title: "Logo",
      alt: "Your logo",
      none: "No logo yet",
      uploading: "Uploading…",
      upload: "Upload logo",
      useEmail: "Use the email logo instead",
      inheritedNote: "This is your email branding logo. Upload one here to give the booking page its own.",
      ownNote: "The booking page uses this. Remove it to go back to your email branding logo.",
      emptyNote: "PNG, JPEG, GIF or WebP, under 300 KB. Leave it empty and the page shows your hotel’s name.",
      tooBig: (kb) => `That image is ${kb} KB — please use one under 300 KB.`,
    },
    hero: {
      uploading: "Uploading…",
      replace: "Replace background",
      use: "Use this background",
      savedLive: "Saved — it’s on your page now",
      help: "A wide photograph of your hotel — the terrace, the pool, the view. JPEG, PNG or WebP, at least 1200px wide. We resize it, so a large photo straight from a camera is fine.",
      frame: "What to keep in frame",
      frameHint: "A background is a wide band, so something is always cropped. Slide until the part that matters — the roofline, the horizon — is showing.",
      top: "Top",
      bottom: "Bottom",
      shade: "How dark to shade it",
      shadeHint: "Your words sit on top of this photo, so it needs some shading to stay readable. We measure your picture and apply the least that works — these choices go darker than that, never lighter.",
      darkEnough: "Your photo is dark enough to carry white text on its own, so the minimum adds nothing.",
      needs: (f, at, a) => `Your photo needs at least ${f}% shading for the text to stay readable${at ? " — that is what you have selected." : `; you have selected ${a}%.`}`,
      saving: "Saving…",
      saveSettings: "Save background settings",
      saved: "Saved",
      aboutToSave: "About to be saved",
      onPage: "On your page",
      remove: "Remove background",
      keep: "Keep what I had",
      none: "No background yet. Your page uses the colour and shape from the base you picked below.",
      tooBig: (mb) => `That image is ${mb} MB — the limit is 25 MB.`,
      unreadable: "We couldn’t read that image. Please try a JPEG, PNG or WebP.",
      narrow: (w) => `That image is ${w}px wide. A background needs at least 1200px — it spans the whole page.`,
      portrait: "That photo is taller than it is wide, so most of it would be cropped away. Please use a landscape one.",
    },
    overlays: {
      minimal: { label: "Show the photo", blurb: "Only as much shading as the words need. Your picture stays the loudest thing on the page." },
      balanced: { label: "Balanced", blurb: "A little more than the minimum. The safe choice if you may swap the photo later." },
      strong: { label: "Words first", blurb: "The photo becomes atmosphere behind the text. Best for busy or high-contrast pictures." },
    },
    payments: {
      title: "Taking payment",
      sub: "Whether a guest gets an instant confirmation, or sends you a request to accept. Either way your page sells.",
      instant: "Guests book instantly",
      requests: "Guests send requests",
      connectedLead: "Your Stripe account is connected, so a guest’s card guarantees the room and the booking is confirmed on the spot. ",
      connectedBold: "The money goes straight to you",
      connectedTail: " — it never passes through Revio.",
      verifying: "Stripe is still checking your details. Until it finishes, bookings arrive as requests for you to accept — the room is held for the guest in the meantime, so nothing is lost.",
      notConnected: "Connect Stripe and guests get an instant confirmation with a card guarantee, paid to you directly. Until then your page still sells: bookings arrive as requests you accept, and the room is held while you decide.",
      badge: { connected: "Connected", verifying: "Verifying", none: "Not connected" },
      opening: "Opening Stripe…",
      continue: "Continue on Stripe",
      connect: "Connect Stripe",
      checkAgain: "Check again",
      demo: "Demo mode — no Stripe key is configured, so connecting is simulated and no real account is created.",
      lastChecked: (w) => `Last checked with Stripe ${w}.`,
      failed: "Stripe could not start onboarding.",
    },
    extras: {
      title: "Extras you sell",
      sub: "Offered after a guest has picked a room, added to the same bill, and posted by your front desk from this same list.",
      empty: "Nothing yet. Breakfast, parking, an airport transfer, a late checkout — anything you already charge for is worth offering while a guest is booking.",
      cancel: "Cancel",
      saving: "Saving…",
      add: "Add extra",
      addOne: "Add an extra",
      save: "Save",
      aNight: " a night",
      perStay: " per stay",
      onPage: "On your page",
      staffOnly: "Staff only",
      retire: (n) => `Retire ${n}`,
      name: "Name",
      namePlaceholder: "Breakfast",
      price: (c) => `Price (${c})`,
      charged: "Charged",
      oncePerStay: "Once per stay",
      perNight: "Per night",
      line: "One line for guests",
      optional: " · optional",
      linePlaceholder: "Served 7–10:30 in the courtyard",
      sellIt: "Sell this on my booking page",
    },
    errors: {
      chooseHotel: "Choose a hotel first — you are viewing all properties, and this setting belongs to one.",
      slugTaken: (s) => `"${s}" is already taken. Try adding your city or district.`,
      slug: {
        short: "Too short — use at least 3 characters.",
        long: (m) => `Too long — keep it under ${m} characters.`,
        reserved: "That word is reserved. Pick something more specific to the hotel.",
        chars: "Use lowercase letters, numbers and single hyphens only.",
      },
      chooseImage: "Choose an image first.",
      logoTooBig: (kb) => `That image is ${kb} KB. Please use one under 300 KB.`,
      notLogoType: "That file isn’t a PNG, JPEG, GIF or WebP.",
      heroTooBig: (mb) => `That image is ${mb} MB — the limit is 25 MB.`,
      stripeCreate: "Stripe could not create the account.",
      stripeStart: "Stripe could not start onboarding.",
      answered: "That request has already been answered.",
      extraName: "Give it a name guests will recognise.",
      extraPrice: "Enter a price, or 0 if it's free.",
      extraGone: "That extra no longer exists.",
    },
  },
  bg: {
    title: "Директни резервации",
    subtitle: (p) => `${p} · Вашата собствена страница за резервации — без комисионна, продава от същата наличност като всеки канал`,
    openPage: "Отвори страницата",
    nav: {
      overview: "Преглед", overviewBlurb: "Как се справя страницата и адресът ѝ",
      look: "Външен вид", lookBlurb: "Цветове, текстове, лого и снимка за фон",
      payments: "Плащане", paymentsBlurb: "Незабавно потвърждение или заявки, които приемате",
      extras: "Допълнителни услуги", extrasBlurb: "Какво може да добави гостът към престоя",
      emails: "Имейли до гостите", emailsBlurb: "Потвърждението, което гостът получава след резервация тук",
      photos: "Снимки и описания на стаите", photosBlurb: "Какво показва всяка стая на страницата — пази се при стаята",
      label: "Раздели", elsewhere: "Другаде",
    },
    overview: {
      linkTitle: "Вашият линк",
      linkSub: "Тук гостите резервират. Печата се на QR кодове и се слага в профили, затова го приемайте за постоянен, щом го споделите.",
      taking: "Приема резервации",
      paused: "На пауза",
      notSetUp: "Не е настроена",
      guestsBookAt: "Гостите могат да резервират на",
      notPublished: "Страницата Ви за резервации още не е публикувана. Изберете адреса сега — запазваме го и той става работещ линк в момента, в който страницата бъде пусната.",
      funnelTitle: "Как се справя страницата Ви за резервации",
      funnelSub: "Последните 30 дни — всеки гост, отворил формата за резервация, и как е приключило. За нито една от тях не е платена комисионна.",
    },
    link: {
      address: "Вашият адрес",
      yourAddress: "вашият-адрес/",
      creating: "Създаване…",
      create: "Създай линка и започни да приемаш резервации",
      builtLead: "Съставихме го от името на хотела — повечето хотели го запазват. Сменете го сега, ако искате нещо по-кратко или по-разпознаваемо, защото ",
      locked: "се задава веднъж и после се заключва",
      builtTail: ": гостите, QR кодовете и печатните материали зависят от него. Можете да спрете резервациите по всяко време, без да губите адреса.",
      copied: "Копирано",
      copy: "Копирай",
      permanent: "Постоянен. Ако наистина трябва да се смени, свържете се с нас — пренасочваме стария адрес, вместо да го чупим.",
      saving: "Запазване…",
      pause: "Спри резервациите",
      start: "Започни да приемаш резервации",
      live: "Гостите могат да резервират в момента.",
      pausedNote: "На пауза — който отвори линка Ви, вижда, че онлайн резервациите са затворени. Адресът остава Ваш.",
      saved: "Запазено.",
    },
    funnel: {
      emptyTitle: "Все още никой не е отворил формата за резервация",
      emptyBody: "Попълва се само, когато първият гост стигне до страницата за резервации. Споделете линка си и броенето започва.",
      nobodyDecided: "още никой не е решил",
      booked: "резервирали",
      left: "Напуснали",
      timedOut: "Изтекло време",
      opened: "Отворили резервация",
      openedHint: "Гости, стигнали до формата",
      leftForm: "Напуснали формата",
      leftHint: "Видели са сумата и са се върнали — сигнал за цената или доверието",
      ranOut: "Изтекло им е времето",
      ranOutHint: "Прекъснати, а не отказали се — тези, които имейл още може да спечели",
      looking: (n) => `${n === 1 ? "гост попълва" : "гости попълват"} формата в момента — не се броят, докато не приключат.`,
      nightsWanted: "Нощувки, които са искали",
      nightsWhy: "Ако по-дългите престои се отказват по-често, обикновено причината е правило за минимален престой или цена, която „хапе“ след няколко нощувки.",
      leadDays: "Дни преди пристигане",
      leadWhy: "Ако търсещите в последния момент се отказват по-често, причината е в депозита или стъпката с картата, а не в цената.",
      night: (n) => `${n} ${n === 1 ? "нощувка" : "нощувки"}`,
      day: (n) => `${n} ${n === 1 ? "ден" : "дни"}`,
      didNot: "не са",
      median: "Типична (средна по ред) стойност, за да не я измести една дълга резервация.",
      byRoom: "По стая — резервирали от гостите, отворили тази стая",
      noRooms: "В този период не са отваряни стаи.",
      room: "Стая",
      of: (a, b) => `${a} от ${b}`,
      byRoomNote: "Всяка стая се мери спрямо собствените си посетители, а не спрямо целия хотел — иначе стаята, която никой не отваря, винаги изглежда най-лоша, а проблемът ѝ е, че не се вижда.",
      inferred: "Част от този период е отпреди деня, в който започнахме да записваме откъде идва задържането и към кое посещение принадлежи. Тези по-стари числа са изведени, а не измерени, и гост, сравнявал две стаи, може да е броен два пъти.",
    },
    look: {
      tabPage: "Цветове, текстове и лого",
      tabPhoto: "Снимка за фон",
      photoTitle: "Снимка за фон",
      photoSub: "Снимка на хотела зад заглавието на страницата Ви. По желание — без нея страницата използва цвета и формата на избраната основа.",
      pageTitle: "Цветове, текстове и лого",
      pageSub: "Изберете основа и после променете само каквото искате. Всичко празно следва брандинга на имейлите Ви — промените тук никога не сменят имейлите.",
      base: "Основа",
      baseHint: "Задава неутралните цветове и формата. Вашият цвят стои върху която и да изберете.",
      colour: "Цвят",
      colourHint: "Празно = цветът на брандинга от имейлите.",
      pickColour: "Изберете цвят",
      inherited: (v) => `${v} (наследен)`,
      headings: "Заглавия",
      headingsHint: "Основният текст винаги е с един и същ безсерифен шрифт — цените имат нужда от неговите цифри.",
      inheritFont: (f) => `Като в имейлите (${f})`,
      headline: "Заглавие",
      headlineHint: "Първото, което гостът чете. Празно = текстът на платформата.",
      supporting: "Подзаглавие",
      trust: "Показвай реда „защо да резервирате директно“",
      trustHint: "Без такси за резервация · нищо не се плаща днес · наличност в реално време. Всяко твърдение е спазено от платформата, така че е безопасно да остане включено.",
      savedLive: "Запазено — страницата Ви за резервации е обновена",
      saving: "Запазване…",
      saveAppearance: "Запази външния вид",
      preview: "Преглед на живо",
      previewHint: "Обновява се, докато пишете. Нищо не е публикувано, докато не запазите.",
      reset: "Върни наследеното",
    },
    presets: {
      clean: { label: "Изчистена", blurb: "Студени неутрални тонове, бели карти, лек оттенък на Вашия цвят. Изглежда модерно и прецизно." },
      warm: { label: "Топла", blurb: "Пясъчен фон, кремави карти, по-меки ъгли. Изглежда гостоприемно, а не технично." },
      bold: { label: "Смела", blurb: "Вашият цвят като цял банер със заглавието върху него. Уверено, с висок контраст." },
    },
    fonts: { sans: "Безсерифен", serif: "Серифни заглавия" },
    logo: {
      title: "Лого",
      alt: "Вашето лого",
      none: "Все още няма лого",
      uploading: "Качване…",
      upload: "Качи лого",
      useEmail: "Използвай логото от имейлите",
      inheritedNote: "Това е логото от брандинга на имейлите. Качете друго тук, за да има страницата за резервации свое.",
      ownNote: "Страницата за резервации използва това. Премахнете го, за да се върнете към логото от имейлите.",
      emptyNote: "PNG, JPEG, GIF или WebP, до 300 KB. Ако остане празно, страницата показва името на хотела.",
      tooBig: (kb) => `Изображението е ${kb} KB — моля, използвайте такова под 300 KB.`,
    },
    hero: {
      uploading: "Качване…",
      replace: "Смени фона",
      use: "Използвай този фон",
      savedLive: "Запазено — вече е на страницата Ви",
      help: "Широка снимка на хотела — терасата, басейна, гледката. JPEG, PNG или WebP, поне 1200px широка. Оразмеряваме я, така че голяма снимка направо от фотоапарата е наред.",
      frame: "Какво да остане в кадър",
      frameHint: "Фонът е широка лента, така че нещо винаги се изрязва. Плъзнете, докато се вижда важното — покривът, хоризонтът.",
      top: "Горе",
      bottom: "Долу",
      shade: "Колко да се затъмни",
      shadeHint: "Текстът стои върху снимката, затова тя има нужда от затъмняване, за да се чете. Измерваме снимката и прилагаме най-малкото, което е достатъчно — тези избори затъмняват повече, никога по-малко.",
      darkEnough: "Снимката е достатъчно тъмна, за да носи бял текст сама, така че минимумът не добавя нищо.",
      needs: (f, at, a) => `Снимката има нужда от поне ${f}% затъмняване, за да се чете текстът${at ? " — точно това сте избрали." : `; избрали сте ${a}%.`}`,
      saving: "Запазване…",
      saveSettings: "Запази настройките на фона",
      saved: "Запазено",
      aboutToSave: "Ще бъде запазено",
      onPage: "На страницата Ви",
      remove: "Премахни фона",
      keep: "Запази предишния",
      none: "Все още няма фон. Страницата използва цвета и формата на основата, която избрахте по-долу.",
      tooBig: (mb) => `Изображението е ${mb} MB — ограничението е 25 MB.`,
      unreadable: "Изображението не можа да бъде прочетено. Моля, опитайте с JPEG, PNG или WebP.",
      narrow: (w) => `Изображението е широко ${w}px. Фонът има нужда от поне 1200px — той е на цялата ширина на страницата.`,
      portrait: "Снимката е по-висока, отколкото е широка, така че по-голямата част ще се изреже. Моля, използвайте хоризонтална.",
    },
    overlays: {
      minimal: { label: "Покажи снимката", blurb: "Само толкова затъмняване, колкото трябва на текста. Снимката остава най-силното нещо на страницата." },
      balanced: { label: "Балансирано", blurb: "Малко над минимума. Сигурният избор, ако може да смените снимката по-късно." },
      strong: { label: "Първо текстът", blurb: "Снимката става атмосфера зад текста. Най-добро за пъстри или контрастни снимки." },
    },
    payments: {
      title: "Плащане",
      sub: "Дали гостът получава незабавно потвърждение или Ви изпраща заявка за приемане. И в двата случая страницата Ви продава.",
      instant: "Гостите резервират незабавно",
      requests: "Гостите изпращат заявки",
      connectedLead: "Вашият Stripe акаунт е свързан, така че картата на госта гарантира стаята и резервацията се потвърждава веднага. ",
      connectedBold: "Парите отиват директно при Вас",
      connectedTail: " — никога не минават през Revio.",
      verifying: "Stripe все още проверява данните Ви. Докато приключи, резервациите пристигат като заявки за приемане — стаята междувременно е задържана за госта, така че нищо не се губи.",
      notConnected: "Свържете Stripe и гостите получават незабавно потвърждение с гаранция с карта, платено директно на Вас. Дотогава страницата пак продава: резервациите идват като заявки, които приемате, а стаята е задържана, докато решите.",
      badge: { connected: "Свързан", verifying: "Проверява се", none: "Не е свързан" },
      opening: "Отваряне на Stripe…",
      continue: "Продължи в Stripe",
      connect: "Свържи Stripe",
      checkAgain: "Провери отново",
      demo: "Демо режим — няма зададен ключ за Stripe, така че свързването е симулирано и не се създава истински акаунт.",
      lastChecked: (w) => `Последна проверка в Stripe: ${w}.`,
      failed: "Stripe не можа да започне регистрацията.",
    },
    extras: {
      title: "Допълнителни услуги, които продавате",
      sub: "Предлагат се, след като гостът е избрал стая, добавят се към същата сметка и рецепцията ги начислява от същия списък.",
      empty: "Все още няма. Закуска, паркинг, трансфер от летището, късно напускане — всичко, което вече таксувате, си струва да се предложи, докато гостът резервира.",
      cancel: "Отказ",
      saving: "Запазване…",
      add: "Добави услугата",
      addOne: "Добави допълнителна услуга",
      save: "Запази",
      aNight: " на нощувка",
      perStay: " на престой",
      onPage: "На страницата",
      staffOnly: "Само за персонала",
      retire: (n) => `Спри ${n}`,
      name: "Име",
      namePlaceholder: "Закуска",
      price: (c) => `Цена (${c})`,
      charged: "Таксува се",
      oncePerStay: "Веднъж на престой",
      perNight: "На нощувка",
      line: "Един ред за гостите",
      optional: " · по желание",
      linePlaceholder: "Сервира се 7–10:30 във вътрешния двор",
      sellIt: "Продавай това на страницата ми за резервации",
    },
    errors: {
      chooseHotel: "Първо изберете хотел — разглеждате всички обекти, а тази настройка е за един.",
      slugTaken: (s) => `„${s}“ вече е зает. Опитайте да добавите града или квартала.`,
      slug: {
        short: "Твърде кратък — използвайте поне 3 знака.",
        long: (m) => `Твърде дълъг — до ${m} знака.`,
        reserved: "Тази дума е запазена. Изберете нещо по-конкретно за хотела.",
        chars: "Използвайте само малки латински букви, цифри и единични тирета.",
      },
      chooseImage: "Първо изберете изображение.",
      logoTooBig: (kb) => `Изображението е ${kb} KB. Моля, използвайте такова под 300 KB.`,
      notLogoType: "Този файл не е PNG, JPEG, GIF или WebP.",
      heroTooBig: (mb) => `Изображението е ${mb} MB — ограничението е 25 MB.`,
      stripeCreate: "Stripe не можа да създаде акаунта.",
      stripeStart: "Stripe не можа да започне регистрацията.",
      answered: "На тази заявка вече е отговорено.",
      extraName: "Дайте име, което гостите ще разпознаят.",
      extraPrice: "Въведете цена или 0, ако е безплатно.",
      extraGone: "Тази услуга вече не съществува.",
    },
  },
};
