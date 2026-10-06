import { redirect } from "next/navigation";
import { WrongPropertyPage } from "@revio/ui/wrong-property";
import { setActiveProperty } from "@/lib/actions-session";
import { i18n } from "@/lib/i18n/server";
import { pages } from "@/lib/i18n/pages";

/**
 * "This booking / guest / room is at your other hotel." — RevioPMS's side of `WrongPropertyPage`.
 *
 * ⚠️ Search reaches every property the account holds, so it finds records the current workspace
 * cannot open. Bookings got this screen on 2026-09-14; guests and rooms still answered "We couldn't
 * find that" until 2026-10-06 — two screens disagreeing about whether a record exists.
 */
export async function WrongProperty({
  kind, href, name, propertyId, propertyName,
}: {
  kind: "booking" | "guest" | "room";
  /** Where the switch lands — the record itself, not a dashboard: they clicked a specific thing. */
  href: string;
  name: string;
  propertyId: string;
  propertyName: string;
}) {
  async function switchAndOpen() {
    "use server";
    await setActiveProperty(propertyId);
    redirect(href);
  }
  const t = (await i18n()).t(pages).wrongProperty;
  return (
    <WrongPropertyPage
      title={t.title(kind === "room" ? t.roomNamed(name) : name || t.thatBooking, propertyName)}
      body={t.body(t.things[kind])}
      switchLabel={t.switchTo(propertyName)}
      stayLabel={t.stay}
      stayHref="/dashboard"
      switchAction={switchAndOpen}
    />
  );
}
