import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Clock, Search } from "lucide-react";
import {
  searchAvailability, getCreateFormData, stayQuote, addDays, ymd, todayInTz,
  PAYMENT_GUARANTEES, getProperty,
} from "@/lib/data";
import { prisma } from "@/lib/db";
import { releaseExpiredHolds } from "@/lib/holds";
import { placeHold, releaseHold, confirmReservation } from "@/lib/actions-reservations";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; guests?: string; qty?: string; rt?: string; hold?: string; error?: string }>;
}) {
  const sp = await searchParams;
  await releaseExpiredHolds();

  if (sp.hold) return <HoldForm holdId={sp.hold} guests={Number(sp.guests) || 1} error={sp.error} />;
  return <SearchStep sp={sp} />;
}

/* --- Step 1: Availability Search (the call-center entry point) --------------- */

async function SearchStep({ sp }: { sp: { from?: string; to?: string; guests?: string; qty?: string; rt?: string; error?: string } }) {
  const property = await getProperty();
  const todayIso = todayInTz(property.timezone);
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : todayIso;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) && sp.to > from ? sp.to : ymd(addDays(new Date(`${from}T00:00:00Z`), 1));
  const guests = Math.max(1, Number(sp.guests) || 2);
  const qty = Math.max(1, Number(sp.qty) || 1);
  const hasQuery = Boolean(sp.from && sp.to);

  const search = hasQuery ? await searchAvailability({ checkIn: from, checkOut: to, guests, quantity: qty, roomTypeId: sp.rt }) : null;
  const requested = search?.results.find((r) => sp.rt && r.roomType.id === sp.rt);
  const requestedFull = requested ? !requested.available : false;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Availability Search"
        subtitle={`${property.name} · a guest-stay-shaped question: when, how many, which room`}
        action={<Link href="/reservations" className="text-[12.5px] font-semibold text-brand-700 hover:underline">← Reservations</Link>}
      />

      {sp.error && (
        <div className="flex items-center gap-2 rounded-md border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13px] font-medium text-danger-600">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {sp.error}
        </div>
      )}

      <Card className="p-4">
        <form method="GET" className="grid grid-cols-2 items-end gap-3 lg:grid-cols-5">
          <div>
            <label className={labelCls}>Arrival</label>
            <input type="date" name="from" defaultValue={from} min={todayIso} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Departure</label>
            <input type="date" name="to" defaultValue={to} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Guests</label>
            <input type="number" name="guests" defaultValue={guests} min={1} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Rooms</label>
            <input type="number" name="qty" defaultValue={qty} min={1} className={inputCls} />
          </div>
          <button className="flex h-[38px] items-center justify-center gap-1.5 rounded-md bg-brand-800 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">
            <Search className="h-4 w-4" /> Search
          </button>
        </form>
      </Card>

      {search && (
        <Card>
          <CardHeader title={`${search.nights} night${search.nights === 1 ? "" : "s"} · ${from} → ${to} · ${guests} guest${guests === 1 ? "" : "s"} · ${qty} room${qty === 1 ? "" : "s"}`} />
          {requestedFull && (
            <div className="border-b border-surface-border/60 bg-warning-50/60 px-4 py-2 text-[12.5px] font-medium text-warning-600">
              The requested room type is sold out for these dates — alternatives below are available.
            </div>
          )}
          <ul className="divide-y divide-surface-border/60">
            {search.results.map((r) => {
              const isUpgrade =
                requested && r.available && r.roomType.id !== requested.roomType.id &&
                (r.totalMinor ?? 0) >= (requested.totalMinor ?? 0);
              return (
                <li key={r.roomType.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-bold text-ink-900">{r.roomType.name}</span>
                      <span className="text-[11px] font-medium text-ink-400">{r.roomType.code} · sleeps {r.roomType.maxGuests}</span>
                      {sp.rt === r.roomType.id && <StatusPill tone="info">requested</StatusPill>}
                      {requestedFull && r.available && !isUpgrade && <StatusPill tone="success">alternative</StatusPill>}
                      {isUpgrade && requestedFull && (
                        <span className="flex items-center gap-0.5 rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-bold text-brand-700">
                          <ArrowUpRight className="h-3 w-3" /> upgrade
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[12px] text-ink-500">
                      {r.available ? `${r.remainingMin} left across every night` : "Sold out on at least one night"}
                      {!r.fitsGuests && " · too small for this party"}
                      {r.totalMinor != null && search.standardPlanName && (
                        <> · from <span className="tnum font-semibold text-ink-900">{money(r.totalMinor)}</span> ({search.standardPlanName})</>
                      )}
                    </div>
                  </div>
                  {r.available && r.fitsGuests ? (
                    <form action={placeHold}>
                      <input type="hidden" name="roomTypeId" value={r.roomType.id} />
                      <input type="hidden" name="checkIn" value={from} />
                      <input type="hidden" name="checkOut" value={to} />
                      <input type="hidden" name="quantity" value={qty} />
                      <input type="hidden" name="guests" value={guests} />
                      <button className="rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
                        Hold &amp; continue
                      </button>
                    </form>
                  ) : (
                    <StatusPill tone={r.available ? "warning" : "danger"}>{r.available ? "doesn't fit" : "sold out"}</StatusPill>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="border-t border-surface-border/60 px-4 py-2.5 text-[11.5px] text-ink-400">
            “Hold &amp; continue” locks the rooms instantly — they’re off sale everywhere (including channels) while you
            take the guest’s details. Abandoned holds release automatically.
          </p>
        </Card>
      )}
    </div>
  );
}

/* --- Step 2: guest details against a live hold ------------------------------- */

async function HoldForm({ holdId, guests, error }: { holdId: string; guests: number; error?: string }) {
  const { property, ratePlans, sources } = await getCreateFormData();
  const hold = await prisma.hold.findFirst({
    where: { id: holdId, propertyId: property.id, status: "active", expiresAt: { gt: new Date() } },
    include: { roomType: true },
  });

  if (!hold) {
    return (
      <div className="space-y-4">
        <PageHeader title="Create Reservation" subtitle={property.name} />
        <div className="flex items-center gap-2 rounded-md border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13px] font-medium text-danger-600">
          <AlertTriangle className="h-4 w-4" /> This hold has expired — its rooms went back on sale.{" "}
          <Link href="/reservations/new" className="font-semibold underline">Search again</Link>
        </div>
      </div>
    );
  }

  const checkIn = hold.checkIn.toISOString().slice(0, 10);
  const checkOut = hold.checkOut.toISOString().slice(0, 10);
  const minsLeft = Math.max(1, Math.round((hold.expiresAt.getTime() - Date.now()) / 60_000));

  const quotes = new Map<string, number | null>();
  for (const rp of ratePlans) quotes.set(rp.id, await stayQuote(hold.roomTypeId, rp.id, checkIn, checkOut, hold.quantity));
  const defaultPlan = ratePlans.find((rp) => quotes.get(rp.id) != null) ?? ratePlans[0];
  const defaultQuote = defaultPlan ? quotes.get(defaultPlan.id) : null;

  return (
    <div className="space-y-5">
      <PageHeader title="Create Reservation" subtitle={`${property.name} · step 2 of 2 — the rooms are already locked`} />

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-brand-600/25 bg-brand-50/70 px-4 py-3 text-[13px]">
        <Clock className="h-4 w-4 text-brand-700" />
        <span className="font-bold text-ink-900">{hold.roomType.name}</span>
        <span className="tnum text-ink-600">{checkIn} → {checkOut}</span>
        <span className="text-ink-600">{hold.quantity} room{hold.quantity === 1 ? "" : "s"} · {guests} guest{guests === 1 ? "" : "s"}</span>
        <StatusPill tone="warning">hold expires in ~{minsLeft} min</StatusPill>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13px] font-medium text-danger-600">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <Card className="p-5">
        <form action={confirmReservation} className="space-y-5">
          <input type="hidden" name="holdId" value={hold.id} />
          <input type="hidden" name="guests" value={guests} />

          <div>
            <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-400">Guest</div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div><label className={labelCls}>First name *</label><input name="firstName" required className={inputCls} /></div>
              <div><label className={labelCls}>Last name *</label><input name="lastName" required className={inputCls} /></div>
              <div><label className={labelCls}>Email</label><input type="email" name="email" className={inputCls} /></div>
              <div><label className={labelCls}>Phone</label><input name="phone" className={inputCls} /></div>
              <div className="col-span-2"><label className={labelCls}>Company</label><input name="company" className={inputCls} /></div>
              <div className="col-span-2"><label className={labelCls}>Special requests</label><input name="specialRequests" placeholder="Free text — e.g. high floor, late arrival" className={inputCls} /></div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-400">Stay & price</div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div>
                <label className={labelCls}>Rate plan *</label>
                <select name="ratePlanId" defaultValue={defaultPlan?.id} required className={inputCls}>
                  {ratePlans.map((rp) => (
                    <option key={rp.id} value={rp.id}>
                      {rp.name}{quotes.get(rp.id) != null ? ` — ${money(quotes.get(rp.id)!)}` : ""}{rp.cancellationPolicy ? ` · ${rp.cancellationPolicy.code}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Total price ({property.baseCurrency}) *</label>
                <input type="number" name="price" step="0.01" min="0" required defaultValue={defaultQuote != null ? (defaultQuote / 100).toFixed(2) : ""} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Booking source *</label>
                <select name="bookingSourceId" required className={inputCls}>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Payment guarantee *</label>
                <select name="paymentGuarantee" defaultValue="none" className={inputCls}>
                  {PAYMENT_GUARANTEES.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 lg:col-span-4"><label className={labelCls}>Notes</label><input name="notes" className={inputCls} /></div>
            </div>
            <p className="mt-2 text-[11.5px] text-ink-400">
              The suggested price is the selected plan’s nightly rates for this stay; override it freely. Payment
              guarantee is a label only — no card data is stored.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-surface-border/60 pt-4">
            <button formAction={releaseHold} name="id" value={hold.id} formNoValidate className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">
              Release hold
            </button>
            <button className="rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">
              Confirm reservation
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
