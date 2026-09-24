/**
 * The email a hotel gets the first time they actually open a product.
 *
 * ## Why this is not the signup email
 *
 * `signupEmail` is sent to an address we have never verified, and its whole job is one link. By the
 * time this one goes out the person has confirmed their address, chosen a password, been let through
 * the entitlement check and is looking at the product. That is a different moment and it deserves a
 * different message — and it is the only moment at which we can honestly state the end date, because
 * **the clock starts here, not at signup**.
 *
 * That change is the thing worth saying out loud. All three trials used to begin the day a hotel
 * signed up, so someone who spent a fortnight setting up the PMS met RevioLink with half its trial
 * already gone. `markProductOpened` moves the thirty days to the first open. A hotel has no way of
 * knowing that unless we tell them, and "your trial ends on the 16th" is the sentence that proves it.
 *
 * ## It is sent by the product, not by a job
 *
 * The reminder emails come from the operator's nightly sweep, because "seven days left" is something
 * only a clock knows. This one is caused by a person doing something, and `markProductOpened`
 * already returns `true` exactly once — on the open that started the trial. Sending from there means
 * the mail cannot disagree with the row that triggered it.
 *
 * ⚠️ Like the auth emails, this is **ours and not editable by the hotel**, for the same reason: it
 * states a date that has money attached to it.
 */

import { PRODUCT_BY_KEY, type ProductKey } from "../products/products.js";
import { TRIAL_DAYS } from "../trials/trials.js";
import { renderSystemEmail, renderSystemEmailText, type SystemEmailLocale } from "./system-shell.js";
import type { AuthEmail } from "./auth-emails.js";

export interface TrialOpenedArgs {
  /** The person's name if we know it — the mail still works if we do not. */
  name?: string;
  /** "Hotel Sofia". */
  hotelName: string;
  product: ProductKey;
  /** Derived by `trialEndFor` from the same open that triggered this. Never recomputed here. */
  endsAt: Date;
  /** Straight back into the product. Built by the caller, which is the only thing that knows its origin. */
  url: string;
  /**
   * The other products this hotel already had open before this one. Drives the one paragraph that
   * changes: a first product explains the trial, a second explains what it inherited.
   */
  alreadyOpen?: ProductKey[];
  /** The caller's date formatter — the property's locale, not the server's. */
  formatDate: (d: Date) => string;
  /** The owner's own language (`User.locale`). English otherwise. */
  locale?: SystemEmailLocale;
}

/**
 * ⚠️ Says what happens when the trial ends in the SAME terms as `trialBanner`: a conversation, not a
 * shutdown. A strip in the product and an email in the inbox that disagree about the consequence is
 * worse than either alone, and the one a hotel believes is whichever arrived last.
 */
export function trialOpenedEmail({
  name,
  hotelName,
  product,
  endsAt,
  url,
  alreadyOpen = [],
  formatDate,
  locale,
}: TrialOpenedArgs): AuthEmail {
  if (locale === "bg") return trialOpenedEmailBg({ ...(name ? { name } : {}), hotelName, product, endsAt, url, alreadyOpen, formatDate });
  const productName = PRODUCT_BY_KEY[product]?.name ?? product;
  const greeting = name ? `Hello ${name},` : "Hello,";
  const ends = formatDate(endsAt);

  const others = alreadyOpen
    .filter((p) => p !== product)
    .map((p) => PRODUCT_BY_KEY[p]?.name ?? p);

  /*
   * The second product is a different conversation from the first. A hotel opening RevioCRS after
   * RevioPMS does not need the pitch again — they need to know that their rooms, rates and staff
   * came with them, because the alternative they are bracing for is typing it all in twice.
   */
  const carried =
    others.length > 0
      ? {
          p:
            `Your property, room types and staff logins carried over from ` +
            `${others.length === 1 ? others[0] : `${others.slice(0, -1).join(", ")} and ${others.at(-1)}`}` +
            `. Nothing was copied — it is the same data, so there is nothing to keep in step and ` +
            `nothing to migrate if you keep both.`,
        }
      : {
          p:
            `Everything you set up here is shared with the other Revio products, so if you add one ` +
            `later your rooms, rates and staff are already in it.`,
        };

  const args = {
    preview: `Your ${TRIAL_DAYS} days start today and run until ${ends}.`,
    heading: `Your ${productName} trial starts today`,
    product: productName,
    blocks: [
      { p: greeting },
      {
        p:
          `${productName} is open for ${hotelName}. Your ${TRIAL_DAYS} days start today — not when ` +
          `you signed up — so the trial runs until ${ends}.`,
      },
      { action: { label: `Open ${productName}`, url } },
      carried,
      {
        // The same two facts the in-product strip leads with, in the same order: what happens if
        // they do nothing, and that nothing is lost.
        p:
          `We will remind you before it ends. Nothing is charged automatically and nothing is ` +
          `deleted when the trial is up — we will talk to you first, and your data stays exactly ` +
          `where it is either way.`,
      },
      { note: `Reply to this email if anything is in the way. It reaches a person.` },
    ],
  };

  return {
    subject: `${productName} is ready — your trial runs to ${ends}`,
    text: renderSystemEmailText(args),
    html: renderSystemEmail(args),
  };
}

/** The same email, the same blocks in the same order, in Bulgarian. */
function trialOpenedEmailBg({
  name, hotelName, product, endsAt, url, alreadyOpen = [], formatDate,
}: TrialOpenedArgs): AuthEmail {
  const productName = PRODUCT_BY_KEY[product]?.name ?? product;
  const ends = formatDate(endsAt);
  const others = alreadyOpen.filter((p) => p !== product).map((p) => PRODUCT_BY_KEY[p]?.name ?? p);
  const from = others.length === 1 ? others[0] : `${others.slice(0, -1).join(", ")} и ${others.at(-1)}`;

  const args = {
    locale: "bg" as const,
    preview: `Вашите ${TRIAL_DAYS} дни започват днес и продължават до ${ends}.`,
    heading: `Пробният Ви период на ${productName} започва днес`,
    product: productName,
    blocks: [
      { p: name ? `Здравейте, ${name},` : "Здравейте," },
      {
        p:
          `${productName} е отворен за ${hotelName}. Вашите ${TRIAL_DAYS} дни започват днес — не от ` +
          `регистрацията Ви — така че пробният период продължава до ${ends}.`,
      },
      { action: { label: `Отвори ${productName}`, url } },
      others.length > 0
        ? {
            p:
              `Обектът, типовете стаи и входовете на служителите Ви идват от ${from}. Нищо не е копирано — ` +
              `това са същите данни, така че няма какво да се синхронизира и какво да се прехвърля, ако запазите и двата.`,
          }
        : {
            p:
              `Всичко, което настроите тук, се споделя с другите продукти на Revio, така че ако добавите ` +
              `някой по-късно, стаите, цените и служителите Ви вече са в него.`,
          },
      {
        p:
          `Ще Ви напомним преди края. Нищо не се таксува автоматично и нищо не се изтрива, когато ` +
          `пробният период свърши — първо ще говорим с Вас, а данните Ви остават точно където са във всеки случай.`,
      },
      { note: `Отговорете на този имейл, ако нещо Ви пречи. Той стига до човек.` },
    ],
  };

  return {
    subject: `${productName} е готов — пробният Ви период е до ${ends}`,
    text: renderSystemEmailText(args),
    html: renderSystemEmail(args),
  };
}

/* ── The two the nightly sweep sends ─────────────────────────────────────────────────────────────
 *
 * Written here rather than in the operator app because the reader is the HOTEL, in the hotel's
 * language — the console that sends them is English, the owner who reads them may not be. One hotel,
 * one email per event: `products` is every product that event covers.
 */

function listIn(locale: SystemEmailLocale, names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ${locale === "bg" ? "и" : "and"} ${names[names.length - 1]}`;
}

/** "Your trial has finished" — access is already removed when this is written. */
export function trialFinishedEmail({ products, locale }: { products: readonly string[]; locale?: SystemEmailLocale }): AuthEmail {
  const names = listIn(locale ?? "en", products);
  const many = products.length > 1;
  const args =
    locale === "bg"
      ? {
          locale: "bg" as const,
          preview: "Пробният Ви период в Revio приключи.",
          heading: many ? "Пробният Ви период в Revio приключи" : `Пробният Ви период на ${names} приключи`,
          product: "Revio",
          blocks: [
            { p: `Пробният период приключи и ${names} ${many ? "вече не са" : "вече не е"} във Вашия вход в Revio.` },
            {
              p: "Нищо не е изтрито. Стаите, цените, резервациите и гостите Ви се споделят между продуктите, така че са точно там, където бяха — и ако решите да запазите някой от тях, включването му връща всичко веднага, без нищо за прехвърляне.",
            },
            {
              p: many
                ? "Не е нужно да ги вземате всичките. Отговорете ни кои от тях наистина сте ползвали и ще включим само тях."
                : "Ако Ви е бил полезен, отговорете на този имейл и ще го включим отново.",
            },
            {
              note: "Не сте таксувани за пробния период и нищо не започва само. Ако решите да го запазите, плащате от деня, в който решите — никога не таксуваме ден от пробния период.",
            },
          ],
        }
      : {
          preview: `Your Revio trial has finished.`,
          heading: many ? "Your Revio trial has finished" : `Your ${names} trial has finished`,
          product: "Revio",
          blocks: [
            { p: `The trial has ended and ${names} ${many ? "are" : "is"} no longer on your Revio login.` },
            {
              p: "Nothing has been deleted. Your rooms, rates, reservations and guests are shared across the products, so they are exactly where they were — and if you decide to keep any of them, switching it back on restores everything instantly, with nothing to import.",
            },
            {
              p: many
                ? "You do not have to take all of it back. Reply and tell us which of them you actually used, and we will switch on only those."
                : "If it was useful, reply to this email and we will put it back.",
            },
            {
              note: "You have not been charged for the trial, and nothing starts on its own. If you do decide to keep it, you pay from the day you decide — we never charge for a day of the trial.",
            },
          ],
        };
  return { subject: args.heading, text: renderSystemEmailText(args), html: renderSystemEmail(args) };
}

/** "N days left". `endsOn` is the day as the caller formats it; `url` opens the product. */
export function trialReminderEmail({
  products, left, endsOn, url, locale,
}: { products: readonly string[]; left: number; endsOn: string; url: string; locale?: SystemEmailLocale }): AuthEmail {
  const names = listIn(locale ?? "en", products);
  const many = products.length > 1;
  if (locale === "bg") {
    const day = left === 1 ? "Остава 1 ден" : `Остават ${left} дни`;
    const args = {
      locale: "bg" as const,
      preview: `${day} от пробния Ви период в Revio.`,
      heading: `${day} от пробния Ви период ${many ? "в Revio" : `на ${names}`}`,
      product: "Revio",
      blocks: [
        { p: `Пробният Ви период на ${names} приключва на ${endsOn}.` },
        {
          p: many
            ? "Ако искате да запазите някой от тях, отговорете ни кои — плащате само за това, което запазите, и не е нужно да вземате и трите. Нищо не става автоматично и няма да бъдете таксувани без Вашето съгласие."
            : "Ако искате да го запазите, отговорете на този имейл и ще го включим за постоянно. Нищо не става автоматично и няма да бъдете таксувани без Вашето съгласие.",
        },
        { action: { label: "Отвори Revio", url } },
        { note: "Ако го оставите да изтече, нищо не се изтрива — данните Ви се споделят между продуктите и остават точно каквито са." },
      ],
    };
    return { subject: `${day} от пробния Ви период в Revio`, text: renderSystemEmailText(args), html: renderSystemEmail(args) };
  }
  const day = `${left} day${left === 1 ? "" : "s"}`;
  const args = {
    preview: `${day} left on your Revio trial.`,
    heading: `${day} left on your ${many ? "Revio" : names} trial`,
    product: "Revio",
    blocks: [
      { p: `Your trial of ${names} ends on ${endsOn}.` },
      {
        p: many
          ? "If you would like to keep any of them, reply and tell us which — you only pay for what you keep, and there is no obligation to take all three. Nothing happens automatically and you will not be charged without agreeing to it."
          : "If you would like to keep it, reply to this email and we will switch it on properly. Nothing happens automatically and you will not be charged without agreeing to it.",
      },
      { action: { label: "Open Revio", url } },
      { note: "If you let it run out, nothing is deleted — your data is shared across the products and stays exactly as it is." },
    ],
  };
  return { subject: `${day} left on your Revio trial`, text: renderSystemEmailText(args), html: renderSystemEmail(args) };
}
