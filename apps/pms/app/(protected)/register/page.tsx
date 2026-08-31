import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Download, FileSpreadsheet } from "lucide-react";
import { validateRegisterEntry, countryName, DOCUMENT_TYPE_BG } from "@revio/core";
import { roleHasCapability } from "@/lib/roles";
import { activeProperty } from "@/lib/data";
import { getRegisterEntries } from "@/lib/register";
import { todayInTz } from "@/lib/format";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** First and last day of the month a date falls in. */
function monthBounds(iso: string): { from: string; to: string } {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { from: `${iso.slice(0, 7)}-01`, to: `${iso.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { session, property } = await activeProperty();
  // Identity documents. Tighter than the nav guard, which only keeps the scoped roles out.
  if (!roleHasCapability(session.role, "frontDesk")) redirect("/dashboard?error=forbidden");
  const today = todayInTz(property.timezone);
  const { month } = await searchParams;
  const anchor = /^\d{4}-\d{2}$/.test(month ?? "") ? `${month}-01` : today;
  const { from, to } = monthBounds(anchor);

  const entries = await getRegisterEntries(property.id, property.timezone, from, to);
  const incomplete = entries.filter((e) => validateRegisterEntry(e).length > 0);
  const nights = entries.reduce((n, e) => n + (e.cancelled ? 0 : e.nights), 0);

  const ym = anchor.slice(0, 7);
  const shift = (delta: number) => {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${ym}-01T00:00:00Z`));

  return (
    <div>
      <PageHeader
        title="Guest register"
        subtitle="Регистър на настанените туристи · every guest who stayed the night, in the order they were registered"
        action={
          <a
            href={`/api/register/export?from=${from}&to=${to}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800"
          >
            <Download className="h-4 w-4" /> Export {label}
          </a>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/register?month=${shift(-1)}`} className="rounded-md border border-surface-border px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-600 hover:border-brand-600 hover:text-brand-700">←</Link>
        <span className="text-[13.5px] font-bold text-ink-900">{label}</span>
        <Link href={`/register?month=${shift(1)}`} className="rounded-md border border-surface-border px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-600 hover:border-brand-600 hover:text-brand-700">→</Link>
        <span className="ml-2 text-[12px] text-ink-400">
          {entries.length} registration{entries.length === 1 ? "" : "s"} · {nights} night{nights === 1 ? "" : "s"}
        </span>
      </div>

      {incomplete.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <div className="text-[13px] text-warning-700">
            <strong className="font-semibold">{incomplete.length} of these {entries.length} aren’t ready to file.</strong>{" "}
            Something the register has to contain is still missing — open the guest below and finish it. The
            export includes them as they are, so the gaps are visible rather than silent.
          </div>
        </div>
      )}

      <Card>
        <CardHeader
          title="Registrations"
          subtitle={`${from} → ${to} · ordered by пореден номер, the way the register is kept`}
        />
        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-400">
            Nobody was registered this month. Entries open automatically when a guest is checked in.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                  {["№", "Registered", "Guest", "Citizenship", "Document", "Room", "Arrived", "Departed", "Nights", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const problems = validateRegisterEntry(e);
                  const name = [e.firstName, e.middleName, e.lastName].filter((v) => v && v.trim()).join(" ");
                  return (
                    <tr key={e.id} className={`border-b border-surface-border/60 last:border-0 hover:bg-surface-muted ${e.cancelled ? "opacity-50" : ""}`}>
                      <td className="tnum whitespace-nowrap px-3 py-2 font-bold text-ink-400">{e.registerNo}</td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-ink-600">{e.registeredAt} {e.registeredAtTime}</td>
                      <td className={`px-3 py-2 font-semibold ${e.cancelled ? "text-ink-400 line-through" : name ? "text-ink-900" : "text-ink-400 italic"}`}>
                        {name || "not captured"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-600">{e.nationality ? countryName(e.nationality) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-600">
                        {e.documentType ? DOCUMENT_TYPE_BG[e.documentType] : "—"}
                        {e.documentNumber ? <span className="ml-1 text-ink-400">···{e.documentNumber.slice(-4)}</span> : ""}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-600">{e.unitLabel ?? "—"}</td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-ink-600">{e.arrivalDate || "—"}</td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-ink-600">{e.departureDate ?? "in house"}</td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-ink-600">{e.nights}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {e.cancelled
                          ? <StatusPill tone="neutral">cancelled</StatusPill>
                          : problems.length > 0
                            ? <StatusPill tone="warning">{problems.length} missing</StatusPill>
                            : <StatusPill tone="success">complete</StatusPill>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-start gap-2 border-t border-surface-border/60 px-4 py-3 text-[11.5px] text-ink-400">
          <FileSpreadsheet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            The export has the columns of the official образец, in its order, so it can be checked against the
            template line by line. Open it in Excel and upload it to ЕСТИ. Documents are shown here by their last
            four characters only — the full number is in the export and on the guest’s own entry.
          </p>
        </div>
      </Card>
    </div>
  );
}
