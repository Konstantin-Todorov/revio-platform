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
import { renderSystemEmail, renderSystemEmailText } from "./system-shell.js";
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
}: TrialOpenedArgs): AuthEmail {
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
