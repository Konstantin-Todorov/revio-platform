import Link from "next/link";
import { StatusPage, statusPrimaryCls } from "@revio/ui/status-page";

/** In-shell 404 — a reservation, guest or room that no longer exists, or a mistyped URL. */
export default function ProtectedNotFound() {
  return (
    <StatusPage
      tone="notFound"
      title="We couldn’t find that"
      body="The page or record you’re looking for doesn’t exist, or it may have been removed. Check the link, or start again from the menu."
    >
      <Link href="/overview" className={statusPrimaryCls}>Back to Overview</Link>
    </StatusPage>
  );
}
