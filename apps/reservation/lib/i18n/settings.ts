import type { Translations } from "@revio/ui/i18n";

/**
 * RevioCRS Settings — the section nav and the sections this product owns (property, policies,
 * taxes, users, account). Guest emails and Billing are shared screens with their own dictionaries in
 * `@revio/ui`, the same ones RevioPMS uses.
 *
 * Role names are the ones the user menu already says (`shell.ts` → roles), so a role is named one
 * way everywhere. `switch` words core's `describeSwitch` from the same facts; the drift test holds
 * the English to it.
 */
export interface SettingsStrings {
  title: string;
  sections: Record<"property" | "emails" | "policies" | "taxes" | "users" | "billing" | "account", { label: string; blurb: string }>;
  elsewhere: Record<"engine" | "rooms" | "distribution" | "help", { label: string; blurb: string }>;
  navLabel: string;
  elsewhereLabel: string;
  property: {
    title: string;
    property: string;
    timezone: string;
    currency: string;
    checkInOut: string;
    noteLead: string;
    noteLink: string;
    noteTail: string;
  };
  account: { twoFactor: string; twoFactorSub: string; signIn: string; signInSub: string };
  policies: {
    title: string;
    subtitle: (precedence: string) => string;
    minStay: string;
    maxStay: string;
    bookMin: string;
    bookMax: string;
    stopSell: string;
    cta: string;
    ctd: string;
    mainGuests: string;
    assumed: (n: number) => string;
    holdTtl: string;
    lowAvail: string;
    pickupDays: string;
    revenueDisplay: string;
    gross: string;
    net: string;
    noShows: string;
    cityTax: string;
    onSpot: string;
    included: string;
    cityTaxNote: string;
    save: string;
    pricingTitle: string;
    pricingSub: string;
  };
  pricing: {
    legend: string;
    perRoom: string;
    perRoomBody: string;
    perPerson: string;
    perPersonBody: string;
    seedLabel: string;
    seedCopy: string;
    seedDerive: string;
    seedNote: string;
    preview: string;
    currently: (perPerson: boolean) => string;
    prices: (before: number, after: number) => string;
    noChange: string;
    ownSetting: (perPerson: boolean) => string;
    alreadyShape: string;
    syncNote: string;
    apply: string;
  };
  switch: {
    noop: (perPerson: boolean) => string;
    head: (perPerson: boolean, plans: number, rows: number) => string;
    safety: (perPerson: boolean) => string;
    skipped: (n: number) => string;
  };
  taxes: {
    title: string;
    cols: { name: string; amount: string; basis: string; inRate: string; status: string };
    basis: Record<"per_room" | "per_person" | "per_night" | "per_stay", string>;
    inclusion: { included: string; excluded: string };
    active: string;
    off: string;
    deleteNote: string;
    name: string;
    namePlaceholder: string;
    type: string;
    fixed: string;
    percent: string;
    amount: (currency: string) => string;
    pct: string;
    basisLabel: string;
    displayed: string;
    activeLabel: string;
    add: string;
  };
  users: {
    title: string;
    subtitle: string;
    role: string;
    builtin: string;
    /** The seeded built-in roles, by their stored name — only ever applied to `builtin` rows. */
    builtinNames: Record<string, string>;
    groups: Record<"reservations" | "rates" | "inventory" | "restrictions" | "users" | "reports" | "distribution" | "finance", string>;
    levels: { none: string; view: string; edit: string };
    deleteNote: string;
    addRole: string;
    roleName: string;
    rolePlaceholder: string;
    createRole: string;
    staffTitle: (n: number) => string;
    staffSub: string;
  };
  staff: {
    roles: Record<"owner" | "admin" | "revenue_manager" | "distribution_manager" | "read_only", string>;
    intro: string;
    add: string;
    addTitle: string;
    addLead: string;
    addBold: string;
    addTail: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    phone: string;
    roleLabel: string;
    cancel: string;
    adding: string;
    editTitle: (name: string) => string;
    editNote: string;
    saving: string;
    save: string;
    cols: { name: string; email: string; phone: string; role: string; status: string; manage: string };
    you: string;
    active: string;
    deactivated: string;
    editHint: string;
    resetTitle: string;
    resetConfirm: (name: string) => string;
    cantSelf: string;
    deactivate: string;
    deactivateConfirm: (name: string) => string;
    reactivate: string;
  };
  errors: {
    roleExists: string;
    badPct: string;
    badAmount: string;
    taxGoneEdit: string;
    taxGone: string;
    emailsDenied: string;
    emailGone: string;
    notALanguage: string;
    staffDenied: string;
    nameEmail: string;
    validRole: string;
    emailTaken: string;
    userNotFound: string;
    notARole: string;
    lastOwner: string;
    lastActiveOwner: string;
  };
}

const s = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const settings: Translations<SettingsStrings> = {
  en: {
    title: "Settings",
    sections: {
      property: { label: "Property", blurb: "Name, timezone, currency, check-in and check-out" },
      emails: { label: "Guest emails", blurb: "What your guests receive, in which language, and how it looks" },
      policies: { label: "Rates & policies", blurb: "Standing defaults applied when nothing more specific does, and how you price rooms" },
      taxes: { label: "Taxes & fees", blurb: "What is added to a stay, and how it is shown to the guest" },
      users: { label: "Users & permissions", blurb: "Roles, and the people assigned to them on the one shared Revio identity" },
      billing: { label: "Billing", blurb: "What you pay, and every invoice we have issued" },
      account: { label: "Your account", blurb: "Two-factor authentication and your sessions" },
    },
    elsewhere: {
      engine: { label: "Booking engine", blurb: "Branding, hero image and the direct-booking page" },
      rooms: { label: "Rooms & Rates", blurb: "Room types, photos, rate plans and closures" },
      distribution: { label: "Distribution", blurb: "Channels and cost of distribution" },
      help: { label: "Help & support", blurb: "Answers, and every request you have sent us" },
    },
    navLabel: "Settings sections",
    elsewhereLabel: "Elsewhere",
    property: {
      title: "Property & platform",
      property: "Property",
      timezone: "Time zone",
      currency: "Currency",
      checkInOut: "Check-in / out",
      noteLead: "Profile & currency are edited in RevioLink → Settings. Metric defaults (no-shows, gross/net, pickup window, alert thresholds, hold TTL) live under ",
      noteLink: "Settings → Rates & policies",
      noteTail: ". Housekeeping, folios and the night audit live in RevioPMS.",
    },
    account: {
      twoFactor: "Two-factor authentication",
      twoFactorSub: "Protects this account in every Revio product you use",
      signIn: "Your sign-in",
      signInSub: "Sessions on this and any other device",
    },
    policies: {
      title: "Standing policy defaults",
      subtitle: (p) => `Used when nothing more specific applies — ${p}`,
      minStay: "Min stay (nights)",
      maxStay: "Max stay (nights)",
      bookMin: "Book ≥ days ahead",
      bookMax: "Book ≤ days ahead",
      stopSell: "Stop sell",
      cta: "Closed to arrival",
      ctd: "Closed to departure",
      mainGuests: "Main guest count",
      assumed: (n) => `${n} (assumed)`,
      holdTtl: "Hold TTL (minutes)",
      lowAvail: "Low-availability alert ≤",
      pickupDays: "Pickup compares vs (days ago)",
      revenueDisplay: "Revenue display",
      gross: "Gross",
      net: "Net (− channel commission)",
      noShows: "Count no-shows as sold",
      cityTax: "City tax mode",
      onSpot: "Payable on spot — the PMS posts it as a folio charge at check-in; the channel manager discloses it to the OTA",
      included: "Included — absorbed in the rate; no folio line, no disclosure",
      cityTaxNote: "Either way the rate sent to the OTA is the room rate, full stop — this setting only controls downstream behaviour.",
      save: "Save defaults",
      pricingTitle: "How you price rooms",
      pricingSub: "One price per room, or a price for each number of guests",
    },
    pricing: {
      legend: "Pricing model",
      perRoom: "Per room",
      perRoomBody: "One price for the room, whoever is in it. The simplest model, and what most UK and US hotels use.",
      perPerson: "Per person",
      perPersonBody: "A price for each number of guests — €80 for one, €100 for two. Standard across most of continental Europe.",
      seedLabel: "Starting prices for the other guest counts",
      seedCopy: "Use the same price for every guest count (change them afterwards)",
      seedDerive: "Work them out from the main price with a rule",
      seedNote: "Either way nothing is guessed for you — the price you charge today stays on your main guest count, and you set the rest.",
      preview: "See what will change",
      currently: (pp) => `Currently ${pp ? "per person" : "per room"}.`,
      prices: (b, a) => `${b} price${b === 1 ? "" : "s"} → ${a}`,
      noChange: "no change",
      ownSetting: (pp) => `Set to ${pp ? "per person" : "per room"} on its own — a property change does not override that.`,
      alreadyShape: "Already in this shape.",
      syncNote: "Your channels get the new prices on the next sync. You can switch back at any time.",
      apply: "Apply",
    },
    switch: {
      noop: (pp) => pp
        ? "Every rate plan already prices per person — nothing to change."
        : "Every rate plan already prices per room — nothing to change.",
      head: (pp, n, rows) => pp
        ? `${n} rate plan${n === 1 ? "" : "s"} will price per person, adding ${rows} occupancy price${rows === 1 ? "" : "s"}.`
        : `${n} rate plan${n === 1 ? "" : "s"} will price per room, collapsing to one price each.`,
      safety: (pp) => pp
        ? " Your current price stays on the primary occupancy."
        : " The primary occupancy's price becomes the room price.",
      skipped: (n) => ` ${n} plan${n === 1 ? " is" : "s are"} set on their own and will not change.`,
    },
    taxes: {
      title: "Taxes & Fees",
      cols: { name: "Name", amount: "Amount", basis: "Basis", inRate: "In displayed rate?", status: "Status" },
      basis: { per_room: "per room", per_person: "per person", per_night: "per night", per_stay: "per stay" },
      inclusion: { included: "included", excluded: "excluded" },
      active: "active",
      off: "off",
      deleteNote: "Existing reservations keep their recorded totals.",
      name: "Name",
      namePlaceholder: "City tax",
      type: "Type",
      fixed: "Fixed",
      percent: "Percent",
      amount: (c) => `Amount (${c})`,
      pct: "Percent",
      basisLabel: "Basis",
      displayed: "Displayed rate",
      activeLabel: "Active",
      add: "Add",
    },
    users: {
      title: "Users & Permissions",
      subtitle: "Define roles here. Assign people to them in RevioLink → User Management — one login per person across every Revio product.",
      role: "Role",
      builtin: "built-in",
      builtinNames: { Owner: "Owner", Admin: "Admin", "Revenue Manager": "Revenue Manager", "Reservations Agent": "Reservations Agent", "Read-only": "Read-only" },
      groups: {
        reservations: "Reservations", rates: "Rates", inventory: "Inventory", restrictions: "Restrictions",
        users: "Users", reports: "Reports", distribution: "Distribution", finance: "Finance",
      },
      levels: { none: "none", view: "view", edit: "edit" },
      deleteNote: "Users keep their assignment until changed.",
      addRole: "+ Add a custom role",
      roleName: "Role name",
      rolePlaceholder: "e.g. Front Desk",
      createRole: "Create role",
      staffTitle: (n) => `Staff (${n})`,
      staffSub: "Add, deactivate, change role, reset password, edit email/phone — all on the one shared Revio identity",
    },
    staff: {
      roles: { owner: "Owner", admin: "Admin", revenue_manager: "Revenue Manager", distribution_manager: "Distribution Manager", read_only: "Read-only" },
      intro: "One account across every Revio product — manage it here or in RevioLink / RevioPMS; it’s the same identity.",
      add: "Add staff",
      addTitle: "Add a team member",
      addLead: "Creates the ",
      addBold: "one shared Revio identity",
      addTail: " — the same login works across every product this hotel owns. They receive an invitation by email and choose their own password — nobody here ever sets or sees it.",
      name: "Name",
      namePlaceholder: "Lena Koch",
      email: "Email (login)",
      emailPlaceholder: "lena@hotel.com",
      phone: "Phone",
      roleLabel: "Role",
      cancel: "Cancel",
      adding: "Adding…",
      editTitle: (n) => `Edit ${n}`,
      editNote: "Changes apply to the shared Revio login — email is the sign-in identifier.",
      saving: "Saving…",
      save: "Save",
      cols: { name: "Name", email: "Email", phone: "Phone", role: "Role", status: "Status", manage: "Manage" },
      you: "you",
      active: "active",
      deactivated: "deactivated",
      editHint: "Edit name / email / phone",
      resetTitle: "Revoke the password and send a fresh invitation",
      resetConfirm: (n) => `Send ${n} a new invitation? Their current password stops working immediately and they choose a new one.`,
      cantSelf: "You can't deactivate yourself",
      deactivate: "Deactivate",
      deactivateConfirm: (n) => `Deactivate ${n}? They keep their history but can't sign in.`,
      reactivate: "Reactivate",
    },
    errors: {
      roleExists: "A role with that name already exists. Pick a different name.",
      badPct: "That percentage isn’t a number we can read. Enter a value like 9 or 20.",
      badAmount: "That amount isn’t a number we can read. Enter a value like 2.50.",
      taxGoneEdit: "That tax or fee has been removed — somebody deleted it while this page was open. Reload and add it again.",
      taxGone: "That tax or fee has already been removed.",
      emailsDenied: "Only an owner or admin can change guest emails. Ask one of them.",
      emailGone: "That email or language no longer exists. Reload the page and try again.",
      notALanguage: "That isn’t a language we send in. Reload the page and try again.",
      staffDenied: "Only an Owner or Admin can manage staff.",
      nameEmail: "Name and email are required.",
      validRole: "Pick a valid role.",
      emailTaken: "That email is already a Revio login.",
      userNotFound: "User not found.",
      notARole: "That isn’t a role this account has. Reload the page and try again.",
      lastOwner: "This is the last owner. Make somebody else an owner first — an account with no owner cannot be managed.",
      lastActiveOwner: "This is the last active owner. Activate or promote somebody else first — an account with no active owner cannot be managed.",
    },
  },
  bg: {
    title: "Настройки",
    sections: {
      property: { label: "Обект", blurb: "Име, часова зона, валута, настаняване и напускане" },
      emails: { label: "Имейли до гостите", blurb: "Какво получават гостите, на какъв език и как изглежда" },
      policies: { label: "Цени и правила", blurb: "Постоянни настройки, когато няма нищо по-конкретно, и как ценообразувате стаите" },
      taxes: { label: "Данъци и такси", blurb: "Какво се добавя към престоя и как се показва на госта" },
      users: { label: "Потребители и права", blurb: "Роли и хората с тях в общия профил в Revio" },
      billing: { label: "Плащания към Revio", blurb: "Какво плащате и всяка фактура, която сме издали" },
      account: { label: "Вашият профил", blurb: "Двуфакторна защита и сесиите Ви" },
    },
    elsewhere: {
      engine: { label: "Директни резервации", blurb: "Брандинг, снимка за фон и страницата за директни резервации" },
      rooms: { label: "Стаи и цени", blurb: "Типове стаи, снимки, ценови планове и затваряния" },
      distribution: { label: "Дистрибуция", blurb: "Канали и цена на дистрибуцията" },
      help: { label: "Помощ и поддръжка", blurb: "Отговори и всяка заявка, която сте ни изпратили" },
    },
    navLabel: "Раздели на настройките",
    elsewhereLabel: "Другаде",
    property: {
      title: "Обект и платформа",
      property: "Обект",
      timezone: "Часова зона",
      currency: "Валута",
      checkInOut: "Настаняване / напускане",
      noteLead: "Профилът и валутата се редактират в RevioLink → Настройки. Настройките на показателите (неявили се, бруто/нето, период за новите резервации, прагове за известия, време за задържане) са в ",
      noteLink: "Настройки → Цени и правила",
      noteTail: ". Хаускийпингът, фолиата и нощният одит са в RevioPMS.",
    },
    account: {
      twoFactor: "Двуфакторна защита",
      twoFactorSub: "Защитава този профил във всеки продукт на Revio, който ползвате",
      signIn: "Вашият вход",
      signInSub: "Сесии на това и на всяко друго устройство",
    },
    policies: {
      title: "Постоянни правила по подразбиране",
      subtitle: (p) => `Използват се, когато няма нищо по-конкретно — ${p}`,
      minStay: "Мин. престой (нощувки)",
      maxStay: "Макс. престой (нощувки)",
      bookMin: "Резервация ≥ дни предварително",
      bookMax: "Резервация ≤ дни предварително",
      stopSell: "Стоп продажби",
      cta: "Затворено за пристигане",
      ctd: "Затворено за напускане",
      mainGuests: "Основен брой гости",
      assumed: (n) => `${n} (прието)`,
      holdTtl: "Задържане (минути)",
      lowAvail: "Известие при наличност ≤",
      pickupDays: "Новите резервации спрямо (дни назад)",
      revenueDisplay: "Показване на приходите",
      gross: "Бруто",
      net: "Нето (− комисионна на каналите)",
      noShows: "Неявилите се се броят като продадени",
      cityTax: "Туристически данък",
      onSpot: "Плаща се на място — PMS го начислява във фолиото при настаняване; каналният мениджър го обявява на OTA",
      included: "Включен — поет в цената; без ред във фолиото, без обявяване",
      cityTaxNote: "И в двата случая към OTA се изпраща цената на стаята и нищо друго — тази настройка определя само какво става след това.",
      save: "Запази",
      pricingTitle: "Как ценообразувате стаите",
      pricingSub: "Една цена за стая или цена за всеки брой гости",
    },
    pricing: {
      legend: "Модел на ценообразуване",
      perRoom: "На стая",
      perRoomBody: "Една цена за стаята, независимо кой е в нея. Най-простият модел, използван от повечето хотели във Великобритания и САЩ.",
      perPerson: "На човек",
      perPersonBody: "Цена за всеки брой гости — 80 € за един, 100 € за двама. Стандарт в по-голямата част от континентална Европа.",
      seedLabel: "Начални цени за другите бройки гости",
      seedCopy: "Същата цена за всеки брой гости (променяте ги после)",
      seedDerive: "Изчисляват се от основната цена с правило",
      seedNote: "И в двата случая нищо не се гадае вместо Вас — цената, която взимате днес, остава за основния брой гости, а останалите задавате Вие.",
      preview: "Виж какво ще се промени",
      currently: (pp) => `В момента: ${pp ? "на човек" : "на стая"}.`,
      prices: (b, a) => `${s(b, "цена", "цени")} → ${a}`,
      noChange: "без промяна",
      ownSetting: (pp) => `Има собствена настройка (${pp ? "на човек" : "на стая"}) — промяна за обекта не я отменя.`,
      alreadyShape: "Вече е в този вид.",
      syncNote: "Каналите получават новите цени при следващата синхронизация. Можете да превключите обратно по всяко време.",
      apply: "Приложи",
    },
    switch: {
      noop: (pp) => pp
        ? "Всички ценови планове вече са с цена на човек — няма какво да се променя."
        : "Всички ценови планове вече са с цена на стая — няма какво да се променя.",
      head: (pp, n, rows) => pp
        ? `${s(n, "ценови план ще бъде", "ценови плана ще бъдат")} с цена на човек, като се добавят ${s(rows, "цена по брой гости", "цени по брой гости")}.`
        : `${s(n, "ценови план ще бъде", "ценови плана ще бъдат")} с цена на стая, по една цена за всеки.`,
      safety: (pp) => pp
        ? " Сегашната цена остава за основния брой гости."
        : " Цената за основния брой гости става цена на стаята.",
      skipped: (n) => n === 1
        ? " 1 план има собствена настройка и няма да се промени."
        : ` ${n} плана имат собствена настройка и няма да се променят.`,
    },
    taxes: {
      title: "Данъци и такси",
      cols: { name: "Име", amount: "Сума", basis: "Основа", inRate: "В показаната цена?", status: "Статус" },
      basis: { per_room: "на стая", per_person: "на човек", per_night: "на нощувка", per_stay: "на престой" },
      inclusion: { included: "включен", excluded: "невключен" },
      active: "активен",
      off: "изкл.",
      deleteNote: "Съществуващите резервации запазват записаните си суми.",
      name: "Име",
      namePlaceholder: "Туристически данък",
      type: "Вид",
      fixed: "Фиксирана сума",
      percent: "Процент",
      amount: (c) => `Сума (${c})`,
      pct: "Процент",
      basisLabel: "Основа",
      displayed: "Показана цена",
      activeLabel: "Активен",
      add: "Добави",
    },
    users: {
      title: "Потребители и права",
      subtitle: "Тук задавате ролите. Хората към тях се добавят в RevioLink → Потребители — един вход на човек за всички продукти на Revio.",
      role: "Роля",
      builtin: "вградена",
      builtinNames: { Owner: "Собственик", Admin: "Администратор", "Revenue Manager": "Мениджър приходи", "Reservations Agent": "Агент резервации", "Read-only": "Само преглед" },
      groups: {
        reservations: "Резервации", rates: "Цени", inventory: "Наличност", restrictions: "Ограничения",
        users: "Потребители", reports: "Отчети", distribution: "Дистрибуция", finance: "Финанси",
      },
      levels: { none: "няма", view: "преглед", edit: "редакция" },
      deleteNote: "Потребителите запазват ролята си, докато не бъде сменена.",
      addRole: "+ Добави собствена роля",
      roleName: "Име на ролята",
      rolePlaceholder: "напр. Рецепция",
      createRole: "Създай роля",
      staffTitle: (n) => `Служители (${n})`,
      staffSub: "Добавяне, деактивиране, смяна на роля, нова парола, имейл и телефон — всичко в общия профил в Revio",
    },
    staff: {
      roles: { owner: "Собственик", admin: "Администратор", revenue_manager: "Мениджър приходи", distribution_manager: "Мениджър дистрибуция", read_only: "Само преглед" },
      intro: "Един профил за всички продукти на Revio — управлявайте го тук или в RevioLink / RevioPMS; профилът е един и същ.",
      add: "Добави служител",
      addTitle: "Нов член на екипа",
      addLead: "Създава ",
      addBold: "един общ профил в Revio",
      addTail: " — същият вход работи във всички продукти на хотела. Служителят получава покана по имейл и сам избира паролата си — тук никой не я задава и не я вижда.",
      name: "Име",
      namePlaceholder: "Мария Иванова",
      email: "Имейл (за вход)",
      emailPlaceholder: "maria@hotel.bg",
      phone: "Телефон",
      roleLabel: "Роля",
      cancel: "Отказ",
      adding: "Добавяне…",
      editTitle: (n) => `Редактиране на ${n}`,
      editNote: "Промените важат за общия вход в Revio — имейлът е това, с което се влиза.",
      saving: "Запазване…",
      save: "Запази",
      cols: { name: "Име", email: "Имейл", phone: "Телефон", role: "Роля", status: "Статус", manage: "Управление" },
      you: "Вие",
      active: "активен",
      deactivated: "деактивиран",
      editHint: "Редактирай име / имейл / телефон",
      resetTitle: "Отмени паролата и изпрати нова покана",
      resetConfirm: (n) => `Да се изпрати ли нова покана на ${n}? Сегашната парола спира да работи веднага и служителят избира нова.`,
      cantSelf: "Не можете да деактивирате себе си",
      deactivate: "Деактивирай",
      deactivateConfirm: (n) => `Да се деактивира ли ${n}? Историята се запазва, но служителят няма да може да влиза.`,
      reactivate: "Активирай отново",
    },
    errors: {
      roleExists: "Вече има роля с това име. Изберете друго име.",
      badPct: "Процентът не е число, което може да се прочете. Въведете напр. 9 или 20.",
      badAmount: "Сумата не е число, което може да се прочете. Въведете напр. 2.50.",
      taxGoneEdit: "Този данък или такса е премахнат — някой го е изтрил, докато страницата е била отворена. Презаредете и го добавете отново.",
      taxGone: "Този данък или такса вече е премахнат.",
      emailsDenied: "Само собственик или администратор може да променя имейлите до гостите. Помолете някого от тях.",
      emailGone: "Този имейл или език вече не съществува. Презаредете страницата и опитайте отново.",
      notALanguage: "Не изпращаме имейли на този език. Презаредете страницата и опитайте отново.",
      staffDenied: "Само собственик или администратор може да управлява служителите.",
      nameEmail: "Името и имейлът са задължителни.",
      validRole: "Изберете валидна роля.",
      emailTaken: "С този имейл вече има вход в Revio.",
      userNotFound: "Потребителят не е намерен.",
      notARole: "Такава роля няма в този акаунт. Презаредете страницата и опитайте отново.",
      lastOwner: "Това е последният собственик. Първо направете някой друг собственик — акаунт без собственик не може да се управлява.",
      lastActiveOwner: "Това е последният активен собственик. Първо активирайте или повишете някой друг — акаунт без активен собственик не може да се управлява.",
    },
  },
};
