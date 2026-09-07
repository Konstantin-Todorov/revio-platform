import type { ProductKey } from "../products/products.js";

/**
 * The help content — questions a hotel actually asks, with answers we can stand behind.
 *
 * ## Why this is code and not a database table
 *
 * These answers are **ours**, not the hotel's. They describe how the product behaves, so they should
 * be reviewed the way behaviour is reviewed: in a diff, by somebody who can check the answer is
 * still true. A wiki nobody reviews goes stale silently and then confidently misleads, which is
 * worse than no help at all — the same failure as the six stale documents found in September.
 *
 * It also makes them testable. A route named here that no product serves is a broken signpost, and
 * `help.test.ts` fails on it.
 *
 * ## Why `routes` matters more than `keywords`
 *
 * The most useful moment for help is not a search box — it is the screen somebody is already stuck
 * on. `routes` lets "Get help" offer the two or three answers that fit *where they are* before they
 * write anything, which is the difference between a support queue and a support avalanche.
 *
 * ⚠️ **This is also the assistant's source material.** An AI answering from nothing invents, and an
 * AI answering "contact support" is a worse search box. Anything it should be able to say belongs
 * here first.
 */

export type HelpCategory = "where" | "how" | "understand" | "trouble";

export const HELP_CATEGORIES: { key: HelpCategory; label: string; blurb: string }[] = [
  { key: "where", label: "Where do I find…", blurb: "Which screen holds which setting" },
  { key: "how", label: "How do I…", blurb: "Doing a thing, step by step" },
  { key: "understand", label: "What does this mean?", blurb: "Numbers, statuses and words we use" },
  { key: "trouble", label: "It is not working", blurb: "When something looks wrong" },
];

export interface HelpArticle {
  /** Stable slug — used in the URL and cited by the assistant. Never renamed; add a new one instead. */
  id: string;
  question: string;
  /** Plain paragraphs. Blank line between them; no markup to render or get wrong. */
  answer: string;
  category: HelpCategory;
  /** Which products this is true for. An answer wrong in one product must not appear in it. */
  products: ProductKey[];
  /** Screens this is about, as route prefixes. Powers the suggestions in "Get help". */
  routes?: string[];
  /** Words a person might use that the question does not contain. */
  keywords?: string[];
}

export const HELP_ARTICLES: readonly HelpArticle[] = [
  // ── where ───────────────────────────────────────────────────────────────────────────────────
  {
    id: "where-prices",
    question: "Where do I change my prices?",
    answer:
      "RevioCRS → Rooms & Rates sets the price for a room type on a rate plan. Rates & restrictions is where you change many days at once, and Bulk Rates & Availability is the fastest way to move a whole season.\n\nA price you set here is the price everywhere: the booking page, the channels and the reports all read the same figure. There is no separate 'channel price' to keep in step.",
    category: "where",
    products: ["crs", "cm"],
    routes: ["/rooms-rates", "/rates", "/bulk"],
    keywords: ["price", "rate", "cost", "how much", "change price"],
  },
  {
    id: "where-checkin-times",
    question: "Where do I set check-in and check-out times?",
    answer:
      "RevioCRS → Settings → Property shows them. The property profile itself — name, timezone, currency and those times — is edited in RevioLink → Settings, because it is one property shared by every product you use.",
    category: "where",
    products: ["crs", "cm", "pms"],
    routes: ["/settings"],
    keywords: ["check in time", "check out time", "arrival time", "property"],
  },
  {
    id: "where-staff",
    question: "Where do I add someone to my team?",
    answer:
      "Settings → Users & permissions. Add the person, choose their role, and they receive an invitation to set their own password.\n\nNobody at Revio ever knows or sets a password, and nobody shares one. The same login works in every Revio product your hotel uses, so a person you add here can open all of them.",
    category: "where",
    products: ["crs", "cm", "pms"],
    routes: ["/settings/users", "/settings"],
    keywords: ["staff", "user", "invite", "colleague", "password", "team"],
  },
  {
    id: "where-booking-page",
    question: "Where do I change how my booking page looks?",
    answer:
      "RevioCRS → Booking Engine. The colour, the logo and the photograph behind the headline are all set there, and you can switch the page on or off per property.\n\nWe measure the contrast of white text over your own photograph and will not let it drop below the readable floor — the screen shows you the number rather than silently overriding your choice.",
    category: "where",
    products: ["crs"],
    routes: ["/booking-engine"],
    keywords: ["booking engine", "direct", "website", "logo", "colour", "brand"],
  },
  {
    id: "where-taxes",
    question: "Where do I set taxes and city tax?",
    answer:
      "RevioCRS → Settings → Taxes & fees. What you add there is applied to a stay and shown to the guest, so the first number a guest sees on the booking page is the number they pay.",
    category: "where",
    products: ["crs"],
    routes: ["/settings/taxes", "/settings"],
    keywords: ["tax", "vat", "city tax", "tourist tax", "fee"],
  },

  // ── how ─────────────────────────────────────────────────────────────────────────────────────
  {
    id: "how-stop-selling",
    question: "How do I stop selling a room for certain dates?",
    answer:
      "Use Stop sell on the Inventory Calendar for those dates. It sends zero availability to every channel without changing how many rooms you actually have, so nothing is lost when you lift it again.\n\nUse it rather than setting the room count to zero: the count is what you own, and stop sell is a decision about selling. Keeping them separate is what lets you undo one without losing the other.",
    category: "how",
    products: ["crs", "cm"],
    routes: ["/inventory", "/bulk", "/rates"],
    keywords: ["stop sell", "close", "block", "not available", "sold out"],
  },
  {
    id: "how-cancel",
    question: "How do I cancel or change a booking?",
    answer:
      "Open the reservation in RevioCRS → Reservations and use Modify or Cancel. The rooms go back on sale immediately and the channels are updated for you — there is nothing to push by hand.\n\nIf somebody is already on the waitlist for those dates, the next sweep will offer the freed room to them automatically.",
    category: "how",
    products: ["crs"],
    routes: ["/reservations"],
    keywords: ["cancel", "modify", "change booking", "amend", "refund"],
  },
  {
    id: "how-switch-product",
    question: "How do I move between RevioLink, RevioCRS and RevioPMS?",
    answer:
      "Click your name in the top right. The menu lists every product your hotel has, and switching is one click — the same login works in all of them.\n\nIf a product is not listed, your hotel has not switched it on. The menu shows what it would do for you, and your Revio contact can enable it: your rooms, rates and guests are already there, so there is nothing to import.",
    category: "how",
    products: ["crs", "cm", "pms"],
    keywords: ["switch", "other product", "pms", "crs", "link", "move between"],
  },

  // ── understand ──────────────────────────────────────────────────────────────────────────────
  {
    id: "understand-adr-revpar",
    question: "What do occupancy, ADR and RevPAR mean here?",
    answer:
      "Occupancy is the share of your sellable room-nights that were sold. ADR is the average price of the room-nights you sold. RevPAR is revenue divided by every room-night you had, sold or not — so it falls when you sell fewer rooms and when you sell them cheaper.\n\nThe dashboard and the reports use exactly the same calculations, so the two screens cannot disagree with each other.",
    category: "understand",
    products: ["crs"],
    routes: ["/dashboard", "/reports", "/analytics"],
    keywords: ["adr", "revpar", "occupancy", "metric", "average rate"],
  },
  {
    id: "understand-hold",
    question: "What is a hold?",
    answer:
      "A short reservation of a room while somebody is deciding — a guest part-way through your booking page, or a room you are keeping during a phone call. It takes the room off sale so it cannot be sold twice.\n\nHolds expire on their own, and the room goes back on sale without anyone doing anything.",
    category: "understand",
    products: ["crs", "pms"],
    routes: ["/reservations", "/inventory"],
    keywords: ["hold", "reserved", "temporary", "expires"],
  },
  {
    id: "understand-departed",
    question: "Why does a departed guest still show as a sold room?",
    answer:
      "Because it was sold. A stay that has ended still counts towards the night's occupancy and revenue — the guest left, but the room was not available to anyone else that night.\n\nThe front desk shows them as departed. The commercial figures keep the sale, which is what makes last month's numbers stay correct.",
    category: "understand",
    products: ["pms", "crs"],
    routes: ["/front-desk", "/reservations"],
    keywords: ["departed", "checked out", "occupancy", "still showing"],
  },
  {
    id: "understand-commission-avoided",
    question: "What is 'commission avoided' on the cost of distribution screen?",
    answer:
      "Commission paid is a fact: each channel's own rate applied to the revenue it actually brought you.\n\nCommission avoided is a comparison — what those direct bookings would have cost had they come through an OTA instead. We only show it when we can work it out from your own channel rates, and leave it blank rather than guessing when we cannot.",
    category: "understand",
    products: ["crs"],
    routes: ["/distribution"],
    keywords: ["commission", "distribution", "cost", "ota", "saved"],
  },

  // ── trouble ─────────────────────────────────────────────────────────────────────────────────
  {
    id: "trouble-not-on-booking-com",
    question: "A room is not showing on Booking.com. What should I check?",
    answer:
      "Three things, in this order.\n\nFirst, is it stop-sold or fully booked for those dates? Check the Inventory Calendar.\n\nSecond, is the room mapped? RevioLink → Mapping must show the room type and its rate plans as complete. A room type added after the channel was first connected has to be mapped before anything about it is sent.\n\nThird, look at RevioLink → Sync Center for that channel. If it shows an error there, that is what to send us — the message tells us far more than 'it is not showing'.",
    category: "trouble",
    products: ["cm"],
    routes: ["/mapping", "/channels", "/sync"],
    keywords: ["booking.com", "not showing", "missing", "ota", "channel", "expedia"],
  },
  {
    id: "trouble-never-synced",
    question: "A channel says 'Never synced' or 'Not syncing'. What does that mean?",
    answer:
      "It means nothing has successfully reached that channel — not that nothing was attempted. We deliberately measure the last successful sync rather than the last attempt, because a channel that fails every few minutes has a very recent attempt and is completely broken.\n\nSo treat it as real. Open Sync Center for the channel, and send us what the error says.",
    category: "trouble",
    products: ["cm"],
    routes: ["/sync", "/channels", "/dashboard"],
    keywords: ["never synced", "not syncing", "stale", "channel down", "red"],
  },
  {
    id: "trouble-cannot-check-out",
    question: "Why can I not check a guest out?",
    answer:
      "There is usually money outstanding on the folio. Check-out is blocked while a balance is unsettled so a guest does not walk out on an open bill by accident.\n\nOpen the folio, settle or write off the balance with a reason, and check-out will proceed. If the charge is wrong, void it rather than deleting it, so the correction is on the record.",
    category: "trouble",
    products: ["pms"],
    routes: ["/front-desk", "/folios"],
    keywords: ["check out", "balance", "folio", "blocked", "cannot"],
  },
  {
    id: "trouble-page-updated",
    question: "I saw a message saying the page was just updated. Did I lose anything?",
    answer:
      "No. It means we released a new version while your tab was open, so that tab was running the older one. Reloading picks up the new version.\n\nNothing you had already saved is affected. If you were part-way through typing something that had not been saved, that is the only thing worth re-entering.",
    category: "trouble",
    products: ["crs", "cm", "pms"],
    keywords: ["updated", "reload", "error", "refresh", "session"],
  },
];

export const HELP_BY_ID: Record<string, HelpArticle> = Object.fromEntries(
  HELP_ARTICLES.map((a) => [a.id, a]),
);
