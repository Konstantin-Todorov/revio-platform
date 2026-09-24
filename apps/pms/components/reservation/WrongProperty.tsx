import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { StatusPage, statusPrimaryCls, statusSecondaryCls } from "@revio/ui/status-page";
import { setActiveProperty } from "@/lib/actions-session";
import { i18n } from "@/lib/i18n/server";
import { pages } from "@/lib/i18n/pages";

/**
 * "This booking is at your other hotel."
 *
 * ⚠️ The screen that replaced a dead end. Search reaches every property the account holds, so it can
 * find a booking the current workspace cannot open — and the old answer was "We couldn't find that",
 * which is not merely unhelpful: it contradicts the search result the person just clicked. Two
 * screens disagreeing about whether a booking exists is the defect this project keeps finding, and
 * the founder found this one in production on 2026-09-14.
 *
 * So it names the hotel and offers the one action that helps. Switching is a form rather than a link
 * because it writes a cookie, and that is a POST — the same reason every other write here is one.
 */
export async function WrongProperty({
  reservationId, guestName, propertyId, propertyName,
}: {
  reservationId: string;
  guestName: string;
  propertyId: string;
  propertyName: string;
}) {
  async function switchAndOpen() {
    "use server";
    await setActiveProperty(propertyId);
    // Straight to the booking, not to a dashboard: they clicked a specific thing, and the switch is
    // the obstacle rather than the destination.
    redirect(`/reservation/${reservationId}`);
  }

  const t = (await i18n()).t(pages).wrongProperty;
  return (
    <StatusPage
      tone="notFound"
      title={t.title(guestName || t.thatBooking, propertyName)}
      body={t.body}
    >
      <form action={switchAndOpen}>
        <button type="submit" className={statusPrimaryCls}>
          <Building2 className="mr-1.5 inline h-4 w-4" />
          {t.switchTo(propertyName)}
        </button>
      </form>
      <Link href="/dashboard" className={statusSecondaryCls}>{t.stay}</Link>
    </StatusPage>
  );
}
