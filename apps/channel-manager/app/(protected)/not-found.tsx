import Link from "next/link";
import { StatusPage, statusPrimaryCls } from "@revio/ui/status-page";
import { i18n } from "@/lib/i18n/server";
import { pages } from "@/lib/i18n/pages";

/** In-shell 404 — a reservation, guest or room that no longer exists, or a mistyped URL. */
export default async function ProtectedNotFound() {
  const t = (await i18n()).t(pages).status;
  return (
    <StatusPage tone="notFound" title={t.recordNotFound} body={t.recordNotFoundBody}>
      <Link href="/dashboard" className={statusPrimaryCls}>{t.backToDashboard}</Link>
    </StatusPage>
  );
}
