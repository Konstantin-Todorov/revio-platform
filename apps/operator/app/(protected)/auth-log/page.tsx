import { listAuthEvents } from "@revio/db";
import { Card, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/**
 * Who signed in, who failed, and what happened to accounts (N5).
 *
 * The platform has logged what people did to a hotel's data for months; this is the other half, and
 * the one asked for after something goes wrong. It is deliberately a flat, recent-first list rather
 * than a dashboard: the question is "what happened around 3am on Tuesday", and a chart cannot answer
 * that.
 */

/** Grouped by what the row MEANS, not by severity — a failure is ordinary, a disable is not. */
const LABEL: Record<string, { text: string; tone: Tone }> = {
  sign_in: { text: "Signed in", tone: "success" },
  sign_out: { text: "Signed out", tone: "neutral" },
  sign_in_failed: { text: "Failed sign-in", tone: "warning" },
  sign_in_blocked: { text: "Blocked — rate limited", tone: "danger" },
  two_factor_passed: { text: "Second factor passed", tone: "success" },
  two_factor_failed: { text: "Second factor failed", tone: "warning" },
  recovery_code_used: { text: "Recovery code used", tone: "danger" },
  two_factor_enabled: { text: "Two-factor turned on", tone: "success" },
  two_factor_disabled: { text: "Two-factor turned OFF", tone: "danger" },
  password_changed: { text: "Password changed", tone: "info" },
  password_reset_requested: { text: "Password reset requested", tone: "info" },
  sessions_revoked: { text: "All sessions ended", tone: "info" },
  invite_sent: { text: "Invitation sent", tone: "neutral" },
};

const SCOPE_LABEL: Record<string, string> = {
  cm: "RevioLink", crs: "RevioCRS", pms: "RevioPMS", operator: "Operator", account: "Account",
};

export default async function AuthLogPage() {
  const events = await listAuthEvents(300);

  return (
    <div>
      <PageHeader
        title="Authentication log"
        subtitle="Sign-ins, failures and account changes across every product"
      />

      {events.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[14px] font-semibold text-ink-900">Nothing recorded yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
            Sign-ins and account changes appear here as they happen. Events are kept for a year and then removed.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-surface-border bg-surface-muted">
                <tr className="text-[11px] font-bold uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2">From</th>
                  <th className="px-4 py-2">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {events.map((e) => {
                  const label = LABEL[e.type] ?? { text: e.type, tone: "neutral" as Tone };
                  return (
                    <tr key={e.id} className="text-[12.5px]">
                      <td className="whitespace-nowrap px-4 py-2 tnum text-ink-500">
                        {e.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="px-4 py-2"><StatusPill tone={label.tone}>{label.text}</StatusPill></td>
                      <td className="px-4 py-2 text-ink-600">{SCOPE_LABEL[e.scope] ?? e.scope}</td>
                      {/* The address as TYPED, which for a failure may match no account at all —
                          that is the row worth reading, so it is shown rather than hidden. */}
                      <td className="px-4 py-2 text-ink-800">{e.email ?? <span className="text-ink-400">—</span>}</td>
                      <td className="px-4 py-2 tnum text-ink-500">{e.ip ?? "—"}</td>
                      <td className="px-4 py-2 text-ink-500">{e.detail ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-3 text-[11px] text-ink-400">
        IP addresses come from the request and can be forged — they are useful as a pattern, not as proof.
        Events older than a year are deleted automatically.
      </p>
    </div>
  );
}
