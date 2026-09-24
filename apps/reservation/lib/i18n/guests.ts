import type { Translations } from "@revio/ui/i18n";

/**
 * Guests — the list and one guest's profile (contact, what we have learned, stays, notes, privacy).
 * `table`, `notes`, `duplicates` and `data` are read by client components.
 */
export interface GuestsStrings {
  list: {
    title: string;
    subtitle: (property: string) => string;
    placeholder: string;
    search: string;
    clear: string;
    noMatchTitle: string;
    noMatchBody: string;
    emptyTitle: string;
    emptyBody: string;
  };
  table: {
    cols: { guest: string; email: string; phone: string; company: string; bookings: string };
    count: (n: number) => string;
  };
  profile: {
    since: (property: string, date: string) => string;
    bookAgain: string;
    newReservation: string;
    all: string;
    tabsAria: string;
    tabs: { profile: string; stays: string; notes: string; privacy: string };
    contact: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    requests: string;
    save: string;
    otaAlias: string;
    preferences: string;
    prefNone: string;
    prefPattern: (n: number) => string;
    prefSingle: string;
    preferredRoom: string;
    roomBooked: string;
    avgStay: string;
    lastStay: string;
    avgLead: string;
    lead: string;
    frequency: string;
    lifetime: string;
    cancellations: string;
    nights: (n: string) => string;
    days: (n: number) => string;
    stays: (n: number) => string;
    clean: string;
    cancelRecord: (cancelled: number, noShows: number, total: number) => string;
    duringStay: string;
    duringStaySub: string;
    ancillary: string;
    avgAncillary: string;
    usualRoom: string;
    lastRoom: string;
    usualFloor: string;
    lastFloor: string;
    noPms: string;
    privacy: string;
    privacySub: string;
    optOut: string;
    optOutBody: string;
    notesTitle: (n: number) => string;
    notesSub: string;
    history: (n: number) => string;
    noHistory: string;
    cols: { reservation: string; stay: string; room: string; source: string; total: string; status: string };
    erase: Record<"confirm" | "already-erased" | "merged-record", string>;
  };
  notes: {
    placeholder: string;
    adding: string;
    add: string;
    empty: string;
    edited: string;
    edit: string;
    delete: string;
    cancel: string;
    save: string;
  };
  duplicates: {
    title: string;
    subtitle: (n: number) => string;
    noContact: string;
    reasons: { email: string; phone: string; name: string };
    merge: (first: string) => string;
    note: string;
  };
  data: {
    title: string;
    erasedSub: string;
    erasedBody: (date: string) => string;
    sub: string;
    exportTitle: string;
    exportBody: string;
    export: string;
    eraseTitle: string;
    eraseBody: (name: string) => string;
    cannotUndo: string;
    typeErase: string;
    erase: string;
    keptTitle: string;
    /** In the order core lists them (`ERASURE_RETAINED`). */
    kept: { what: string; why: string }[];
  };
}

export const guests: Translations<GuestsStrings> = {
  en: {
    list: {
      title: "Guests",
      subtitle: (p) => `${p} · contact details and booking history`,
      placeholder: "Name, email, phone, company…",
      search: "Search",
      clear: "Clear",
      noMatchTitle: "No guests match",
      noMatchBody: "Try a different search.",
      emptyTitle: "No guests yet",
      emptyBody: "Guests appear automatically the first time a reservation is created for them.",
    },
    table: {
      cols: { guest: "Guest", email: "Email", phone: "Phone", company: "Company", bookings: "Bookings" },
      count: (n) => `${n} guest${n === 1 ? "" : "s"}`,
    },
    profile: {
      since: (p, d) => `${p} · guest since ${d}`,
      bookAgain: "Book again",
      newReservation: "New reservation",
      all: "← All guests",
      tabsAria: "Guest views",
      tabs: { profile: "Profile", stays: "Stays", notes: "Notes", privacy: "Privacy & data" },
      contact: "Contact & requests",
      firstName: "First name",
      lastName: "Last name",
      email: "Email",
      phone: "Phone",
      company: "Company",
      requests: "Special requests",
      save: "Save",
      otaAlias: "Forwarding address from the OTA — reaches the guest while the booking is live, not afterwards.",
      preferences: "Preferences",
      prefNone: "Nothing to work from yet — this fills in after their first stay",
      prefPattern: (n) => `Worked out from ${n} past stays`,
      prefSingle: "From their single stay so far — not yet a pattern",
      preferredRoom: "Preferred room type",
      roomBooked: "Room type booked",
      avgStay: "Average stay",
      lastStay: "Last stay",
      avgLead: "Average lead time",
      lead: "Lead time",
      frequency: "Booking frequency",
      lifetime: "Lifetime accommodation",
      cancellations: "Cancellation behaviour",
      nights: (n) => `${n} nights`,
      days: (n) => `${n} days`,
      stays: (n) => `${n} stay${n === 1 ? "" : "s"}`,
      clean: "clean record",
      cancelRecord: (c, ns, t) => `${c} cancelled · ${ns} no-show of ${t}`,
      duringStay: "During their stay",
      duringStaySub: "Recorded by RevioPMS — shown here, edited there",
      ancillary: "Ancillary spend (lifetime)",
      avgAncillary: "Avg ancillary / stay",
      usualRoom: "Usual room",
      lastRoom: "Last room",
      usualFloor: "Usual floor",
      lastFloor: "Last floor",
      noPms: "No PMS data for this guest yet — these fields fill in once the property runs RevioPMS (folio + room-assignment history).",
      privacy: "Privacy",
      privacySub: "What this guest has asked us not to do — honoured across RevioDirect, RevioCRS and RevioPMS at once",
      optOut: "Do not recognise this guest across stays",
      optOutBody: "Suppresses “welcome back” on the booking page and the returning-guest note for the front desk. Their stay history is unchanged and still counts in every report.",
      notesTitle: (n) => `Notes (${n})`,
      notesSub: "Staff notes — visible wherever this guest appears, in every Revio product you run",
      history: (n) => `Booking history (${n})`,
      noHistory: "No reservations for this guest yet.",
      cols: { reservation: "Reservation", stay: "Stay", room: "Room", source: "Source", total: "Total", status: "Status" },
      erase: {
        confirm: "Type ERASE in the box to confirm — this cannot be undone.",
        "already-erased": "This guest record has already been erased.",
        "merged-record": "This record has been merged into another. Erase the surviving record instead — that is the one holding the guest's data.",
      },
    },
    notes: {
      placeholder: "Add a note about this guest — a preference, a heads-up, a follow-up…",
      adding: "Adding…",
      add: "Add note",
      empty: "No notes yet. The first one you add stays with this guest wherever their record appears.",
      edited: "edited",
      edit: "Edit note",
      delete: "Delete note",
      cancel: "Cancel",
      save: "Save",
    },
    duplicates: {
      title: "Possible duplicates",
      subtitle: (n) => `${n} other record${n === 1 ? "" : "s"} may be the same person`,
      noContact: "No contact details",
      reasons: { email: "Same email address", phone: "Same phone number", name: "Same name — check before merging" },
      merge: (f) => `Merge into ${f}`,
      note: "Merging moves the other record’s bookings and notes here and fills in any contact detail this profile is missing. Nothing already on this profile is overwritten, and the other record is kept — it stops appearing in lists but its history is not lost.",
    },
    data: {
      title: "Guest data",
      erasedSub: "This record has been erased",
      erasedBody: (d) => `Personal data was removed on ${d} at this guest’s request. The stay history remains so the property’s occupancy and revenue figures stay correct, with the person removed from it.`,
      sub: "What this guest can ask for, and what you can do about it here",
      exportTitle: "Export everything we hold",
      exportBody: "Contact details, every stay, staff notes and a list of invoices — as a JSON file you can send to the guest. Answers a request for access or portability.",
      export: "Export",
      eraseTitle: "Erase this guest",
      eraseBody: (n) => `Removes ${n}’s name, contact details, requests and all staff notes, here and on every one of their bookings.`,
      cannotUndo: "This cannot be undone.",
      typeErase: "Type ERASE to confirm",
      erase: "Erase permanently",
      keptTitle: "What is kept, and why",
      kept: [
        { what: "Tax invoices and credit notes", why: "Retained to meet a legal obligation — GDPR Art. 17(3)(b). Bulgarian tax law requires them, and an invoice must stay reconcilable to the stay it was issued for." },
        { what: "The reservation itself, without the guest's identity", why: "The stay happened and its revenue is part of the hotel's history. Removing it would silently rewrite occupancy and ADR for that period." },
      ],
    },
  },
  bg: {
    list: {
      title: "Гости",
      subtitle: (p) => `${p} · данни за контакт и история на резервациите`,
      placeholder: "Име, имейл, телефон, фирма…",
      search: "Търси",
      clear: "Изчисти",
      noMatchTitle: "Няма такива гости",
      noMatchBody: "Опитайте с друго търсене.",
      emptyTitle: "Все още няма гости",
      emptyBody: "Гостите се появяват автоматично, щом за тях се направи първата резервация.",
    },
    table: {
      cols: { guest: "Гост", email: "Имейл", phone: "Телефон", company: "Фирма", bookings: "Резервации" },
      count: (n) => `${n} ${n === 1 ? "гост" : "гости"}`,
    },
    profile: {
      since: (p, d) => `${p} · гост от ${d}`,
      bookAgain: "Резервирай отново",
      newReservation: "Нова резервация",
      all: "← Всички гости",
      tabsAria: "Изгледи на госта",
      tabs: { profile: "Профил", stays: "Престои", notes: "Бележки", privacy: "Поверителност и данни" },
      contact: "Контакт и желания",
      firstName: "Име",
      lastName: "Фамилия",
      email: "Имейл",
      phone: "Телефон",
      company: "Фирма",
      requests: "Специални желания",
      save: "Запази",
      otaAlias: "Адрес за препращане от OTA — стига до госта, докато резервацията е активна, но не и след това.",
      preferences: "Предпочитания",
      prefNone: "Все още няма от какво да се съди — попълва се след първия престой",
      prefPattern: (n) => `Изведено от ${n} минали престоя`,
      prefSingle: "От единствения досега престой — още не е навик",
      preferredRoom: "Предпочитан тип стая",
      roomBooked: "Резервиран тип стая",
      avgStay: "Среден престой",
      lastStay: "Последен престой",
      avgLead: "Средно предварително",
      lead: "Предварително",
      frequency: "Колко често резервира",
      lifetime: "Нощувки общо (стойност)",
      cancellations: "Анулации",
      nights: (n) => `${n} нощувки`,
      days: (n) => `${n} дни`,
      stays: (n) => `${n} ${n === 1 ? "престой" : "престоя"}`,
      clean: "без анулации",
      cancelRecord: (c, ns, t) => `${c} анулирани · ${ns} неявявания от ${t}`,
      duringStay: "По време на престоя",
      duringStaySub: "Записано от RevioPMS — показва се тук, редактира се там",
      ancillary: "Допълнителни разходи (общо)",
      avgAncillary: "Допълнителни / престой",
      usualRoom: "Обичайна стая",
      lastRoom: "Последна стая",
      usualFloor: "Обичаен етаж",
      lastFloor: "Последен етаж",
      noPms: "Все още няма данни от PMS за този гост — попълват се, щом обектът работи с RevioPMS (сметки и история на стаите).",
      privacy: "Поверителност",
      privacySub: "Какво гостът е поискал да не правим — спазва се едновременно в RevioDirect, RevioCRS и RevioPMS",
      optOut: "Не разпознавай този гост между престоите",
      optOutBody: "Спира „добре дошли отново“ на страницата за резервации и бележката за завръщащ се гост на рецепцията. Историята на престоите не се променя и се брои във всички отчети.",
      notesTitle: (n) => `Бележки (${n})`,
      notesSub: "Бележки на персонала — виждат се навсякъде, където се появява гостът, във всеки продукт на Revio, който ползвате",
      history: (n) => `История на резервациите (${n})`,
      noHistory: "Все още няма резервации за този гост.",
      cols: { reservation: "Резервация", stay: "Престой", room: "Стая", source: "Източник", total: "Общо", status: "Статус" },
      erase: {
        confirm: "Напишете ERASE в полето, за да потвърдите — това не може да бъде отменено.",
        "already-erased": "Данните на този гост вече са изтрити.",
        "merged-record": "Този запис е обединен с друг. Изтрийте оцелелия запис — в него са данните на госта.",
      },
    },
    notes: {
      placeholder: "Добавете бележка за госта — предпочитание, предупреждение, нещо за проследяване…",
      adding: "Добавяне…",
      add: "Добави бележка",
      empty: "Все още няма бележки. Първата, която добавите, остава с госта навсякъде, където се появява записът му.",
      edited: "редактирана",
      edit: "Редактирай бележката",
      delete: "Изтрий бележката",
      cancel: "Отказ",
      save: "Запази",
    },
    duplicates: {
      title: "Възможни дубликати",
      subtitle: (n) => `${n} ${n === 1 ? "друг запис може да е" : "други записа може да са"} същият човек`,
      noContact: "Няма данни за контакт",
      reasons: { email: "Същият имейл адрес", phone: "Същият телефон", name: "Същото име — проверете преди обединяване" },
      merge: (f) => `Обедини в ${f}`,
      note: "Обединяването премества резервациите и бележките от другия запис тук и попълва липсващите данни за контакт. Нищо вече записано в този профил не се презаписва, а другият запис се пази — спира да се показва в списъците, но историята му не се губи.",
    },
    data: {
      title: "Данни на госта",
      erasedSub: "Този запис е изтрит",
      erasedBody: (d) => `Личните данни са премахнати на ${d} по искане на госта. Историята на престоите остава, за да са верни заетостта и приходите на обекта, но без човека в нея.`,
      sub: "Какво може да поиска гостът и какво можете да направите тук",
      exportTitle: "Изнеси всичко, което пазим",
      exportBody: "Данни за контакт, всеки престой, бележките на персонала и списък с фактурите — като JSON файл, който можете да изпратите на госта. Отговаря на искане за достъп или преносимост.",
      export: "Изнеси",
      eraseTitle: "Изтрий този гост",
      eraseBody: (n) => `Премахва името, данните за контакт, желанията и всички бележки на персонала за ${n}, тук и във всяка негова резервация.`,
      cannotUndo: "Това не може да бъде отменено.",
      typeErase: "Напишете ERASE, за да потвърдите",
      erase: "Изтрий завинаги",
      keptTitle: "Какво се пази и защо",
      kept: [
        { what: "Данъчни фактури и кредитни известия", why: "Пазят се, за да се изпълни законово задължение — чл. 17, ал. 3, б. „б“ от GDPR. Българското данъчно законодателство ги изисква, а фактурата трябва да остане свързана с престоя, за който е издадена." },
        { what: "Самата резервация, без самоличността на госта", why: "Престоят се е състоял и приходите от него са част от историята на хотела. Премахването ѝ би променило тихомълком заетостта и ADR за този период." },
      ],
    },
  },
};
