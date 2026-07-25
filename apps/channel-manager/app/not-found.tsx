import Link from "next/link";
import { StatusPage, statusPrimaryCls } from "@revio/ui/status-page";

/** 404 for URLs outside the signed-in shell. */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-surface-muted">
      <StatusPage
        tone="notFound"
        title="Page not found"
        body="That address doesn’t exist in RevioLink. If you followed a link from us, let us know."
      >
        <Link href="/dashboard" className={statusPrimaryCls}>Go to RevioLink</Link>
      </StatusPage>
    </main>
  );
}
