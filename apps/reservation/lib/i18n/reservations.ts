import type { Translations } from "@revio/ui/i18n";

/**
 * Reservations — the list, the availability search, the hold form, one reservation, and what their
 * actions say. `table`, `requests` and `countdown` are read by client components.
 */
export interface ReservationsStrings {
  list: {
    title: string;
    subtitle: (property: string) => string;
    newReservation: string;
    segmentsAria: string;
    segments: Record<"all" | "arriving" | "inhouse" | "departing" | "cancelled", string>;
    segmentHints: Record<"arriving" | "inhouse" | "departing" | "cancelled", string>;
    searchPlaceholder: string;
    anyStatus: string;
    filter: string;
    filteredBy: string;
    remove: (label: string) => string;
    clearAll: string;
    dateTypes: Record<"check_in" | "check_out" | "created" | "cancelled" | "stay", string>;
    chip: { search: string; status: string; date: string; from: (d: string) => string; until: (d: string) => string };
    holds: (n: number) => string;
    expiresIn: string;
    emptyFilteredTitle: string;
    emptyFilteredBody: string;
    emptyTitle: string;
    emptyBody: string;
  };
  table: {
    cols: { guest: string; stay: string; room: string; source: string; total: string; status: string; booked: string };
    count: (n: number) => string;
  };
  requests: {
    waiting: (n: number) => string;
    held: string;
    nights: (n: number) => string;
    asked: (date: string) => string;
    decline: string;
    accept: string;
    failed: string;
  };
  countdown: { expiring: string; m: string; s: string };
  search: {
    title: string;
    subtitle: (property: string) => string;
    back: string;
    range: string;
    guests: string;
    rooms: string;
    source: string;
    search: string;
    header: (nights: number, from: string, to: string, guests: number, rooms: number) => string;
    requestedSoldOut: string;
    sleeps: (n: number) => string;
    requested: string;
    alternative: string;
    upgrade: string;
    left: (n: number) => string;
    soldOutNight: string;
    tooSmall: string;
    from: string;
    forStay: (plan: string, amount: string) => string;
    hold: string;
    holding: string;
    restricted: string;
    doesntFit: string;
    soldOut: string;
    holdNote: string;
  };
  hold: {
    title: string;
    expired: string;
    searchAgain: string;
    subtitle: (property: string) => string;
    party: (rooms: number, guests: number) => string;
    expiresIn: (min: number) => string;
    guest: string;
    returning: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    requests: string;
    requestsPlaceholder: string;
    stayPrice: string;
    ratePlan: string;
    total: (currency: string) => string;
    source: string;
    guarantee: string;
    notes: string;
    priceNote: string;
    emailGuest: string;
    release: string;
    confirm: string;
    confirming: string;
  };
  guarantees: Record<string, string>;
  detail: {
    subtitle: (ref: string, property: string) => string;
    all: string;
    failedTitle: string;
    failedCause: string;
    failedWhy: string;
    failedFix: string;
    failedNothingLost: string;
    stay: string;
    room: string;
    dates: string;
    guests: string;
    ratePlan: string;
    total: string;
    source: string;
    guarantee: string;
    booked: string;
    cancelled: string;
    notes: string;
    cancel: string;
    emailGuest: string;
    noShow: string;
    guest: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    requests: string;
    modify: string;
    modifyHint: string;
    roomType: string;
    arrival: string;
    departure: string;
    rooms: string;
    totalIn: (currency: string) => string;
    apply: string;
    emailUpdated: string;
    timeline: string;
    timelineFailed: (channel: string, date: string) => string;
    timelineEmpty: string;
    theChannel: string;
    event: string;
    fields: Record<string, string>;
  };
  errors: {
    pickDates: string;
    noAvailability: (room: string, date: string) => string;
    restricted: (room: string, reason: string) => string;
    taken: (room: string) => string;
    soldOut: string;
    holdExpired: string;
    priceUnreadable: string;
    nameAndPlan: string;
    pickPlan: string;
    alreadyConfirmed: string;
    departureAfter: string;
    past: (label: string, date: string, earliest: string) => string;
    noAvailabilityModify: (date: string) => string;
    inHouseCancel: string;
    noShowTooEarly: string;
    noShowCheckedIn: string;
  };
  /** Why a stay cannot be sold — the restriction gate. */
  violations: {
    stopSell: (date: string) => string;
    arrivalsClosed: (date: string) => string;
    minStay: (n: number, date: string) => string;
    advance: (date: string, window: string) => string;
    atLeast: (n: number) => string;
    atMost: (n: number) => string;
    and: string;
  };
  mail: {
    confirmed: string;
    modified: string;
    cancelled: string;
    none: (done: string) => string;
    sent: (done: string) => string;
    noAddress: (done: string) => string;
    channel: (done: string) => string;
    switchedOff: (done: string) => string;
    failed: (done: string) => string;
  };
}

export const reservations: Translations<ReservationsStrings> = {
  en: {
    list: {
      title: "Reservations",
      subtitle: (p) => `${p} · every booking, from every source`,
      newReservation: "New reservation",
      segmentsAria: "Reservation segments",
      segments: { all: "All", arriving: "Arriving today", inhouse: "In house", departing: "Departing today", cancelled: "Cancelled" },
      segmentHints: {
        arriving: "Confirmed stays checking in today",
        inhouse: "Stays covering tonight — checked in and not yet departed",
        departing: "Stays whose checkout date is today",
        cancelled: "Cancelled today — the ones that just freed a room",
      },
      searchPlaceholder: "Guest, email, phone, ID…",
      anyStatus: "Any status",
      filter: "Filter",
      filteredBy: "Filtered by",
      remove: (l) => `Remove the ${l.toLowerCase()} filter`,
      clearAll: "Clear all",
      dateTypes: { check_in: "Check-in", check_out: "Check-out", created: "Reservation made on", cancelled: "Cancellation date", stay: "Staying on (in-house)" },
      chip: { search: "Search", status: "Status", date: "Date", from: (d) => `from ${d}`, until: (d) => `until ${d}` },
      holds: (n) => `${n} live hold${n > 1 ? "s" : ""} — inventory locked until confirmed or expired`,
      expiresIn: "expires in",
      emptyFilteredTitle: "Nothing matches these filters",
      emptyFilteredBody: "Loosen the filters or clear them to see everything.",
      emptyTitle: "No reservations yet",
      emptyBody: "Create the first one — the Availability Search flows straight into a held, confirmable booking.",
    },
    table: {
      cols: { guest: "Guest", stay: "Stay", room: "Room", source: "Source", total: "Total", status: "Status", booked: "Booked" },
      count: (n) => `${n} reservation${n === 1 ? "" : "s"}`,
    },
    requests: {
      waiting: (n) => `${n} booking ${n === 1 ? "request" : "requests"} waiting for you`,
      held: "· the room is held until you answer",
      nights: (n) => `${n} ${n === 1 ? "night" : "nights"}`,
      asked: (d) => `asked ${d}`,
      decline: "Decline",
      accept: "Accept",
      failed: "That didn't work.",
    },
    countdown: { expiring: "expiring…", m: "m", s: "s" },
    search: {
      title: "Availability Search",
      subtitle: (p) => `${p} · see what's free, then hold it while you take the guest's details`,
      back: "← Reservations",
      range: "Arrival → departure",
      guests: "Guests",
      rooms: "Rooms",
      source: "Booking source",
      search: "Search",
      header: (n, f, t, g, q) => `${n} night${n === 1 ? "" : "s"} · ${f} → ${t} · ${g} guest${g === 1 ? "" : "s"} · ${q} room${q === 1 ? "" : "s"}`,
      requestedSoldOut: "The requested room type is sold out for these dates — alternatives below are available.",
      sleeps: (n) => `sleeps ${n}`,
      requested: "requested",
      alternative: "alternative",
      upgrade: "upgrade",
      left: (n) => `${n} left across every night`,
      soldOutNight: "Sold out on at least one night",
      tooSmall: " · too small for this party",
      from: "from",
      forStay: (p, a) => `${p} — ${a} for the whole stay`,
      hold: "Hold & continue",
      holding: "Holding…",
      restricted: "restricted",
      doesntFit: "doesn't fit",
      soldOut: "sold out",
      holdNote: "“Hold & continue” locks the rooms instantly — they’re off sale everywhere (including channels) while you take the guest’s details. Abandoned holds release automatically.",
    },
    hold: {
      title: "Create Reservation",
      expired: "This hold has expired — its rooms went back on sale.",
      searchAgain: "Search again",
      subtitle: (p) => `${p} · step 2 of 2 — the room is held while you take their details`,
      party: (r, g) => `${r} room${r === 1 ? "" : "s"} · ${g} guest${g === 1 ? "" : "s"}`,
      expiresIn: (m) => `hold expires in ~${m} min`,
      guest: "Guest",
      returning: "returning · details prefilled",
      firstName: "First name *",
      lastName: "Last name *",
      email: "Email",
      phone: "Phone",
      company: "Company",
      requests: "Special requests",
      requestsPlaceholder: "Free text — e.g. high floor, late arrival",
      stayPrice: "Stay & price",
      ratePlan: "Rate plan *",
      total: (c) => `Total price (${c}) *`,
      source: "Booking source *",
      guarantee: "Payment guarantee *",
      notes: "Notes",
      priceNote: "The suggested price is the selected plan’s nightly rates for this stay; override it freely. Payment guarantee is a label only — no card data is stored.",
      emailGuest: "Email the guest a confirmation",
      release: "Release hold",
      confirm: "Confirm reservation",
      confirming: "Confirming…",
    },
    guarantees: { card_on_file: "Card on file", company_account: "Company account", prepaid_ota: "Prepaid via OTA", none: "No guarantee" },
    detail: {
      subtitle: (ref, p) => `Reservation #${ref} · ${p}`,
      all: "← All reservations",
      failedTitle: "This booking is not in your calendar, and the room is still on sale",
      failedCause: "The channel sold it under a room type or rate plan that is not mapped here.",
      failedWhy: "We deliberately did not guess which room it meant — guessing is how two guests end up in one room. The guest has been confirmed by the channel, so somebody may still arrive.",
      failedFix: "Map that room type and rate plan in RevioLink, then re-sync to bring the booking in.",
      failedNothingLost: "Nothing here was lost — the booking is held until the mapping is finished.",
      stay: "Stay",
      room: "Room",
      dates: "Dates",
      guests: "Guests",
      ratePlan: "Rate plan",
      total: "Total",
      source: "Source",
      guarantee: "Payment guarantee",
      booked: "Booked",
      cancelled: "Cancelled",
      notes: "Notes",
      cancel: "Cancel reservation",
      emailGuest: "Email the guest",
      noShow: "Mark no-show",
      guest: "Guest",
      name: "Name",
      email: "Email",
      phone: "Phone",
      company: "Company",
      requests: "Special requests",
      modify: "Modify stay",
      modifyHint: "— validated first; if the new stay doesn’t fit, nothing changes",
      roomType: "Room type",
      arrival: "Arrival",
      departure: "Departure",
      rooms: "Rooms",
      totalIn: (c) => `Total (${c})`,
      apply: "Apply change",
      emailUpdated: "Email the guest the updated booking",
      timeline: "Timeline",
      timelineFailed: (ch, d) => `This booking arrived from ${ch} on ${d} and could not be imported. Nothing else will be recorded until it is brought in.`,
      timelineEmpty: "No events recorded for this reservation yet.",
      theChannel: "the channel",
      event: "event",
      fields: { placed: "placed", created: "created", modified: "modified", cancelled: "cancelled", "no-show": "no-show", status: "status" },
    },
    errors: {
      pickDates: "Pick valid arrival and departure dates.",
      noAvailability: (r, d) => `${r} has no availability on ${d} — pick an alternative.`,
      restricted: (r, why) => `${r}: ${why}`,
      taken: (r) => `${r} was taken while you were choosing — search again to see what is left.`,
      soldOut: "Those dates just sold out — there is no longer a room free for the whole stay.",
      holdExpired: "This hold has expired — availability was re-opened. Please search again.",
      priceUnreadable: "That price isn’t a number we can read. Enter an amount like 129.50.",
      nameAndPlan: "Guest name and rate plan are required.",
      pickPlan: "Pick a rate plan.",
      alreadyConfirmed: "Somebody else confirmed this hold a moment ago, so it is already a reservation. Search again to book another room.",
      departureAfter: "Departure must be after arrival.",
      past: (l, d, e) => `${l} of ${d} has already passed. The earliest you can pick is ${e}.`,
      noAvailabilityModify: (d) => `No availability for the new stay on ${d} — the reservation was NOT changed.`,
      inHouseCancel: "This guest has already checked in. Check them out in RevioPMS to end the stay — cancelling would put an occupied room back on sale.",
      noShowTooEarly: "No-show can only be set after the check-in date has passed.",
      noShowCheckedIn: "This guest has already checked in, so they are not a no-show. End the stay with a check-out in RevioPMS.",
    },
    violations: {
      stopSell: (d) => `Closed to sale on ${d}.`,
      arrivalsClosed: (d) => `Arrivals are closed on ${d}.`,
      minStay: (n, d) => `Minimum stay is ${n} nights for ${d}.`,
      advance: (d, w) => `The advance-purchase window for ${d} is closed (book ${w} days ahead).`,
      atLeast: (n) => `≥${n}`,
      atMost: (n) => `≤${n}`,
      and: " and ",
    },
    mail: {
      confirmed: "Reservation confirmed.",
      modified: "Reservation changed.",
      cancelled: "Reservation cancelled.",
      none: (d) => `${d} No email was sent to the guest.`,
      sent: (d) => `${d} The guest has been emailed.`,
      noAddress: (d) => `${d} No email was sent — this guest has no email address on file.`,
      channel: (d) => `${d} The channel emails its own guest, so we did not.`,
      switchedOff: (d) => `${d} No email was sent — that email is switched off in Settings → Guest emails.`,
      failed: (d) => `${d} The email to the guest could not be sent — the reservation itself is saved.`,
    },
  },
  bg: {
    list: {
      title: "Резервации",
      subtitle: (p) => `${p} · всяка резервация, от всеки източник`,
      newReservation: "Нова резервация",
      segmentsAria: "Групи резервации",
      segments: { all: "Всички", arriving: "Пристигат днес", inhouse: "Настанени", departing: "Напускат днес", cancelled: "Анулирани" },
      segmentHints: {
        arriving: "Потвърдени престои, които започват днес",
        inhouse: "Престои, които включват тази нощ — настанени и още не напуснали",
        departing: "Престои с дата на напускане днес",
        cancelled: "Анулирани днес — тези, които току-що освободиха стая",
      },
      searchPlaceholder: "Гост, имейл, телефон, номер…",
      anyStatus: "Всеки статус",
      filter: "Филтрирай",
      filteredBy: "Филтрирано по",
      remove: (l) => `Премахни филтъра „${l}“`,
      clearAll: "Изчисти всички",
      dateTypes: { check_in: "Настаняване", check_out: "Напускане", created: "Направена на", cancelled: "Дата на анулиране", stay: "Престой на (настанени)" },
      chip: { search: "Търсене", status: "Статус", date: "Дата", from: (d) => `от ${d}`, until: (d) => `до ${d}` },
      holds: (n) => `${n} ${n === 1 ? "активно задържане" : "активни задържания"} — наличността е заключена до потвърждение или изтичане`,
      expiresIn: "изтича след",
      emptyFilteredTitle: "Нищо не отговаря на тези филтри",
      emptyFilteredBody: "Разхлабете филтрите или ги изчистете, за да видите всичко.",
      emptyTitle: "Все още няма резервации",
      emptyBody: "Създайте първата — търсенето на наличност води направо до задържана резервация, готова за потвърждение.",
    },
    table: {
      cols: { guest: "Гост", stay: "Престой", room: "Стая", source: "Източник", total: "Общо", status: "Статус", booked: "Направена" },
      count: (n) => `${n} ${n === 1 ? "резервация" : "резервации"}`,
    },
    requests: {
      waiting: (n) => `${n} ${n === 1 ? "заявка за резервация чака" : "заявки за резервация чакат"} отговор`,
      held: "· стаята е задържана, докато отговорите",
      nights: (n) => `${n} ${n === 1 ? "нощувка" : "нощувки"}`,
      asked: (d) => `заявена на ${d}`,
      decline: "Откажи",
      accept: "Приеми",
      failed: "Не се получи.",
    },
    countdown: { expiring: "изтича…", m: " мин", s: " с" },
    search: {
      title: "Търсене на наличност",
      subtitle: (p) => `${p} · вижте какво е свободно и го задръжте, докато вземате данните на госта`,
      back: "← Резервации",
      range: "Пристигане → напускане",
      guests: "Гости",
      rooms: "Стаи",
      source: "Източник на резервацията",
      search: "Търси",
      header: (n, f, t, g, q) => `${n} ${n === 1 ? "нощувка" : "нощувки"} · ${f} → ${t} · ${g} ${g === 1 ? "гост" : "гости"} · ${q} ${q === 1 ? "стая" : "стаи"}`,
      requestedSoldOut: "Търсеният тип стая е разпродаден за тези дати — долу има свободни алтернативи.",
      sleeps: (n) => `за ${n} ${n === 1 ? "човек" : "души"}`,
      requested: "търсена",
      alternative: "алтернатива",
      upgrade: "по-добра стая",
      left: (n) => `остават ${n} за всяка нощ`,
      soldOutNight: "Разпродадена поне за една нощ",
      tooSmall: " · твърде малка за тази група",
      from: "от",
      forStay: (p, a) => `${p} — ${a} за целия престой`,
      hold: "Задръж и продължи",
      holding: "Задържане…",
      restricted: "ограничена",
      doesntFit: "не побира",
      soldOut: "разпродадена",
      holdNote: "„Задръж и продължи“ заключва стаите веднага — те излизат от продажба навсякъде (включително в каналите), докато вземате данните на госта. Изоставените задържания се освобождават сами.",
    },
    hold: {
      title: "Нова резервация",
      expired: "Задържането е изтекло — стаите му отново са в продажба.",
      searchAgain: "Търсете отново",
      subtitle: (p) => `${p} · стъпка 2 от 2 — стаята е задържана, докато вземате данните`,
      party: (r, g) => `${r} ${r === 1 ? "стая" : "стаи"} · ${g} ${g === 1 ? "гост" : "гости"}`,
      expiresIn: (m) => `задържането изтича след ~${m} мин`,
      guest: "Гост",
      returning: "завръщащ се · данните са попълнени",
      firstName: "Име *",
      lastName: "Фамилия *",
      email: "Имейл",
      phone: "Телефон",
      company: "Фирма",
      requests: "Специални желания",
      requestsPlaceholder: "Свободен текст — напр. висок етаж, късно пристигане",
      stayPrice: "Престой и цена",
      ratePlan: "Ценови план *",
      total: (c) => `Обща цена (${c}) *`,
      source: "Източник на резервацията *",
      guarantee: "Гаранция за плащане *",
      notes: "Бележки",
      priceNote: "Предложената цена е сборът от нощните цени на избрания план за този престой; можете да я промените свободно. Гаранцията за плащане е само етикет — данни за карти не се пазят.",
      emailGuest: "Изпрати на госта потвърждение по имейл",
      release: "Освободи задържането",
      confirm: "Потвърди резервацията",
      confirming: "Потвърждаване…",
    },
    guarantees: { card_on_file: "Карта", company_account: "Фирмена сметка", prepaid_ota: "Предплатена чрез OTA", none: "Без гаранция" },
    detail: {
      subtitle: (ref, p) => `Резервация №${ref} · ${p}`,
      all: "← Всички резервации",
      failedTitle: "Тази резервация не е в календара Ви, а стаята още се продава",
      failedCause: "Каналът я е продал с тип стая или ценови план, които не са свързани тук.",
      failedWhy: "Нарочно не сме гадали коя стая е имал предвид — точно така двама гости се озовават в една стая. Каналът е потвърдил резервацията на госта, така че някой може да пристигне.",
      failedFix: "Свържете този тип стая и ценови план в RevioLink и синхронизирайте отново, за да влезе резервацията.",
      failedNothingLost: "Нищо не е загубено — резервацията чака, докато свързването бъде завършено.",
      stay: "Престой",
      room: "Стая",
      dates: "Дати",
      guests: "Гости",
      ratePlan: "Ценови план",
      total: "Общо",
      source: "Източник",
      guarantee: "Гаранция за плащане",
      booked: "Направена",
      cancelled: "Анулирана",
      notes: "Бележки",
      cancel: "Анулирай резервацията",
      emailGuest: "Уведоми госта по имейл",
      noShow: "Отбележи като неявил се",
      guest: "Гост",
      name: "Име",
      email: "Имейл",
      phone: "Телефон",
      company: "Фирма",
      requests: "Специални желания",
      modify: "Промени престоя",
      modifyHint: "— първо се проверява; ако новият престой не е възможен, нищо не се променя",
      roomType: "Тип стая",
      arrival: "Пристигане",
      departure: "Напускане",
      rooms: "Стаи",
      totalIn: (c) => `Общо (${c})`,
      apply: "Приложи промяната",
      emailUpdated: "Изпрати на госта обновената резервация",
      timeline: "Хронология",
      timelineFailed: (ch, d) => `Тази резервация е дошла от ${ch} на ${d} и не можа да бъде внесена. Нищо друго няма да се записва, докато не бъде внесена.`,
      timelineEmpty: "Все още няма записани събития за тази резервация.",
      theChannel: "канала",
      event: "събитие",
      fields: { placed: "задържана", created: "създадена", modified: "променена", cancelled: "анулирана", "no-show": "неявил се", status: "статус" },
    },
    errors: {
      pickDates: "Изберете валидни дати на пристигане и напускане.",
      noAvailability: (r, d) => `${r} няма наличност на ${d} — изберете алтернатива.`,
      restricted: (r, why) => `${r}: ${why}`,
      taken: (r) => `${r} беше заета, докато избирахте — търсете отново, за да видите какво е останало.`,
      soldOut: "Тези дати току-що се разпродадоха — вече няма свободна стая за целия престой.",
      holdExpired: "Задържането е изтекло — наличността е отново отворена. Моля, търсете отново.",
      priceUnreadable: "Не можем да прочетем тази цена като число. Въведете сума като 129,50.",
      nameAndPlan: "Името на госта и ценовият план са задължителни.",
      pickPlan: "Изберете ценови план.",
      alreadyConfirmed: "Някой друг току-що потвърди това задържане и то вече е резервация. Търсете отново, за да резервирате друга стая.",
      departureAfter: "Напускането трябва да е след пристигането.",
      past: (l, d, e) => `${l} на ${d} вече е минало. Най-ранната дата, която можете да изберете, е ${e}.`,
      noAvailabilityModify: (d) => `Няма наличност за новия престой на ${d} — резервацията НЕ е променена.`,
      inHouseCancel: "Този гост вече е настанен. Отпишете го в RevioPMS, за да приключите престоя — анулирането би пуснало заета стая обратно в продажба.",
      noShowTooEarly: "„Неявил се“ може да се отбележи само след като датата на настаняване е минала.",
      noShowCheckedIn: "Този гост вече е настанен, така че не е неявил се. Приключете престоя с отписване в RevioPMS.",
    },
    violations: {
      stopSell: (d) => `Затворена за продажба на ${d}.`,
      arrivalsClosed: (d) => `Пристиганията са затворени на ${d}.`,
      minStay: (n, d) => `Минималният престой е ${n} нощувки за ${d}.`,
      advance: (d, w) => `Прозорецът за предварителна резервация за ${d} е затворен (резервира се ${w} дни предварително).`,
      atLeast: (n) => `≥${n}`,
      atMost: (n) => `≤${n}`,
      and: " и ",
    },
    mail: {
      confirmed: "Резервацията е потвърдена.",
      modified: "Резервацията е променена.",
      cancelled: "Резервацията е анулирана.",
      none: (d) => `${d} На госта не е изпратен имейл.`,
      sent: (d) => `${d} Гостът е уведомен по имейл.`,
      noAddress: (d) => `${d} Не е изпратен имейл — гостът няма записан имейл адрес.`,
      channel: (d) => `${d} Каналът изпраща имейл на госта си, затова ние не изпратихме.`,
      switchedOff: (d) => `${d} Не е изпратен имейл — този имейл е изключен в Настройки → Имейли до гостите.`,
      failed: (d) => `${d} Имейлът до госта не можа да бъде изпратен — самата резервация е запазена.`,
    },
  },
};
