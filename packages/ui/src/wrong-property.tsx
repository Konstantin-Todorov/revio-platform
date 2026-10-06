import Link from "next/link";
import { Building2 } from "lucide-react";
import { StatusPage, statusPrimaryCls, statusSecondaryCls } from "./status-page";

/**
 * "This record is at your other hotel." — one screen for every product and every kind of record.
 *
 * ⚠️ The screen that replaces a dead end. Search reaches every property an account holds, so it can
 * find a booking, a guest or a room the current workspace cannot open — and the answer used to be
 * "We couldn't find that", which contradicts the result the person just clicked. RevioPMS fixed it
 * for bookings on 2026-09-14; guests, rooms and RevioCRS kept the dead end until 2026-10-06, which
 * is what a second copy of a fix does.
 *
 * It names the hotel and offers the one action that helps. The switch is a form because it writes a
 * cookie — each app passes its own server action, since the cookie and the destination are its own.
 */
export function WrongPropertyPage({
  title, body, switchLabel, stayLabel, stayHref, switchAction,
}: {
  title: string;
  body: string;
  switchLabel: string;
  stayLabel: string;
  stayHref: string;
  switchAction: () => Promise<void>;
}) {
  return (
    <StatusPage tone="notFound" title={title} body={body}>
      <form action={switchAction}>
        <button type="submit" className={statusPrimaryCls}>
          <Building2 aria-hidden className="mr-1.5 inline h-4 w-4" />
          {switchLabel}
        </button>
      </form>
      <Link href={stayHref} className={statusSecondaryCls}>{stayLabel}</Link>
    </StatusPage>
  );
}
