import type { Translations } from "@revio/ui/i18n";
import type { PublicBookingErrorCode } from "@revio/booking";

/**
 * Everything RevioDirect says to a guest, in the guest's language.
 *
 * ## Why one dictionary for the whole app
 *
 * The page is one short journey — search, choose, details, confirmed — and the same few words recur
 * on every step: nights, guests, total, the hotel's times. Split per component, "2 nights" was
 * written five times and would have been translated five slightly different ways.
 *
 * ## What is NOT in here
 *
 * The hotel's own words — its name, headline, room names, rate plan names, cancellation policy,
 * tax names, extras. Those are the hotel's content, written in whatever language the hotel wrote
 * them, and shown as written. The built-in hero copy is the exception: it is ours (`hero` below)
 * and is used only while the hotel has written none.
 *
 * ## Plurals
 *
 * Counted nouns are functions, never `n === 1 ? a : b` in a component — Bulgarian has its own
 * forms ("1 нощувка", "2 нощувки"; "1 вид стая", "3 вида стаи") and a third language will have others.
 *
 * Bulgarian addresses the guest with the polite, capitalised Вие — the register of every hotel site
 * a Bulgarian guest already books on.
 */
export interface GuestStrings {
  count: {
    nights: (n: number) => string;
    guests: (n: number) => string;
    days: (n: number) => string;
    roomTypes: (n: number) => string;
    rates: (n: number) => string;
    photos: (n: number) => string;
  };
  meta: { title: (hotel: string) => string; description: (hotel: string) => string; notFound: string };
  /** The two pages outside any hotel — a link that goes nowhere, and our own failure. */
  page: {
    eyebrow: string;
    unavailableTitle: string; unavailableBody: string;
    errorTitle: string; errorBody: string; retry: string;
    digest: string;
  };
  hero: { headline: string; subheadline: string };
  header: { official: string; call: (hotel: string) => string; language: string; myBooking: string };
  home: {
    eyebrow: (hotel: string) => string;
    goodToKnow: string;
    times: string;
    timesValue: (checkIn: string, checkOut: string) => string;
    where: string;
    talk: string;
  };
  trust: {
    feesTitle: string; feesBody: string;
    chargedTitle: string; chargedBody: string;
    liveTitle: string; liveBody: string;
    times: (checkIn: string, checkOut: string) => string;
  };
  footer: {
    times: (checkIn: string, checkOut: string) => string; allIn: string;
    contact: string; stay: string; help: string; myBooking: string; directions: string; securePay: string; directBenefit: string;
  };
  /**
   * The consent banner — shown only when the hotel has added its own Google Analytics or Meta pixel.
   * Accept and Decline carry equal weight: a "Decline" hidden behind a second click is not consent.
   */
  consent: { label: string; body: (hotel: string, tools: string) => string; accept: string; decline: string; settings: string };
  pay: {
    title: (hotel: string) => string; lead: string; amount: string; forStay: string;
    pay: (amount: string) => string; paying: string;
    paidTitle: string; paidBody: (amount: string) => string;
    expiredTitle: string; expiredBody: string; cancelledTitle: string; cancelledBody: string;
    notOpen: string; notReady: string; failed: string; secure: string;
  };
  promo: {
    have: string; label: string; apply: string; remove: string;
    badge: (code: string, pct: number) => string;
    applied: (code: string) => string;
    code: (code: string) => string;
    refusal: Record<"unknown" | "inactive" | "dates" | "nights" | "used_up", (code: string) => string>;
  };
  ratings: { label: string; reviews: (n: number) => string };
  direct: {
    badge: (pct: number) => string;
    saving: (amount: string) => string;
    line: (pct: number) => string;
    struckTitle: string;
    saved: string;
  };
  group: { title: string; change: string; chooseNow: string; next: string; summary: (n: number) => string; roomsTotal: string; othersTitle: string; cancelled: string };
  myBooking: {
    title: string; body: string; reference: string; referenceHint: string; email: string;
    send: string; sending: string; sent: string; limited: string;
  };
  bar: {
    dates: string; addDates: string; guests: string; guestsCount: (n: number) => string;
    search: string; checkIn: string; checkOut: string; addDate: string;
    ready: (nights: number) => string; empty: string;
    yourDates: string; close: string;
    guestsHint: string; fewer: string; more: string; guestsNote: string; done: string;
    adults: string; adultsHint: string; children: string; childrenHint: string;
    fewerChildren: string; moreChildren: string;
    childAge: (n: number) => string; agePick: string; ageOption: (age: number) => string;
    party: (adults: number, children: number) => string; needAges: string;
    rooms: string; roomsHint: string; fewerRooms: string; moreRooms: string; roomN: (n: number) => string;
    roomsParty: (rooms: number, adults: number, children: number) => string;
  };
  calendar: {
    prev: string; next: string; chooseCheckOut: string; chooseCheckIn: string; clear: string; done: string;
    /** Under the grid when prices show: what the small numbers are. */
    priceLegend: string; lowest: string;
    /** Screen-reader day label additions. */
    dayFrom: (price: string) => string; dayFull: string;
  };
  steps: { names: [string, string, string, string]; progress: string; back: string };
  search: {
    summary: (nights: number, guests: number) => string;
    chooseTitle: string; chooseBody: string;
    altTitle: string; noneTitle: string;
    altBody: (nights: number) => string;
    noneBody: (nights: number) => string;
    available: (n: number) => string;
    footnote: string; footnoteRequest: string;
    total: string;
    earlier: (days: number) => string;
    later: (days: number) => string;
    callHotel: (phone: string) => string;
    checking: string;
    rateLimited: string;
  };
  room: {
    sleeps: (n: number) => string;
    lastRoom: string;
    onlyLeft: (n: number) => string;
    otherRates: (n: number) => string;
    bestPrice: string;
    roomsFor: (nights: number) => string;
    totalPerNight: (perNight: string) => string;
    select: string;
    photoAlt: (room: string) => string;
    details: string;
    detailsWithPhotos: (n: number) => string;
    close: string;
    photoN: (room: string, n: number) => string;
    photo: (n: number) => string;
    prevPhoto: string; nextPhoto: string;
    empty: string;
    chooseRate: string;
    ratesForDates: string; seeRates: string; from: (total: string) => string;
    /** Under a rate's price: "total for 3 nights", and what it holds beyond the room. */
    totalFor: (nights: number) => string; includes: (what: string) => string;
    stickySelect: string; stickyTotal: string;
  };
  book: {
    title: string;
    summary: (nights: number, guests: number) => string;
    sleepsUpTo: (n: number) => string;
    extras: string; total: string;
    paidAtHotel: string;
    paidNow: string;
    splitHotel: (now: string, hotel: string) => string;
    splitLater: (now: string, later: string, on: string) => string;
    whoTitle: string;
    firstName: string; lastName: string; email: string; phone: string; optional: string;
    emailHint: string; phoneHint: string;
    note: string; notePlaceholder: string; noteHint: string;
    extrasTitle: string; extrasLead: string; perNight: (price: string, nights: number) => string; perStay: string; extrasNone: string;
    holdingTitle: string; nextTitle: string;
    guaranteeBold: string; guaranteeBody: string; guaranteeStrong: string; guaranteeTail: string;
    payNowBold: (amount: string) => string; payNowBody: string; acceptPay: string;
    requestBold: string; requestBody: string;
    cancellation: string;
    terms: string;
    accept: string; acceptCard: string;
    confirming: string; sending: string; confirm: string; request: string;
    confirmHint: string; requestHint: string;
    holdExpired: string;
    holding: string;
  };
  errors: {
    unavailablePage: string;
    name: string; email: string; terms: string;
    holdGone: string; card: string; priceMoved: string; guests: string; generic: string;
    booking: Record<PublicBookingErrorCode, string>;
    tooMany: string;
    waitlistName: string;
    waitlist: Record<"invalid-dates" | "departure-before-arrival" | "in-the-past" | "no-guests" | "too-many-guests", string>;
    waitlistGeneric: string;
  };
  done: {
    cancelledTitle: string; requestTitle: string; bookedTitle: string;
    cancelledBody: string;
    requestLead: (hotel: string) => string;
    requestTail: string;
    bookedBody: string;
    reference: (ref: string) => string;
    welcomeBack: (nth: number) => string;
    checkIn: string; checkOut: string; length: string;
    from: (time: string) => string; by: (time: string) => string;
    totalAtHotel: string;
    total: string; paidOnline: (last4: string) => string; chargedOn: (day: string) => string; atHotel: string;
    nothingCharged: string;
    guaranteeOnly: (last4: string) => string;
    nextTitle: string;
    addGoogle: string; addIcs: string; directions: string;
    requestNext: (hotel: string) => string;
    requestHeld: string;
    requestCall: string; requestCallTail: string;
    bookedNext: string;
    bookedArrive: (time: string) => string;
    bookedArrivePaid: (time: string) => string;
    bookedCall: string; bookedCallTail: string;
    /** When the manage panel is on screen: the phone is for everything else. */
    bookedCallOther: string; bookedCallOtherTail: string;
    /** A cancelled booking's total row — the figure stays for reference, the words say nothing is owed. */
    cancelledTotal: string;
    on: string;
  };
  manage: {
    title: string;
    changeDates: string; changeDatesSub: string;
    cancel: string; cancelSub: string;
    cancelConfirm: string; keep: string; cancelling: string;
    /** The money, before they press — from the terms they agreed to. */
    freeRefund: (amount: string) => string;
    free: string;
    fee: (fee: string) => string;
    refundPart: (amount: string) => string;
    chargePart: (amount: string) => string;
    noTerms: string;
    blockedPaid: (phone: string | null) => string;
    blockedRequested: string;
    inHouse: string;
    notAllowed: string;
    /** After it happened. */
    cancelledRefund: (amount: string) => string;
    cancelledFee: (amount: string) => string;
    changedNotice: string;
    /** No key in the link: ask for the email, send the link. */
    askTitle: string; askBody: string; askEmail: string; askSend: string; askSending: string;
    askSent: string; askLimited: string;
    linkEmailSubject: (hotel: string) => string;
    linkEmailBody: string; linkEmailCta: string;
    /** The change-dates page. */
    changeTitle: string; changeLead: (room: string) => string;
    current: string; proposed: string;
    pickDates: string; checking: string;
    newTotal: string; difference: (sign: string, amount: string) => string; sameTotal: string;
    confirmChange: string; changing: string; back: string;
    refusal: Record<"invalid" | "unavailable" | "sold_out" | "too_long" | "not_allowed" | "same_dates" | "needs_payment" | "price_changed", string>;
  };
  waitlist: {
    joinedTitle: string;
    title: string;
    body: (nights: number) => string;
    name: string; email: string;
    adding: string; tellMe: string;
    /** Same promise as core's `describeJoin`, in the guest's language. */
    joined: (ttlMinutes: number) => string;
    /** For the waitlist email's {{holdWindow}}: "24 hours". */
    holdWindow: (hours: number) => string;
    expiredTitle: string; expiredBody: string;
    usedTitle: string; usedBody: string;
    goneTitle: string; goneBody: string;
    takenTitle: string; takenBody: string; unpricedBody: string;
    searchOther: (hotel: string) => string;
  };
}

/** 1-ви, 2-ри, 3-ти, 7-ми, 11-ти, 21-ви — Bulgarian ordinal endings. */
function bgOrdinal(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return `${n}-ти`;
  if (last === 1) return `${n}-ви`;
  if (last === 2) return `${n}-ри`;
  if (last === 7 || last === 8) return `${n}-ми`;
  return `${n}-ти`;
}
function enOrdinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}
const en1 = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const guest: Translations<GuestStrings> = {
  en: {
    count: {
      nights: (n) => en1(n, "night", "nights"),
      guests: (n) => en1(n, "guest", "guests"),
      days: (n) => en1(n, "day", "days"),
      roomTypes: (n) => en1(n, "room type", "room types"),
      rates: (n) => en1(n, "rate", "rates"),
      photos: (n) => en1(n, "photo", "photos"),
    },
    meta: {
      title: (h) => `Book ${h}`,
      description: (h) => `Book direct at ${h}. Best rate, no booking fees.`,
      notFound: "Not found",
    },
    page: {
      eyebrow: "Booking",
      unavailableTitle: "This booking page isn’t available",
      unavailableBody: "The link may be mistyped or no longer active. If a hotel sent you here, please check the address with them directly.",
      errorTitle: "Something went wrong on our side",
      errorBody: "This page didn’t load properly. If you had already confirmed a booking, it is safe — check your email for the confirmation before trying again.",
      retry: "Try again",
      digest: "If you contact the hotel about this, quote reference",
    },
    hero: {
      headline: "Book direct. Pay less.",
      subheadline: "No commission goes to a travel site, so the rate you see is the one the hotel actually wants to give you — with taxes and fees already in the number.",
    },
    header: { official: "Official site", call: (h) => `Call ${h}`, language: "Language", myBooking: "My booking" },
    home: {
      eyebrow: (h) => `Official booking · ${h}`,
      goodToKnow: "Good to know",
      times: "Check-in & check-out",
      timesValue: (i, o) => `From ${i}, out by ${o}`,
      where: "Where you'll stay",
      talk: "Prefer to talk to someone?",
    },
    trust: {
      feesTitle: "No booking fees",
      feesBody: "You pay the hotel, not a middleman. No commission is added to your rate.",
      chargedTitle: "You pay the hotel directly",
      chargedBody: "Each rate says what is paid now and what at the hotel. Your card details never reach us.",
      liveTitle: "Live availability",
      liveBody: "Rooms shown here are genuinely free right now — not a cached copy.",
      times: (i, o) => `Check-in from ${i}, check-out by ${o}.`,
    },
    footer: {
      times: (i, o) => `Check-in from ${i} · Check-out by ${o}`, allIn: "Prices include all taxes and fees.",
      contact: "Contact", stay: "Your stay", help: "Help", myBooking: "Find, change or cancel my booking",
      directions: "Directions", securePay: "Card payments are processed securely by Stripe — we never see your card number.",
      directBenefit: "Booking here, you book directly with the hotel.",
    },
    consent: {
      label: "Cookies on this page",
      body: (h, t) => `${h} would like to use ${t} to see how its booking page is used and to measure its ads. Nothing is loaded unless you accept, and you can change your mind any time in the footer.`,
      accept: "Accept", decline: "Decline", settings: "Cookie settings",
    },
    pay: {
      title: (h) => `Payment to ${h}`,
      lead: "The hotel has asked for this payment for your booking. You pay by card, securely, directly to the hotel.",
      amount: "Amount", forStay: "For your stay",
      pay: (a) => `Pay ${a}`, paying: "Paying…",
      paidTitle: "Thank you — it's paid", paidBody: (a) => `${a} has been paid to the hotel. Your bank statement will show the hotel's name.`,
      expiredTitle: "This payment link has expired", expiredBody: "Please contact the hotel — they can send you a new one.",
      cancelledTitle: "This payment is no longer needed", cancelledBody: "The hotel withdrew this request. If you think that's a mistake, please contact them.",
      notOpen: "This payment link is no longer valid.", notReady: "The hotel can't take card payments right now. Please contact them.",
      failed: "The payment did not go through. Nothing was charged — please try again.",
      secure: "Card payments are processed securely by Stripe — the hotel and we never see your card number.",
    },
    promo: {
      have: "Have a promo code?", label: "Promo code", apply: "Apply", remove: "Remove",
      badge: (c, p) => `${c} −${p}%`,
      applied: (c) => `Code ${c} applied — the discount is already in the prices below.`,
      code: (c) => `Promo code ${c}`,
      refusal: {
        unknown: (c) => `We don't recognise the code ${c}. Check it with the hotel.`,
        inactive: (c) => `The code ${c} is no longer active.`,
        dates: (c) => `The code ${c} isn't valid for these dates.`,
        nights: (c) => `The code ${c} needs a longer stay.`,
        used_up: (c) => `The code ${c} has been used up.`,
      },
    },
    ratings: { label: "Review scores", reviews: (n) => `${n.toLocaleString("en-GB")} reviews` },
    direct: {
      badge: (p) => `Direct −${p}%`,
      saving: (a) => `${a} less than on booking sites`,
      line: (p) => `Booking direct −${p}%`,
      struckTitle: "The same room and rate on booking sites",
      saved: "Booked direct",
    },
    group: {
      title: "Your rooms", change: "Change", chooseNow: "Choose a room below", next: "Next",
      summary: (n) => `${n} rooms`, roomsTotal: "Total for all rooms",
      othersTitle: "Booked together with", cancelled: "cancelled",
    },
    myBooking: {
      title: "My booking",
      body: "Enter your booking reference and the email you booked with. We will send you a private link to see, change or cancel your booking.",
      reference: "Booking reference", referenceHint: "In your confirmation email, e.g. RV-7Q2K9M", email: "Email you booked with",
      send: "Send me the link", sending: "Sending…",
      sent: "If the reference and email match a booking, the link is on its way. Check your inbox (and the spam folder).",
      limited: "Too many tries just now — please wait a few minutes.",
    },
    bar: {
      dates: "Dates", addDates: "Add dates", guests: "Guests", guestsCount: (n) => en1(n, "guest", "guests"),
      search: "Search", checkIn: "Check in", checkOut: "Check out", addDate: "Add date",
      ready: (n) => `${en1(n, "night", "nights")} · prices shown include every tax and fee`,
      empty: "Choose your dates to see live availability and the final price.",
      yourDates: "Your dates", close: "Close",
      guestsHint: "Everyone staying in the room",
      fewer: "One fewer guest", more: "One more guest",
      guestsNote: "We only show rooms that genuinely sleep this many — nothing you would have to argue about at the front desk.",
      adults: "Adults", adultsHint: "Ages 18 and over", children: "Children", childrenHint: "Ages 0–17",
      fewerChildren: "One child fewer", moreChildren: "One more child",
      childAge: (n) => `Age of child ${n}`, agePick: "Age", ageOption: (a) => (a === 0 ? "under 1" : `${a} ${a === 1 ? "year" : "years"}`),
      party: (a, c) => `${en1(a, "adult", "adults")}${c ? ` · ${en1(c, "child", "children")}` : ""}`,
      needAges: "Choose each child's age — the hotel prices and fits children by age.",
      rooms: "Rooms", roomsHint: "Each room with its own guests", fewerRooms: "One room fewer", moreRooms: "One more room",
      roomN: (n) => `Room ${n}`,
      roomsParty: (r, a, c) => `${en1(r, "room", "rooms")} · ${en1(a, "adult", "adults")}${c ? ` · ${en1(c, "child", "children")}` : ""}`,
      done: "Done",
    },
    calendar: {
      prev: "Previous month", next: "Next month",
      chooseCheckOut: "Now choose your check-out", chooseCheckIn: "Choose your check-in date",
      clear: "Clear", done: "Done",
      priceLegend: "Price per night from, taxes included", lowest: "lowest on screen",
      dayFrom: (p) => `from ${p} a night`, dayFull: "no rooms",
    },
    steps: { names: ["Dates", "Room", "Details", "Confirm"], progress: "Booking progress", back: "Back" },
    search: {
      summary: (n, g) => `${en1(n, "night", "nights")} · ${en1(g, "guest", "guests")} · every price includes taxes and fees`,
      chooseTitle: "Choose your dates",
      chooseBody: "Pick a check-in and a check-out above to see what's free and what it costs.",
      altTitle: "Those dates are full — but these are free",
      noneTitle: "No rooms free for those dates",
      altBody: (n) => `Same ${n === 1 ? "night" : `${n} nights`}, moved a little. We checked each one — these have rooms right now.`,
      noneBody: (n) => `We also checked the week either side and could not find ${en1(n, "night", "nights")} anywhere near these dates. The hotel may be full, or those nights may not be open for booking yet.`,
      available: (n) => `${en1(n, "room type", "room types")} available`,
      footnote: "Prices are for the whole stay and include all taxes and fees. Each rate shows what is paid now and what at the hotel.",
      footnoteRequest: "Prices are for the whole stay and include all taxes and fees. Nothing is charged online — you settle at the hotel.",
      total: "total",
      earlier: (d) => `${en1(d, "day", "days")} earlier`,
      later: (d) => `${en1(d, "day", "days")} later`,
      callHotel: (p) => `Call the hotel — ${p}`,
      checking: "Checking availability",
      rateLimited: "Too many searches just now. Please wait a moment and try again.",
    },
    room: {
      sleeps: (n) => `Sleeps ${n}`,
      lastRoom: "Last room",
      onlyLeft: (n) => `Only ${n} left`,
      otherRates: (n) => `${n} other ${n === 1 ? "rate" : "rates"} — breakfast, flexible cancellation`,
      bestPrice: "Best price",
      roomsFor: (n) => `Rooms, ${en1(n, "night", "nights")}`,
      totalPerNight: (p) => `total · ${p} a night`,
      select: "Select",
      photoAlt: (r) => `${r} at this hotel`,
      details: "Room details",
      detailsWithPhotos: (n) => `Room details & ${n} photos`,
      close: "Close",
      photoN: (r, n) => `${r} — photo ${n}`,
      photo: (n) => `Photo ${n}`,
      prevPhoto: "Previous photo", nextPhoto: "Next photo",
      empty: "The hotel hasn't added photos or a description for this room yet. Call them and they will tell you everything about it.",
      chooseRate: "Choose a rate for this room",
      ratesForDates: "Rates for your dates",
      totalFor: (n) => `total for ${n === 1 ? "1 night" : `${n} nights`}`,
      includes: (w) => `incl. ${w}`,
      seeRates: "See rates",
      from: (t) => `from ${t} total`,
      stickySelect: "Select",
      stickyTotal: "total",
    },
    book: {
      title: "Almost there",
      summary: (n, g) => `${en1(n, "night", "nights")} · ${en1(g, "guest", "guests")}`,
      sleepsUpTo: (n) => `Sleeps up to ${n}`,
      extras: "Extras", total: "Total",
      paidAtHotel: "Everything included. Paid at the hotel.",
      paidNow: "Everything included. Paid in full now.",
      splitHotel: (n, h) => `Everything included. ${n} now, ${h} at the hotel.`,
      splitLater: (n, l, d) => `Everything included. ${n} now, ${l} on ${d}.`,
      whoTitle: "Who's staying?",
      firstName: "First name", lastName: "Last name", email: "Email", phone: "Phone", optional: "optional",
      emailHint: "Your confirmation goes here.", phoneHint: "Only if the hotel needs to reach you.",
      note: "Anything we should know?", notePlaceholder: "Late arrival, a quiet room, celebrating something…",
      noteHint: "Requests aren’t guaranteed, but the hotel will see this before you arrive.",
      extrasTitle: "Anything else?",
      extrasLead: "Optional — added to the same bill, and settled at the hotel with everything else.",
      perNight: (p, n) => `${p} a night × ${en1(n, "night", "nights")}`,
      perStay: "once, for the whole stay",
      extrasNone: "Nothing selected — your total is unchanged.",
      holdingTitle: "Holding your room", nextTitle: "What happens next",
      guaranteeBold: "Nothing is charged now.",
      payNowBold: (a) => `${a} is charged now.`,
      payNowBody: "The payment goes straight to the hotel, under the terms below.",
      acceptPay: ", and that my card is charged under them",
      guaranteeBody: "Your card guarantees the room and you settle the whole amount at the hotel.",
      guaranteeStrong: "Your card details never reach us",
      guaranteeTail: "— they are held by our payment provider, and this booking page never sees a card number.",
      requestBold: "No card needed — the hotel confirms this one.",
      requestBody: "Your room is held while they check, and you’ll get an email as soon as it’s confirmed. Nothing is charged now, and nothing is charged online at all — you settle the whole amount at the hotel.",
      cancellation: "Cancellation:",
      terms: "Payment and cancellation",
      accept: "I accept the booking conditions and the cancellation policy above",
      acceptCard: ", and I understand my card is used as a guarantee",
      confirming: "Confirming…", sending: "Sending…", confirm: "Confirm booking", request: "Request this room",
      confirmHint: "You’ll get a confirmation by email straight away.",
      requestHint: "You’ll get an email the moment the hotel confirms.",
      holdExpired: "Your hold has expired. You can still try to confirm — the room may well be free.",
      holding: "We’re holding this room for you for",
    },
    errors: {
      unavailablePage: "This booking page isn't available.",
      name: "Please give your first and last name.",
      email: "That email address doesn't look right.",
      terms: "Please accept the booking conditions to continue.",
      holdGone: "Your room was only held for a short time and that window has passed. Please search again — it may still be free.",
      card: "We couldn't confirm your card. Nothing was charged — please try again, or call the hotel.",
      priceMoved: "The price changed while you were booking. Nothing was charged — please check the new total and try again.",
      guests: "Tell us how many guests are staying.",
      generic: "We couldn't complete that booking.",
      booking: {
        invalid_stay: "Those dates don't look right. Please search again.",
        too_long: "Stays longer than 30 nights can't be booked online — please call the hotel.",
        guest_details: "Please give your first name, last name and a valid email.",
        too_many_guests: "That room doesn't sleep that many guests. Please choose a larger one.",
        unavailable: "That room or rate can't be booked for these dates. Please search again.",
        sold_out: "Sorry — that room was booked moments ago. Nothing has been charged. Please search again.",
      },
      tooMany: "Too many requests. Please try again in a few minutes.",
      waitlistName: "Please give a name we can use in the email.",
      waitlist: {
        "invalid-dates": "Those dates don't look right.",
        "departure-before-arrival": "The departure date needs to be after the arrival date.",
        "in-the-past": "Those dates have already passed.",
        "no-guests": "Please say how many guests are coming.",
        "too-many-guests": "That's more guests than this hotel can take in one room.",
      },
      waitlistGeneric: "We couldn't add you to the list.",
    },
    done: {
      cancelledTitle: "This booking was cancelled", requestTitle: "Request sent", bookedTitle: "You're booked",
      cancelledBody: "Contact the hotel if this wasn’t what you intended.",
      requestLead: (h) => `${h} has your request and will confirm by email to`,
      requestTail: ". The room is held for you in the meantime — nothing has been charged.",
      bookedBody: "We’ve sent a confirmation to",
      reference: (r) => `Reference ${r}`,
      welcomeBack: (n) => `Welcome back — this is your ${enOrdinal(n)} stay with us. The front desk has your details already.`,
      checkIn: "Check in", checkOut: "Check out", length: "Length",
      from: (t) => `from ${t}`, by: (t) => `by ${t}`,
      totalAtHotel: "Total to pay at the hotel",
      total: "Total",
      paidOnline: (l) => (l ? `Paid now · card ending ${l}` : "Paid now"),
      chargedOn: (d) => `Charged automatically on ${d}`,
      atHotel: "To pay at the hotel",
      nothingCharged: "Nothing has been charged.",
      guaranteeOnly: (l) => `Nothing has been charged — your card ending ${l} is held as a guarantee only.`,
      nextTitle: "What happens now",
      requestNext: (h) => `${h} will confirm by email, usually within a few hours. Keep the reference — it’s all they need to find your request.`,
      requestHeld: "Your room is held until they answer, so nobody else can take it while you wait.",
      requestCall: "Changed your mind, or need it sooner? Call them directly",
      requestCallTail: " — you’re dealing with the hotel, not an agency.",
      bookedNext: "Your confirmation email has everything on this page. Keep the reference — it’s all the hotel needs to find you.",
      bookedArrive: (t) => `Arrive any time after ${t}. Nothing to print, nothing to pay in advance.`,
      bookedArrivePaid: (t) => `Arrive any time after ${t}. Nothing to print — what you paid is already with the hotel.`,
      bookedCall: "Need to change or cancel? Call the hotel directly",
      bookedCallOther: "Anything else — an early check-in, a cot, a special occasion? Call the hotel",
      bookedCallOtherTail: ".",
      cancelledTotal: "Nothing to pay — cancelled",
      addGoogle: "Add to Google Calendar", addIcs: "Add to Apple / Outlook", directions: "Directions",
    bookedCallTail: " — you’re booked with them, not through an agency, so they can just do it.",
      on: "on",
    },
    manage: {
      title: "Manage your booking",
      changeDates: "Change dates", changeDatesSub: "Same room and rate — see the new price before anything changes.",
      cancel: "Cancel booking", cancelSub: "See exactly what it costs before you confirm.",
      cancelConfirm: "Yes, cancel my booking", keep: "Keep my booking", cancelling: "Cancelling…",
      freeRefund: (a) => `Cancelling is free — ${a} goes back to your card.`,
      free: "Cancelling is free.",
      fee: (f) => `Cancelling now costs ${f}, under the terms you booked with.`,
      refundPart: (a) => `${a} goes back to your card.`,
      chargePart: (a) => `${a} will be charged to your card.`,
      noTerms: "Nothing has been charged online for this booking.",
      blockedPaid: (p) => `This stay was paid online, so the hotel changes its dates for you${p ? ` — call ${p}` : ""}.`,
      blockedRequested: "The hotel hasn’t confirmed this request yet. You can still cancel it.",
      inHouse: "You’ve already checked in — please speak to reception.",
      notAllowed: "This booking can no longer be changed online.",
      cancelledRefund: (a) => `${a} is on its way back to your card — banks usually show it within 5–10 days.`,
      cancelledFee: (a) => `A cancellation fee of ${a} was charged, as agreed when you booked.`,
      changedNotice: "Your dates are changed. We’ve emailed you the new confirmation.",
      askTitle: "Need to change or cancel?",
      askBody: "For your security we send a private link to the email you booked with.",
      askEmail: "Email you booked with", askSend: "Send me the link", askSending: "Sending…",
      askSent: "If that’s the email on this booking, the link is on its way. Check your inbox.",
      askLimited: "Too many tries just now — please wait a few minutes.",
      linkEmailSubject: (h) => `Manage your booking at ${h}`,
      linkEmailBody: "Here is your private link to change or cancel your booking. Anyone with it can manage the booking, so please don’t forward it.",
      linkEmailCta: "Manage my booking",
      changeTitle: "Change your dates",
      changeLead: (r) => `${r} — same room, same rate. Pick new dates and you’ll see the new price before anything changes.`,
      current: "Now", proposed: "New dates",
      pickDates: "Choose new dates on the calendar.", checking: "Checking availability…",
      newTotal: "New total", difference: (sign, a) => `${sign}${a} compared with now`, sameTotal: "Same price as now",
      confirmChange: "Change my dates", changing: "Changing…", back: "Back to my booking",
      refusal: {
        invalid: "Please choose dates from tomorrow on.",
        unavailable: "This room and rate can’t be booked for those dates. Try other dates.",
        sold_out: "The room is full on those dates. Try other dates.",
        too_long: "Stays longer than 30 nights can’t be booked online.",
        not_allowed: "This booking can no longer be changed online.",
        same_dates: "Those are the dates you already have.",
        needs_payment: "Those dates need a payment up front — please contact the hotel to move to them.",
        price_changed: "The price changed while you were deciding. Here is the new one.",
      },
    },
    waitlist: {
      joinedTitle: "You’re on the list",
      title: "We can tell you if something opens up",
      body: (n) => `For ${n === 1 ? "that night" : `those ${n} nights`}. One email, only if a room actually becomes free.`,
      name: "Your name", email: "Email address",
      adding: "Adding…", tellMe: "Tell me",
      joined: (m) => `If a room opens up we'll email you, and it's held for ${m >= 120 ? `${Math.round(m / 60)} hours` : `${m} minutes`} so you have time to book it.`,
      holdWindow: (h) => `${h} ${h === 1 ? "hour" : "hours"}`,
      expiredTitle: "This link has expired",
      expiredBody: "We could not find an open offer for this link. If a room opens up again we will email you — you are still on the list unless you asked us to take you off it.",
      usedTitle: "That offer has already been used",
      usedBody: "This room has either been booked or the offer was withdrawn. You are still on the list for these dates, and we will email you if something else opens up.",
      goneTitle: "That room has gone",
      goneBody: "The offer ran out before this link was opened, so the room went to the next guest waiting. You are still on the list — we will email you if another opens up.",
      takenTitle: "That room has just been taken",
      takenBody: "We are sorry — the room was released before you opened this link. You are still on the list and we will email you if another opens up.",
      unpricedBody: "We could not price this stay any more, which usually means the room went while this link was open. You are still on the list for these dates.",
      searchOther: (h) => `Search other dates at ${h}`,
    },
  },
  bg: {
    count: {
      nights: (n) => `${n} ${n === 1 ? "нощувка" : "нощувки"}`,
      guests: (n) => `${n} ${n === 1 ? "гост" : "гости"}`,
      days: (n) => `${n} ${n === 1 ? "ден" : "дни"}`,
      roomTypes: (n) => (n === 1 ? "1 вид стая" : `${n} вида стаи`),
      rates: (n) => `${n} ${n === 1 ? "вариант" : "варианта"}`,
      photos: (n) => `${n} ${n === 1 ? "снимка" : "снимки"}`,
    },
    meta: {
      title: (h) => `Резервирайте в ${h}`,
      description: (h) => `Резервирайте директно в ${h}. Най-добра цена, без такси за резервация.`,
      notFound: "Не е намерено",
    },
    page: {
      eyebrow: "Резервации",
      unavailableTitle: "Тази страница за резервации не е достъпна",
      unavailableBody: "Връзката може да е сгрешена или вече да не е активна. Ако хотел Ви е изпратил тук, проверете адреса директно с тях.",
      errorTitle: "Нещо се обърка от наша страна",
      errorBody: "Страницата не се зареди правилно. Ако вече сте потвърдили резервация, тя е наред — проверете имейла си за потвърждението, преди да опитате отново.",
      retry: "Опитайте отново",
      digest: "Ако се свържете с хотела за това, посочете номер",
    },
    hero: {
      headline: "Резервирайте директно. Платете по-малко.",
      subheadline: "Никаква комисиона не отива към сайт за пътувания, затова цената, която виждате, е тази, която хотелът наистина иска да Ви даде — с данъците и таксите вече включени.",
    },
    header: { official: "Официален сайт", call: (h) => `Обадете се на ${h}`, language: "Език", myBooking: "Моята резервация" },
    home: {
      eyebrow: (h) => `Официални резервации · ${h}`,
      goodToKnow: "Добре е да знаете",
      times: "Настаняване и напускане",
      timesValue: (i, o) => `Настаняване от ${i}, напускане до ${o}`,
      where: "Къде ще отседнете",
      talk: "Предпочитате да говорите с някого?",
    },
    trust: {
      feesTitle: "Без такси за резервация",
      feesBody: "Плащате на хотела, а не на посредник. Към цената не се добавя комисиона.",
      chargedTitle: "Плащате директно на хотела",
      chargedBody: "Всеки ценови план казва какво се плаща сега и какво в хотела. Данните на картата Ви не стигат до нас.",
      liveTitle: "Наличност в реално време",
      liveBody: "Стаите тук наистина са свободни в момента — не е стар списък.",
      times: (i, o) => `Настаняване от ${i}, напускане до ${o}.`,
    },
    footer: {
      times: (i, o) => `Настаняване от ${i} · Напускане до ${o}`, allIn: "Цените включват всички данъци и такси.",
      contact: "Контакти", stay: "Вашият престой", help: "Помощ", myBooking: "Намерете, променете или откажете резервация",
      directions: "Упътване", securePay: "Плащанията с карта се обработват сигурно от Stripe — ние не виждаме номера на картата Ви.",
      directBenefit: "Резервирайки тук, резервирате директно с хотела.",
    },
    consent: {
      label: "Бисквитки на тази страница",
      body: (h, t) => `${h} би искал да използва ${t}, за да вижда как се ползва страницата за резервации и да измерва рекламите си. Нищо не се зарежда, ако не приемете, а решението си можете да промените по всяко време от долната част на страницата.`,
      accept: "Приемам", decline: "Отказвам", settings: "Настройки за бисквитки",
    },
    pay: {
      title: (h) => `Плащане към ${h}`,
      lead: "Хотелът поиска това плащане за Вашата резервация. Плащате с карта, сигурно и директно на хотела.",
      amount: "Сума", forStay: "За Вашия престой",
      pay: (a) => `Платете ${a}`, paying: "Плащане…",
      paidTitle: "Благодарим — платено е", paidBody: (a) => `${a} са платени на хотела. В банковото Ви извлечение ще се вижда името на хотела.`,
      expiredTitle: "Тази връзка за плащане е изтекла", expiredBody: "Моля, свържете се с хотела — те могат да Ви изпратят нова.",
      cancelledTitle: "Това плащане вече не е нужно", cancelledBody: "Хотелът оттегли тази заявка. Ако смятате, че е грешка, свържете се с тях.",
      notOpen: "Тази връзка за плащане вече не е валидна.", notReady: "Хотелът не може да приема плащания с карта в момента. Моля, свържете се с тях.",
      failed: "Плащането не мина. Нищо не е удържано — опитайте отново.",
      secure: "Плащанията с карта се обработват сигурно от Stripe — нито хотелът, нито ние виждаме номера на картата Ви.",
    },
    promo: {
      have: "Имате промо код?", label: "Промо код", apply: "Приложи", remove: "Премахни",
      badge: (c, p) => `${c} −${p}%`,
      applied: (c) => `Кодът ${c} е приложен — отстъпката вече е в цените по-долу.`,
      code: (c) => `Промо код ${c}`,
      refusal: {
        unknown: (c) => `Не разпознаваме кода ${c}. Проверете го с хотела.`,
        inactive: (c) => `Кодът ${c} вече не е активен.`,
        dates: (c) => `Кодът ${c} не важи за тези дати.`,
        nights: (c) => `Кодът ${c} изисква по-дълъг престой.`,
        used_up: (c) => `Кодът ${c} е изчерпан.`,
      },
    },
    ratings: { label: "Оценки от отзиви", reviews: (n) => `${n.toLocaleString("bg-BG")} ${n === 1 ? "отзив" : "отзива"}` },
    direct: {
      badge: (p) => `Директно −${p}%`,
      saving: (a) => `С ${a} по-евтино от сайтовете за резервации`,
      line: (p) => `Директна резервация −${p}%`,
      struckTitle: "Същата стая и цена в сайтовете за резервации",
      saved: "Директна резервация",
    },
    group: {
      title: "Вашите стаи", change: "Промени", chooseNow: "Изберете стая по-долу", next: "Следва",
      summary: (n) => `${n} стаи`, roomsTotal: "Общо за всички стаи",
      othersTitle: "Резервирана заедно с", cancelled: "отказана",
    },
    myBooking: {
      title: "Моята резервация",
      body: "Въведете номера на резервацията и имейла, с който сте резервирали. Ще Ви изпратим лична връзка, за да видите, промените или откажете резервацията си.",
      reference: "Номер на резервацията", referenceHint: "От имейла за потвърждение, напр. RV-7Q2K9M", email: "Имейл, с който сте резервирали",
      send: "Изпратете ми връзката", sending: "Изпращаме…",
      sent: "Ако номерът и имейлът съвпадат с резервация, връзката вече пътува към Вас. Проверете пощата си (и папката за спам).",
      limited: "Твърде много опити — моля, изчакайте няколко минути.",
    },
    bar: {
      dates: "Дати", addDates: "Изберете дати", guests: "Гости", guestsCount: (n) => `${n} ${n === 1 ? "гост" : "гости"}`,
      search: "Търсене", checkIn: "Настаняване", checkOut: "Напускане", addDate: "Изберете дата",
      ready: (n) => `${n} ${n === 1 ? "нощувка" : "нощувки"} · цените включват всички данъци и такси`,
      empty: "Изберете дати, за да видите наличността и крайната цена.",
      yourDates: "Вашите дати", close: "Затвори",
      guestsHint: "Всички, които ще отседнат в стаята",
      fewer: "Един гост по-малко", more: "Един гост повече",
      guestsNote: "Показваме само стаи, в които наистина се побират толкова гости — без изненади на рецепцията.",
      adults: "Възрастни", adultsHint: "На 18 и повече години", children: "Деца", childrenHint: "От 0 до 17 години",
      fewerChildren: "Едно дете по-малко", moreChildren: "Още едно дете",
      childAge: (n) => `Възраст на дете ${n}`, agePick: "Възраст", ageOption: (a) => (a === 0 ? "под 1 г." : `${a} г.`),
      party: (a, c) => `${a} ${a === 1 ? "възрастен" : "възрастни"}${c ? ` · ${c} ${c === 1 ? "дете" : "деца"}` : ""}`,
      needAges: "Изберете възрастта на всяко дете — хотелът настанява и таксува децата според възрастта им.",
      rooms: "Стаи", roomsHint: "Всяка стая със своите гости", fewerRooms: "Една стая по-малко", moreRooms: "Още една стая",
      roomN: (n) => `Стая ${n}`,
      roomsParty: (r, a, c) => `${r} ${r === 1 ? "стая" : "стаи"} · ${a} ${a === 1 ? "възрастен" : "възрастни"}${c ? ` · ${c} ${c === 1 ? "дете" : "деца"}` : ""}`,
      done: "Готово",
    },
    calendar: {
      prev: "Предишен месец", next: "Следващ месец",
      chooseCheckOut: "Сега изберете дата на напускане", chooseCheckIn: "Изберете дата на настаняване",
      clear: "Изчисти", done: "Готово",
      priceLegend: "Цена за нощувка от, с включени такси", lowest: "най-ниска в показаното",
      dayFrom: (p) => `от ${p} на нощувка`, dayFull: "няма наличност",
    },
    steps: { names: ["Дати", "Стая", "Данни", "Потвърждение"], progress: "Стъпки на резервацията", back: "Назад" },
    search: {
      summary: (n, g) => `${n} ${n === 1 ? "нощувка" : "нощувки"} · ${g} ${g === 1 ? "гост" : "гости"} · всички цени включват данъците и таксите`,
      chooseTitle: "Изберете дати",
      chooseBody: "Изберете дата на настаняване и на напускане отгоре, за да видите какво има и колко струва.",
      altTitle: "Тези дати са заети — но тези са свободни",
      noneTitle: "Няма стаи за тези дати",
      altBody: (n) => `${n === 1 ? "Същата нощувка" : `Същите ${n} нощувки`}, малко преместени. Проверихме всяка — за тях има стаи в момента.`,
      noneBody: (n) => `Проверихме и седмицата преди и след, но не намерихме ${n} ${n === 1 ? "нощувка" : "нощувки"} близо до тези дати. Хотелът може да е пълен или тези нощувки още да не са отворени за резервации.`,
      available: (n) => (n === 1 ? "1 вид стая на разположение" : `${n} вида стаи на разположение`),
      footnote: "Цените са за целия престой и включват всички данъци и такси. Всеки ценови план показва какво се плаща сега и какво в хотела.",
      footnoteRequest: "Цените са за целия престой и включват всички данъци и такси. Нищо не се плаща онлайн — плащате в хотела.",
      total: "общо",
      earlier: (d) => `${d} ${d === 1 ? "ден" : "дни"} по-рано`,
      later: (d) => `${d} ${d === 1 ? "ден" : "дни"} по-късно`,
      callHotel: (p) => `Обадете се на хотела — ${p}`,
      checking: "Проверяваме наличността",
      rateLimited: "Твърде много търсения в момента. Моля, изчакайте малко и опитайте отново.",
    },
    room: {
      sleeps: (n) => `До ${n} ${n === 1 ? "гост" : "гости"}`,
      lastRoom: "Последна стая",
      onlyLeft: (n) => `Само ${n} останали`,
      otherRates: (n) => `Още ${n} ${n === 1 ? "вариант" : "варианта"} — със закуска, с гъвкаво анулиране`,
      bestPrice: "Най-добра цена",
      roomsFor: (n) => `Стая, ${n} ${n === 1 ? "нощувка" : "нощувки"}`,
      totalPerNight: (p) => `общо · ${p} на нощувка`,
      select: "Избери",
      photoAlt: (r) => `${r} в хотела`,
      details: "Подробности за стаята",
      detailsWithPhotos: (n) => `Подробности и ${n} ${n === 1 ? "снимка" : "снимки"}`,
      close: "Затвори",
      photoN: (r, n) => `${r} — снимка ${n}`,
      photo: (n) => `Снимка ${n}`,
      prevPhoto: "Предишна снимка", nextPhoto: "Следваща снимка",
      empty: "Хотелът още не е добавил снимки или описание на тази стая. Обадете се — ще Ви разкажат всичко за нея.",
      chooseRate: "Изберете цена за тази стая",
      ratesForDates: "Цени за Вашите дати",
      totalFor: (n) => `общо за ${n === 1 ? "1 нощувка" : `${n} нощувки`}`,
      includes: (w) => `вкл. ${w}`,
      seeRates: "Виж цените",
      from: (t) => `от ${t} общо`,
      stickySelect: "Избери",
      stickyTotal: "общо",
    },
    book: {
      title: "Почти готово",
      summary: (n, g) => `${n} ${n === 1 ? "нощувка" : "нощувки"} · ${g} ${g === 1 ? "гост" : "гости"}`,
      sleepsUpTo: (n) => `До ${n} ${n === 1 ? "гост" : "гости"}`,
      extras: "Допълнително", total: "Общо",
      paidAtHotel: "Всичко е включено. Плаща се в хотела.",
      paidNow: "Всичко е включено. Плаща се изцяло сега.",
      splitHotel: (n, h) => `Всичко е включено. ${n} сега, ${h} в хотела.`,
      splitLater: (n, l, d) => `Всичко е включено. ${n} сега, ${l} на ${d}.`,
      whoTitle: "Кой ще отседне?",
      firstName: "Име", lastName: "Фамилия", email: "Имейл", phone: "Телефон", optional: "по желание",
      emailHint: "Потвърждението ще дойде тук.", phoneHint: "Само ако хотелът трябва да се свърже с Вас.",
      note: "Нещо, което да знаем?", notePlaceholder: "Късно пристигане, тиха стая, празнувате нещо…",
      noteHint: "Желанията не са гарантирани, но хотелът ще ги види преди пристигането Ви.",
      extrasTitle: "Нещо допълнително?",
      extrasLead: "По желание — добавя се към същата сметка и се плаща в хотела заедно с всичко останало.",
      perNight: (p, n) => `${p} на нощувка × ${n} ${n === 1 ? "нощувка" : "нощувки"}`,
      perStay: "веднъж, за целия престой",
      extrasNone: "Нищо не е избрано — общата сума не се променя.",
      holdingTitle: "Задържаме стаята Ви", nextTitle: "Какво следва",
      guaranteeBold: "Сега нищо не се плаща.",
      payNowBold: (a) => `Сега се плащат ${a}.`,
      payNowBody: "Плащането отива директно към хотела, при условията по-долу.",
      acceptPay: " и картата ми да бъде таксувана според тях",
      guaranteeBody: "Картата Ви гарантира стаята, а цялата сума плащате в хотела.",
      guaranteeStrong: "Данните на картата Ви никога не стигат до нас",
      guaranteeTail: "— пазят се от доставчика на плащания, а тази страница никога не вижда номер на карта.",
      requestBold: "Не е нужна карта — хотелът потвърждава тази резервация.",
      requestBody: "Стаята Ви е задържана, докато хотелът провери, и ще получите имейл веднага щом бъде потвърдена. Сега нищо не се плаща, а онлайн изобщо не се плаща — цялата сума плащате в хотела.",
      cancellation: "Анулиране:",
      terms: "Плащане и анулиране",
      accept: "Приемам условията за резервация и правилата за анулиране по-горе",
      acceptCard: " и разбирам, че картата ми се използва като гаранция",
      confirming: "Потвърждаваме…", sending: "Изпращаме…", confirm: "Потвърди резервацията", request: "Изпрати заявка",
      confirmHint: "Веднага ще получите потвърждение по имейл.",
      requestHint: "Ще получите имейл веднага щом хотелът потвърди.",
      holdExpired: "Задържането изтече. Все пак можете да опитате да потвърдите — стаята може още да е свободна.",
      holding: "Задържаме тази стая за Вас още",
    },
    errors: {
      unavailablePage: "Тази страница за резервации не е достъпна.",
      name: "Моля, въведете име и фамилия.",
      email: "Този имейл адрес не изглежда правилен.",
      terms: "Моля, приемете условията за резервация, за да продължите.",
      holdGone: "Стаята беше задържана само за кратко и времето изтече. Моля, потърсете отново — може още да е свободна.",
      card: "Не успяхме да потвърдим картата Ви. Нищо не е таксувано — опитайте отново или се обадете на хотела.",
      priceMoved: "Цената се промени, докато резервирахте. Нищо не е таксувано — проверете новата сума и опитайте отново.",
      guests: "Моля, посочете колко гости ще отседнат.",
      generic: "Не успяхме да завършим тази резервация.",
      booking: {
        invalid_stay: "Тези дати не изглеждат правилни. Моля, потърсете отново.",
        too_long: "Престой над 30 нощувки не може да се резервира онлайн — моля, обадете се на хотела.",
        guest_details: "Моля, въведете име, фамилия и валиден имейл.",
        too_many_guests: "В тази стая не се побират толкова гости. Моля, изберете по-голяма.",
        unavailable: "Тази стая или цена не може да се резервира за тези дати. Моля, потърсете отново.",
        sold_out: "Съжаляваме — стаята беше резервирана преди миг. Нищо не е платено. Моля, потърсете отново.",
      },
      tooMany: "Твърде много заявки. Моля, опитайте отново след няколко минути.",
      waitlistName: "Моля, въведете име, с което да Ви пишем.",
      waitlist: {
        "invalid-dates": "Тези дати не изглеждат правилни.",
        "departure-before-arrival": "Датата на напускане трябва да е след датата на настаняване.",
        "in-the-past": "Тези дати вече са минали.",
        "no-guests": "Моля, посочете колко гости ще дойдат.",
        "too-many-guests": "Това са повече гости, отколкото хотелът може да настани в една стая.",
      },
      waitlistGeneric: "Не успяхме да Ви добавим в списъка.",
    },
    done: {
      cancelledTitle: "Тази резервация е анулирана", requestTitle: "Заявката е изпратена", bookedTitle: "Резервацията е потвърдена",
      cancelledBody: "Свържете се с хотела, ако не сте искали това.",
      requestLead: (h) => `${h} получи заявката Ви и ще я потвърди по имейл на`,
      requestTail: ". Дотогава стаята е задържана за Вас — нищо не е платено.",
      bookedBody: "Изпратихме потвърждение на",
      reference: (r) => `Номер ${r}`,
      welcomeBack: (n) => `Добре дошли отново — това е Вашият ${bgOrdinal(n)} престой при нас. Рецепцията вече има Вашите данни.`,
      checkIn: "Настаняване", checkOut: "Напускане", length: "Престой",
      from: (t) => `от ${t}`, by: (t) => `до ${t}`,
      totalAtHotel: "Общо за плащане в хотела",
      total: "Общо",
      paidOnline: (l) => (l ? `Платено сега · карта, завършваща на ${l}` : "Платено сега"),
      chargedOn: (d) => `Удържа се автоматично на ${d}`,
      atHotel: "За плащане в хотела",
      nothingCharged: "Нищо не е платено.",
      guaranteeOnly: (l) => `Нищо не е платено — картата Ви, завършваща на ${l}, служи само като гаранция.`,
      nextTitle: "Какво следва",
      requestNext: (h) => `${h} ще потвърди по имейл, обикновено до няколко часа. Запазете номера — само той им трябва, за да намерят заявката Ви.`,
      requestHeld: "Стаята е задържана, докато отговорят, така че никой друг не може да я вземе.",
      requestCall: "Размислихте или Ви трябва по-бързо? Обадете им се директно",
      requestCallTail: " — работите с хотела, а не с агенция.",
      bookedNext: "Имейлът с потвърждението съдържа всичко от тази страница. Запазете номера — само той трябва на хотела, за да Ви намери.",
      bookedArrive: (t) => `Пристигнете по всяко време след ${t}. Нищо за печатане, нищо за плащане предварително.`,
      bookedArrivePaid: (t) => `Пристигнете по всяко време след ${t}. Нищо за печатане — платеното вече е при хотела.`,
      bookedCall: "Трябва да промените или анулирате? Обадете се директно на хотела",
      bookedCallOther: "Нещо друго — ранно настаняване, детско легло, специален повод? Обадете се на хотела",
      bookedCallOtherTail: ".",
      cancelledTotal: "Нищо за плащане — отказана",
      addGoogle: "Добави в Google Календар", addIcs: "Добави в Apple / Outlook", directions: "Упътване",
      bookedCallTail: " — резервацията е при тях, а не чрез агенция, така че те могат просто да го направят.",
      on: "на",
    },
    manage: {
      title: "Управление на резервацията",
      changeDates: "Промяна на датите", changeDatesSub: "Същата стая и цена — виждате новата сума, преди да се промени нещо.",
      cancel: "Отказ от резервацията", cancelSub: "Виждате точно колко струва, преди да потвърдите.",
      cancelConfirm: "Да, откажи резервацията", keep: "Запази резервацията", cancelling: "Отказваме…",
      freeRefund: (a) => `Отказът е безплатен — ${a} се връщат по картата Ви.`,
      free: "Отказът е безплатен.",
      fee: (f) => `Отказ сега струва ${f} по условията, с които сте резервирали.`,
      refundPart: (a) => `${a} се връщат по картата Ви.`,
      chargePart: (a) => `${a} ще бъдат удържани от картата Ви.`,
      noTerms: "За тази резервация нищо не е платено онлайн.",
      blockedPaid: (p) => `Този престой е платен онлайн, затова хотелът ще промени датите вместо Вас${p ? ` — обадете се на ${p}` : ""}.`,
      blockedRequested: "Хотелът още не е потвърдил заявката. Можете да я откажете.",
      inHouse: "Вече сте настанени — моля, обърнете се към рецепцията.",
      notAllowed: "Тази резервация вече не може да се променя онлайн.",
      cancelledRefund: (a) => `${a} се връщат по картата Ви — банките обикновено ги показват до 5–10 дни.`,
      cancelledFee: (a) => `Удържана е такса за отказ ${a}, както е договорено при резервацията.`,
      changedNotice: "Датите са променени. Изпратихме Ви новото потвърждение по имейл.",
      askTitle: "Искате да промените или откажете?",
      askBody: "За Ваша сигурност изпращаме лична връзка на имейла, с който сте резервирали.",
      askEmail: "Имейл, с който сте резервирали", askSend: "Изпратете ми връзката", askSending: "Изпращаме…",
      askSent: "Ако това е имейлът на резервацията, връзката вече пътува към Вас. Проверете пощата си.",
      askLimited: "Твърде много опити — моля, изчакайте няколко минути.",
      linkEmailSubject: (h) => `Управление на резервацията Ви в ${h}`,
      linkEmailBody: "Ето Вашата лична връзка за промяна или отказ на резервацията. Всеки, който я има, може да управлява резервацията, затова не я препращайте.",
      linkEmailCta: "Управление на резервацията",
      changeTitle: "Промяна на датите",
      changeLead: (r) => `${r} — същата стая, същата цена. Изберете нови дати и ще видите новата сума, преди да се промени нещо.`,
      current: "Сега", proposed: "Нови дати",
      pickDates: "Изберете нови дати от календара.", checking: "Проверяваме наличността…",
      newTotal: "Нова обща сума", difference: (sign, a) => `${sign}${a} спрямо сега`, sameTotal: "Същата цена като сега",
      confirmChange: "Промени датите", changing: "Променяме…", back: "Обратно към резервацията",
      refusal: {
        invalid: "Моля, изберете дати от утре нататък.",
        unavailable: "Тази стая и цена не могат да се резервират за тези дати. Опитайте други.",
        sold_out: "Стаята е заета за тези дати. Опитайте други.",
        too_long: "Престой над 30 нощувки не може да се резервира онлайн.",
        not_allowed: "Тази резервация вече не може да се променя онлайн.",
        same_dates: "Това са датите, които вече имате.",
        needs_payment: "Тези дати изискват плащане предварително — моля, свържете се с хотела.",
        price_changed: "Цената се промени, докато решавахте. Ето новата.",
      },
    },
    waitlist: {
      joinedTitle: "В списъка сте",
      title: "Можем да Ви съобщим, ако се освободи стая",
      body: (n) => `За ${n === 1 ? "тази нощувка" : `тези ${n} нощувки`}. Един имейл, само ако наистина се освободи стая.`,
      name: "Вашето име", email: "Имейл адрес",
      adding: "Добавяме…", tellMe: "Съобщете ми",
      joined: (m) => `Ако се освободи стая, ще Ви пишем и ще я задържим ${m >= 120 ? `${Math.round(m / 60)} часа` : `${m} минути`}, за да имате време да я резервирате.`,
      holdWindow: (h) => `${h} ${h === 1 ? "час" : "часа"}`,
      expiredTitle: "Тази връзка е изтекла",
      expiredBody: "Не намерихме активна оферта за тази връзка. Ако пак се освободи стая, ще Ви пишем — оставате в списъка, освен ако не сте поискали да Ви премахнем.",
      usedTitle: "Тази оферта вече е използвана",
      usedBody: "Стаята или е резервирана, или офертата е оттеглена. Оставате в списъка за тези дати и ще Ви пишем, ако се освободи друга.",
      goneTitle: "Стаята вече я няма",
      goneBody: "Офертата изтече, преди връзката да бъде отворена, и стаята отиде при следващия чакащ гост. Оставате в списъка — ще Ви пишем, ако се освободи друга.",
      takenTitle: "Стаята току-що беше взета",
      takenBody: "Съжаляваме — стаята беше освободена, преди да отворите връзката. Оставате в списъка и ще Ви пишем, ако се освободи друга.",
      unpricedBody: "Вече не можем да изчислим цената на този престой, което обикновено значи, че стаята е взета, докато връзката е била отворена. Оставате в списъка за тези дати.",
      searchOther: (h) => `Потърсете други дати в ${h}`,
    },
  },
};
