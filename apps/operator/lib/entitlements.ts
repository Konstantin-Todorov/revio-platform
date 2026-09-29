import "server-only";
import { forSystem, recordClientEvent } from "@revio/db";
import { renderSystemEmail, renderSystemEmailText, PRODUCT_BY_KEY } from "@revio/core";
import { sendEmail } from "@revio/email";
import { originFor } from "./product-origins";

const prisma = forSystem();

export type ProductField = "channelManager" | "reservation" | "pms";

/**
 * Grant or withdraw one product for a client.
 *
 * This is the most consequential switch in the console: it decides whether a hotel can open a
 * product at all. Until 2026-09-07 it was a bare boolean write with **no session check, no record
 * and no word to the customer** — and it had never been scanned by `authz-lint`, because that check
 * matched `actions-*.ts` and this file is `actions.ts`.
 *
 * The cost was not theoretical. Hotel Sofia Group lost RevioLink and RevioCRS during a founder's dry
 * run and nothing anywhere said who had done it, when, or why; the demo hotel simply stopped
 * opening, and it read as a connectivity fault.
 *
 * Four things now happen, and each exists because of a specific way this goes wrong:
 *
 *  1. **A session is required.** It is a POST endpoint like any other.
 *  2. **A no-op writes nothing.** Re-saving a form that changed nothing must not produce a record
 *     claiming access changed, or the audit trail becomes as untrustworthy as no audit trail.
 *  3. **The change is recorded in the HOTEL's own audit log**, not only ours. The person who has to
 *     answer "why did RevioCRS stop working this morning?" is at the hotel.
 *  4. **The hotel is told.** Access appearing or vanishing without a word is how a customer decides
 *     the software is unreliable. Granting says where to go; withdrawing says plainly that their
 *     data is untouched — which is true, because an entitlement is a licence and the data is shared.
 *
 * ⚠️ 2026-09-28: no longer a one-click toggle in a list row. That is how a real hotel lost all three
 * products in two seconds with no reason recorded. It is now reached only from the client's own
 * page, in a dialog that shows all three products together and asks why (`actions-lifecycle.ts`).
 */
export async function applyEntitlement(args: {
  tenantId: string;
  product: ProductField;
  enabled: boolean;
  reason?: string;
  session: { userId: string; name: string };
}): Promise<"changed" | "unchanged" | "gone"> {
  const { tenantId, product, enabled, session } = args;

  const field = product === "channelManager" ? "hasChannelManager" : product === "reservation" ? "hasReservation" : "hasPms";

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      properties: { orderBy: { name: "asc" }, take: 1, select: { id: true } },
      users: { where: { role: "owner", active: true }, take: 1, select: { email: true, name: true } },
    },
  });
  if (!tenant) return "gone";

  // Nothing to do — and nothing to record. See (2) above.
  if (tenant[field] === enabled) return "unchanged";

  await prisma.tenant.update({ where: { id: tenantId }, data: { [field]: enabled } });

  const info = PRODUCT_BY_KEY[product === "channelManager" ? "cm" : product === "reservation" ? "crs" : "pms"];

  const propertyId = tenant.properties[0]?.id;
  if (propertyId) {
    await prisma.auditEntry.create({
      data: {
        tenantId, propertyId,
        entity: "Product access", field: info.name,
        oldValue: enabled ? "no access" : "access",
        newValue: `${enabled ? "granted" : "withdrawn"} by ${session.name} (Revio)`,
        source: "manual",
      },
    });
  }

  const owner = tenant.users[0];
  if (owner?.email) {
    const mail = enabled
      ? {
          preview: `${info.name} is now available to your team.`,
          heading: `${info.name} is switched on`,
          product: info.name,
          blocks: [
            { p: `${info.name} is now available on your existing Revio login — ${info.tagline.toLowerCase()}.` },
            { p: "There is nothing to import and nothing to set up: your rooms, rates and guests are already there, because every Revio product shares one system." },
            { action: { label: `Open ${info.name}`, url: originFor(product === "channelManager" ? "cm" : product === "reservation" ? "crs" : "pms") } },
            { note: "Everyone on your team signs in with the account they already use." },
          ],
        }
      : {
          preview: `${info.name} has been switched off for your account.`,
          heading: `${info.name} has been switched off`,
          product: info.name,
          blocks: [
            { p: `${info.name} is no longer available on your Revio login.` },
            { p: "Your data has not been touched. Rooms, rates, reservations and guests are shared across every Revio product and stay exactly as they are — switching this back on restores access immediately, with nothing to re-import." },
            { note: "If this was not expected, reply to this email and we will put it back." },
          ],
        };

    // Never block the change on the mail provider: the access is already correct either way.
    try {
      await sendEmail({
        to: [owner.email],
        subject: enabled ? `${info.name} is switched on for ${tenant.name}` : `${info.name} has been switched off`,
        text: renderSystemEmailText(mail),
        html: renderSystemEmail(mail),
      });
    } catch { /* recorded above; the audit entry is the durable record */ }
  }

  // Ours too: who, when and why — the hotel's audit line above says what, this says why.
  await recordClientEvent({
    tenantId, kind: "product", fromValue: `${info.name} ${enabled ? "off" : "on"}`, toValue: `${info.name} ${enabled ? "on" : "off"}`,
    reason: args.reason || null, actor: { id: session.userId, name: session.name },
  });
  return "changed";
}

