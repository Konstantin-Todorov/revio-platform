import Link from "next/link";
import { StatusPage, statusPrimaryCls } from "@revio/ui/status-page";
import { i18n } from "@/lib/i18n/server";
import { pages } from "@/lib/i18n/pages";

/** 404 for URLs outside the signed-in shell. */
export default async function NotFound() {
  const t = (await i18n()).t(pages).status;
  return (
    <main className="min-h-screen bg-surface-muted">
      <StatusPage
        tone="notFound"
        title={t.pageNotFound}
        body={t.pageNotFoundBody}
      >
        <Link href="/dashboard" className={statusPrimaryCls}>{t.goToPms}</Link>
      </StatusPage>
    </main>
  );
}
