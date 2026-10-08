import type { Metadata } from "next";
import { MailX } from "lucide-react";
import type { Locale } from "@revio/ui/i18n";
import { guestKit } from "@/lib/i18n/kit";
import { guestLocale } from "@/lib/i18n/server";
import { guestByPrefsToken } from "@/lib/email-prefs";
import { updateEmailPrefs } from "@/lib/actions-email-prefs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const guest = await guestByPrefsToken((await params).token);
  const p = guestKit(await guestLocale(guest?.defaultLanguage ?? "en")).s.prefs;
  return { title: guest ? `${p.title} · ${guest.hotel}` : p.title, robots: { index: false, follow: false } };
}

/**
 * Where the "Unsubscribe" link in a hotel's promotional email lands.
 *
 * Outside `[slug]` on purpose: the hotel's welcome and thank-you notes are sent whatever products it
 * runs, and a hotel with no booking page would otherwise send its guests an opt-out link that 404s.
 * (`email` is a reserved slug for the same reason.)
 *
 * Opening the page changes nothing — see `updateEmailPrefs` for why it takes a click. Every state
 * is a sentence, never an error page: a guest who followed a link we sent is never told off.
 */
export default async function EmailPrefsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  const guest = await guestByPrefsToken(token);
  const locale: Locale = await guestLocale(guest?.defaultLanguage ?? "en");
  const p = guestKit(locale).s.prefs;

  let title: string, body: string, button: { label: string; optOut: boolean } | null;
  if (!guest) {
    title = p.unknownTitle; body = p.unknownBody; button = null;
  } else if (guest.optedOut) {
    title = p.doneTitle;
    body = p.doneBody(guest.hotel);
    button = { label: p.resubscribe, optOut: false };
  } else if (done === "in") {
    title = p.backTitle; body = p.backBody(guest.hotel); button = null;
  } else {
    title = p.title; body = p.body(guest.hotel); button = { label: p.unsubscribe, optOut: true };
  }

  return (
    <main lang={locale} className="mx-auto flex min-h-screen max-w-[34rem] flex-col justify-center px-6 py-16">
      <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "hsl(var(--surface-sunk))", color: "hsl(var(--ink-soft))" }}>
        <MailX size={22} aria-hidden />
      </span>
      <h1 className="display mt-4 text-[1.9rem]">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>{body}</p>
      {button && (
        <form action={updateEmailPrefs.bind(null, token, button.optOut)} className="mt-6">
          <button
            type="submit"
            className={
              button.optOut
                ? "inline-flex h-11 items-center rounded-[var(--r-sm)] px-5 text-[14.5px] font-semibold text-white"
                : "link-quiet text-[14px] font-semibold underline"
            }
            style={button.optOut ? { backgroundColor: "hsl(var(--ink))" } : undefined}
          >
            {button.label}
          </button>
        </form>
      )}
    </main>
  );
}
