import { listAppErrors } from "@revio/db";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { AppErrorList } from "@/components/health/AppErrorList";

export const dynamic = "force-dynamic";

/**
 * The error log, as a place you go rather than a card you scroll past.
 *
 * It existed inside Platform Health, below sync figures, which is the wrong shape for how it is
 * actually used: nobody browses it. Somebody says "the screen went white" and you want the log, now,
 * by name. So it has a name and a nav entry.
 *
 * ## Why this cannot flood
 *
 * One row per distinct fault, identified by message plus the first stack frame, with a count. Ten
 * thousand occurrences of one bug is one row reading 10,000 — not ten thousand rows burying the next
 * bug. That is also why it is safe to accept reports from browsers: a flood costs a counter, not a
 * table.
 */
export default async function ErrorsPage() {
  const errors = await listAppErrors(100);
  const open = errors.filter((e) => !e.resolvedAt).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Error log"
        subtitle={
          open === 0
            ? "Nothing unresolved"
            : `${open} unresolved · one row per distinct fault, not per occurrence`
        }
      />

      <Card>
        <CardHeader
          title={`Unhandled errors${errors.length ? ` · ${errors.length}` : ""}`}
          subtitle="Server and browser. Newest first; resolving one hides it until it happens again."
        />
        {errors.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-ink-500">
            Nothing has thrown. Faults are recorded automatically from every product — a crash on the
            server through Next&rsquo;s error hook, and a crash in somebody&rsquo;s browser through the
            error boundary. Neither needs anyone to report it.
          </p>
        ) : (
          <AppErrorList
            errors={errors.map((e) => ({
              id: e.id, service: e.service, message: e.message, route: e.route, stack: e.stack,
              count: e.count, firstSeen: e.firstSeenAt.toISOString(), lastSeen: e.lastSeenAt.toISOString(),
            }))}
          />
        )}
      </Card>

      <p className="text-[11.5px] leading-relaxed text-ink-400">
        A page reloading itself after a release is not recorded here. That is the product working —
        the tab was running an older build — and filing it would make every deploy look like an
        incident.
      </p>
    </div>
  );
}
