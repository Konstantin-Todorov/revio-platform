"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { forSystem, forTenant } from "@revio/db";
import {
  bookingReference, checkCalendar, checkManageLink, clientIp, guestCancelReservation, guestChangeDates, guestPreviewChange,
  mintManageToken, type ChangePreview, type ChangeRefusal,
} from "@revio/booking";
import { brandOf, sendEmail } from "@revio/email";
import { renderEmail, todayInTimeZone } from "@revio/core";
import { getPublicProperty } from "./property";
import { serverKit } from "./i18n/server";
import { alertHotel, findByReference, formatMoney, mailGuest, manageUrl, mayManage } from "./manage";

/**
 * The guest managing their own booking. Every action re-finds the booking by reference, re-checks
 * the key from the link, and hands the decision to `@revio/booking` — the page's buttons are a
 * convenience, never the authority.
 */

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "").trim();

async function load(slug: string, reference: string, key: string) {
  const property = await getPublicProperty(slug);
  if (!property) return null;
  const r = await findByReference(property, reference);
  if (!r || !mayManage(r, key)) return null;
  return { property, r };
}

/** Cancel. Redirects back to the booking, which then shows the cancelled state and the money. */
export async function cancelMyBooking(fd: FormData): Promise<void> {
  const slug = str(fd, "slug");
  const reference = str(fd, "reference");
  const key = str(fd, "k");
  const found = await load(slug, reference, key);
  if (!found) redirect(`/${slug}/booking/${reference}`);
  const { property, r } = found!;
  const back = `/${property.slug}/booking/${bookingReference(r.id)}?k=${encodeURIComponent(key)}`;

  const today = todayInTimeZone(property.timezone);
  const res = await guestCancelReservation(forTenant(property.tenantId), { ...property, id: property.id }, r.id, today);
  if (!res.ok) redirect(`${back}&error=${res.code}`);

  const fresh = await findByReference(property, reference);
  if (fresh) {
    await mailGuest(property, fresh, "booking_cancelled", null);
    const s = res.ok ? res.settled : null;
    const money = (m: number) => formatMoney(m, r.currency, "en");
    await alertHotel(property, "cancelled", fresh, [
      s && s.feeMinor > 0 ? `Cancellation fee: ${money(s.feeMinor)}` : "No cancellation fee.",
      s && s.refundMinor > 0 ? `Refunded to the guest's card: ${money(s.refundMinor)}${s.refunded ? "" : " — REFUND FAILED, please check Stripe"}` : null,
      s && s.chargeMinor > 0 ? `Charged to the guest's card: ${money(s.chargeMinor)}${s.charged ? "" : " — CHARGE FAILED, please check Stripe"}` : null,
    ].filter(Boolean).join("\n"));
  }
  redirect(back);
}

export type PreviewResult =
  | { ok: true; preview: ChangePreview }
  | { ok: false; code: ChangeRefusal | "price_changed" };

/** Price the new dates — nothing is written. Called from the change page as the guest picks. */
export async function previewMyChange(
  slug: string, reference: string, key: string, checkIn: string, checkOut: string,
): Promise<PreviewResult> {
  const found = await load(slug, reference, key);
  if (!found) return { ok: false, code: "not_allowed" };
  const { property, r } = found;
  const ip = clientIp(await headers());
  // The same budget as the calendar: a preview is a search, and this page is still anonymous.
  if (!checkCalendar(ip, property.slug).ok) return { ok: false, code: "unavailable" };
  return guestPreviewChange(
    forTenant(property.tenantId), { ...property, id: property.id }, r.id, checkIn, checkOut, todayInTimeZone(property.timezone),
  );
}

/** Move the stay. The page posts the total it showed; a different one now is refused, not booked. */
export async function changeMyBooking(fd: FormData): Promise<PreviewResult> {
  const found = await load(str(fd, "slug"), str(fd, "reference"), str(fd, "k"));
  if (!found) return { ok: false, code: "not_allowed" };
  const { property, r } = found;
  // The total the page showed. Unreadable = nothing agreed, so nothing moves.
  const expectedTotalMinor = Number(str(fd, "expectedTotalMinor"));
  if (!Number.isFinite(expectedTotalMinor)) return { ok: false, code: "price_changed" };
  const was = `${r.lines[0]?.checkIn.toISOString().slice(0, 10)} → ${r.lines[0]?.checkOut.toISOString().slice(0, 10)}`;
  const res = await guestChangeDates(forTenant(property.tenantId), { ...property, id: property.id }, r.id, {
    checkIn: str(fd, "checkIn"),
    checkOut: str(fd, "checkOut"),
    expectedTotalMinor,
    today: todayInTimeZone(property.timezone),
  });
  // A moved price comes back as `price_changed`; the page re-prices and shows the new number.
  if (!res.ok) return res;
  const fresh = await findByReference(property, str(fd, "reference"));
  if (fresh && fresh.guestManageToken) {
    const kit = await serverKit(property);
    await mailGuest(property, fresh, "booking_modified", {
      label: kit.s.manage.linkEmailCta,
      url: await manageUrl(property, fresh.id, fresh.guestManageToken),
    });
    await alertHotel(property, "changed", fresh, `Was: ${was}\nNow: ${res.preview.checkIn} → ${res.preview.checkOut}\nNew total: ${formatMoney(res.preview.totalMinor, res.preview.currency, "en")}`);
  }
  redirect(`/${property.slug}/booking/${bookingReference(r.id)}?k=${encodeURIComponent(str(fd, "k"))}&changed=1`);
}

export type LinkRequestResult = { ok: true } | { ok: false; limited: true };

/**
 * "Send me the link." The answer is the same whether the email matched or not — anything else turns
 * this form into a way to learn who has booked the hotel. A booking made before keys existed gets
 * one minted here, so every guest can reach the manage page.
 */
export async function requestManageLink(fd: FormData): Promise<LinkRequestResult> {
  const property = await getPublicProperty(str(fd, "slug"));
  if (!property) return { ok: true };
  if (!checkManageLink(clientIp(await headers()), property.slug).ok) return { ok: false, limited: true };
  const r = await findByReference(property, str(fd, "reference"));
  const typed = str(fd, "email").toLowerCase();
  const onFile = r?.guest?.email?.trim().toLowerCase();
  if (!r || !onFile || typed !== onFile || r.status === "cancelled") return { ok: true };

  let token = r.guestManageToken;
  if (!token) {
    token = mintManageToken();
    await forTenant(property.tenantId).reservation.update({ where: { id: r.id }, data: { guestManageToken: token } });
  }
  const kit = await serverKit(property);
  const m = kit.s.manage;
  try {
    const row = await forSystem().property.findUnique({ where: { id: property.id } });
    if (row) {
      const mail = renderEmail({
        subject: m.linkEmailSubject(property.name),
        body: `${m.linkEmailBody}\n\n${bookingReference(r.id)}`,
        brand: brandOf(row),
        vars: {},
        cta: { label: m.linkEmailCta, url: await manageUrl(property, r.id, token) },
      });
      await sendEmail({ to: [onFile], subject: mail.subject, text: mail.text, html: mail.html, fromName: mail.fromName });
    }
  } catch {
    /* the answer is the same either way */
  }
  return { ok: true };
}
