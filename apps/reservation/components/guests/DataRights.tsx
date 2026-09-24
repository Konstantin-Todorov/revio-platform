import { Download, ShieldAlert, Check } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { eraseGuest } from "@/lib/actions-reservations";
import { ERASURE_RETAINED } from "@revio/core";
import { i18n } from "@/lib/i18n/server";
import { guests as guestsDict, type GuestsStrings } from "@/lib/i18n/guests";

/**
 * The guest's own rights over their data — Art. 15 access, Art. 20 portability, Art. 17 erasure.
 *
 * The published DPA already told hotels they could do this from the product. They could not. This is
 * the screen that makes the sentence true.
 *
 * ## Why erasure asks you to type a word
 *
 * There is no undo anywhere in this product and none is possible here — the whole point is that the
 * data is gone. A checkbox beside a red button is dismissed by muscle memory; typing ERASE is a
 * deliberate act, and it is the cheapest possible guard on the one action that cannot be walked back.
 *
 * ## Why what SURVIVES is stated before you press it
 *
 * A hotelier acting on a guest's request needs to be able to answer "is it all gone?" honestly, in
 * the moment, to the person standing in front of them. Discovering afterwards that invoices remain
 * makes the hotel look evasive about something that is in fact legally required.
 */
export async function DataRights({
  guestId,
  guestName,
  erasedAt,
  notice,
}: {
  guestId: string;
  guestName: string;
  erasedAt: Date | null;
  notice?: string;
}) {
  const { t: tr, day } = await i18n();
  const t = tr(guestsDict).data;
  if (erasedAt) {
    return (
      <Card>
        <CardHeader title={t.title} subtitle={t.erasedSub} />
        <div className="px-4 py-4">
          <p className="flex items-start gap-2 text-[13px] text-ink-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
            <span>
              {t.erasedBody(day(erasedAt.toISOString().slice(0, 10)))}
            </span>
          </p>
          <Retained t={t} />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={t.title}
        subtitle={t.sub}
      />

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-ink-900">{t.exportTitle}</h3>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">
              {t.exportBody}
            </p>
          </div>
          <a
            href={`/api/guests/${guestId}/export`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-surface-border px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
          >
            <Download className="h-3.5 w-3.5" /> {t.export}
          </a>
        </div>

        <div className="rounded-lg border border-danger-200 bg-danger-50/40 p-3.5">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-danger-700">
            <ShieldAlert className="h-4 w-4" /> {t.eraseTitle}
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
            {t.eraseBody(guestName)} <strong className="text-ink-900">{t.cannotUndo}</strong>
          </p>

          {notice && (
            <p className="mt-2 rounded-md bg-white px-2.5 py-1.5 text-[12px] font-medium text-danger-700">
              {notice}
            </p>
          )}

          <form action={eraseGuest} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={guestId} />
            <input
              name="confirm"
              autoComplete="off"
              placeholder={t.typeErase}
              aria-label={t.typeErase}
              className="h-8 w-52 rounded-md border border-surface-border bg-white px-2.5 text-[12.5px] outline-none focus:border-danger-500"
            />
            <button
              type="submit"
              className="h-8 rounded-md bg-danger-600 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-danger-700"
            >
              {t.erase}
            </button>
          </form>

          <Retained t={t} />
        </div>
      </div>
    </Card>
  );
}

/** Said before the button is pressed, not discovered afterwards. */
function Retained({ t }: { t: GuestsStrings["data"] }) {
  return (
    <div className="mt-3 border-t border-surface-border pt-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{t.keptTitle}</p>
      <ul className="mt-1.5 space-y-1.5">
        {ERASURE_RETAINED.map((r, i) => (
          <li key={r.what} className="text-[11.5px] leading-relaxed text-ink-500">
            <span className="font-semibold text-ink-700">{t.kept[i]?.what ?? r.what}</span> — {t.kept[i]?.why ?? r.why}
          </li>
        ))}
      </ul>
    </div>
  );
}
