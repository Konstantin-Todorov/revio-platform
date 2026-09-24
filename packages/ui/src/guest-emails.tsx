import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarCheck, Check, ChevronRight, Hourglass, Mail, Palette, PlaneLanding, Receipt } from "lucide-react";
import {
  EMAIL_FONTS, EMAIL_LOCALES, EMAIL_OPT_IN, EMAIL_TEMPLATE_BY_KEY, EMAIL_THEMES, defaultsFor, emailStatus, guestEmailsByStage,
  renderEmail, sampleDetails, type EmailBrand, type EmailStage,
} from "@revio/core";
import { translate, type Locale } from "./i18n";
import { guestEmailsStrings, type GuestEmailsStrings } from "./guest-emails-strings";

const STAGE_ICON: Record<EmailStage, typeof Mail> = {
  booking: CalendarCheck, before: PlaneLanding, after: Receipt, waitlist: Hourglass,
};

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-2.5 py-2 text-[13px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[11.5px] font-semibold text-ink-600";

export interface GuestEmailsProperty {
  name: string;
  defaultLanguage: string;
  emailSenderName: string | null;
  emailReplyTo: string | null;
  emailBrandColor: string | null;
  emailFooterText: string | null;
  emailTheme: string | null;
  emailFont: string | null;
}

/**
 * Guest emails — one screen for RevioLink, RevioCRS and RevioPMS, over the same rows.
 *
 * ## Why it looks like this
 *
 * The founder could not find it (it sat under "Other" in RevioLink's Settings, and not at all in the
 * other two products) and, once found, could not tell what order it was in or which language guests
 * receive. So, top to bottom, the three questions a hotel actually has:
 *
 * 1. **Which language do my guests get?** Asked first, as a two-button choice, because it changes
 *    what every row below means.
 * 2. **What do they receive, and when?** The emails in the order a stay happens — booking, before
 *    arrival, after the stay, waiting list — each saying when it goes out. An email nothing sends
 *    yet says so ("Not sent yet") instead of offering a switch that does nothing.
 * 3. **How does it look?** Sender, logo, colour and design are their own tab: they are set once and
 *    rarely touched, and they used to sit above the list and push it off the screen.
 *
 * Server component: the language arrives as a prop, the actions are the app's own.
 */
export function GuestEmails({
  locale = "en",
  tab,
  basePath,
  editorHref,
  property,
  brand,
  states,
  runs,
  setLanguageAction,
  saveLookAction,
  logoSlot,
  teamHref,
  panelLanguageSwitch = false,
}: {
  locale?: Locale;
  tab: "emails" | "look";
  /** Where this screen lives in the app, e.g. "/settings/emails". */
  basePath: string;
  editorHref: (key: string, lang: string) => string;
  property: GuestEmailsProperty;
  brand: EmailBrand;
  /** Per template key: the languages the hotel has written, and those it switched off. */
  states: Record<string, { edited: string[]; off: string[]; on: string[]; subjects: Record<string, string> }>;
  /** What this hotel runs — an email only "sends automatically" if something here sends it. */
  runs: { crs: boolean; pms: boolean; bookingPage: boolean };
  setLanguageAction: (fd: FormData) => Promise<void>;
  saveLookAction: (fd: FormData) => Promise<void>;
  /** The app's own logo upload (its action), rendered in the Look tab. */
  logoSlot: ReactNode;
  /** Only where staff mail is configured (RevioLink): a link to it. */
  teamHref?: string;
  /** This product lets a person choose the panel's language — say that it is a separate choice. */
  panelLanguageSwitch?: boolean;
}) {
  const s = translate(guestEmailsStrings, locale);
  const guestLang = EMAIL_LOCALES.some((l) => l.key === property.defaultLanguage) ? property.defaultLanguage : "en";

  const tabLink = (id: "emails" | "look", label: string, Icon: typeof Mail) => (
    <Link
      href={id === "emails" ? basePath : `${basePath}?tab=look`}
      aria-current={tab === id ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors ${
        tab === id ? "border-brand-700 text-brand-800" : "border-transparent text-ink-500 hover:text-ink-700"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[17px] font-bold tracking-tight text-ink-900">{s.title}</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-500">{s.subtitle}</p>
      </div>

      {/* 1. The language — first, because it changes what every row below means. */}
      <section className="rounded-lg border border-surface-border bg-white p-4 shadow-card">
        <form action={setLanguageAction} className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[13.5px] font-semibold text-ink-900">{s.language.title}</span>
          <span className="flex items-center gap-1 rounded-lg border border-surface-border bg-surface-muted p-1">
            {EMAIL_LOCALES.map((l) => {
              const on = l.key === guestLang;
              return (
                <button
                  key={l.key}
                  type="submit"
                  name="locale"
                  value={l.key}
                  aria-pressed={on}
                  lang={l.key}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    on ? "bg-brand-800 text-white shadow-sm" : "text-ink-600 hover:bg-white"
                  }`}
                >
                  {on && <Check className="h-3.5 w-3.5" />} {l.label}
                </button>
              );
            })}
          </span>
          <p className="w-full text-[12px] leading-relaxed text-ink-500">
            {s.language.body}
            {panelLanguageSwitch && <span className="text-ink-400"> {s.language.panelNote}</span>}
          </p>
        </form>
      </section>

      <div className="flex items-center gap-1 border-b border-surface-border">
        {tabLink("emails", s.tabs.emails, Mail)}
        {tabLink("look", s.tabs.look, Palette)}
      </div>

      {tab === "emails" ? (
        <div className="space-y-4">
          {guestEmailsByStage().map(({ stage, templates }) => {
            const Icon = STAGE_ICON[stage];
            return (
              <section key={stage} className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
                <h3 className="flex items-center gap-2 border-b border-surface-border bg-surface-muted/50 px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-500">
                  <Icon className="h-4 w-4 text-ink-400" /> {s.stages[stage]}
                </h3>
                <ul className="divide-y divide-surface-border/70">
                  {templates.map((def) => {
                    const st = states[def.key] ?? { edited: [], off: [], on: [], subjects: {} };
                    const t = s.templates[def.key] ?? { label: def.label, when: def.description };
                    const verdict = emailStatus({
                      key: def.key, runs,
                      switchedOff: st.off.includes(guestLang),
                      switchedOn: st.on.includes(guestLang),
                    });
                    const live = verdict.kind !== "needs";
                    const status =
                      verdict.kind === "needs"
                        ? { text: s.status.needs[verdict.needs], cls: "bg-surface-sunken text-ink-500" }
                        : verdict.kind === "auto"
                          ? { text: s.status.always, cls: "bg-success-50 text-success-700" }
                          : verdict.kind === "off"
                            ? { text: s.status.off, cls: "bg-surface-sunken text-ink-500" }
                            : { text: s.status.on, cls: "bg-success-50 text-success-700" };
                    // The subject a guest will actually see, in the language they will get it — so the
                    // language of the mail is visible on the list, whatever language this panel is in.
                    const words = defaultsFor(def, guestLang);
                    const subject = (st.subjects[guestLang] ?? words.subject).replace(
                      /\{\{(\w+)\}\}/g,
                      (m, k: string) => (k === "propertyName" ? property.name : def.variables[k] ?? m),
                    );
                    const hint = !live
                      ? s.status.needsHint[verdict.kind === "needs" ? verdict.needs : "crs"]
                      : EMAIL_OPT_IN.has(def.key) && verdict.kind === "off"
                        ? `${t.when} · ${s.status.optInHint}`
                        : t.when;
                    return (
                      <li key={def.key}>
                        <Link
                          href={editorHref(def.key, guestLang)}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className={`text-[13.5px] font-semibold ${live ? "text-ink-900" : "text-ink-500"}`}>{t.label}</span>
                              <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${status.cls}`}>{status.text}</span>
                            </span>
                            <span className="mt-0.5 block text-[12px] text-ink-500">{hint}</span>
                            <span lang={guestLang} className="mt-1 block truncate text-[12px] text-ink-700">
                              <span className="text-ink-400">{s.status.subject}</span> {subject}
                            </span>
                            {/* Whose words, per language — the question a hotel has before it opens one. */}
                            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-400">
                              {EMAIL_LOCALES.map((l) => (
                                <span key={l.key} className="inline-flex items-center gap-1">
                                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${st.edited.includes(l.key) ? "bg-success-500" : "bg-ink-200"}`} />
                                  {l.label} · {st.edited.includes(l.key) ? s.status.yours : s.status.ours}
                                </span>
                              ))}
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {teamHref && (
            <p className="px-1 text-[12px] text-ink-500">
              {s.team}{" "}
              <Link href={teamHref} className="font-semibold text-brand-700 hover:underline">{s.teamLink}</Link>
            </p>
          )}
        </div>
      ) : (
        <LookTab s={s} property={property} brand={brand} guestLang={guestLang} saveLookAction={saveLookAction} logoSlot={logoSlot} />
      )}
    </div>
  );
}

function LookTab({ s, property, brand, guestLang, saveLookAction, logoSlot }: {
  s: GuestEmailsStrings;
  property: GuestEmailsProperty;
  brand: EmailBrand;
  guestLang: string;
  saveLookAction: (fd: FormData) => Promise<void>;
  logoSlot: ReactNode;
}) {
  // The confirmation, in the language guests actually receive, in the hotel's own saved wording if any
  // would need a query; our wording is what most hotels send, and the point here is the LOOK.
  const def = EMAIL_TEMPLATE_BY_KEY.booking_confirmation!;
  const words = defaultsFor(def, guestLang);
  const render = (b: EmailBrand) =>
    renderEmail({ subject: words.subject, body: words.body, brand: b, vars: def.variables, details: sampleDetails(guestLang) });
  const preview = render(brand);

  return (
    <div className="space-y-5">
      <form action={saveLookAction} className="space-y-5 rounded-lg border border-surface-border bg-white p-4 shadow-card">
        <div>
          <h3 className="text-[14px] font-bold text-ink-900">{s.look.sender}</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">{s.look.senderHint}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>{s.look.senderName}</label>
              <input name="emailSenderName" defaultValue={property.emailSenderName ?? ""} placeholder={property.name} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{s.look.replyTo}</label>
              <input type="email" name="emailReplyTo" defaultValue={property.emailReplyTo ?? ""} placeholder="reception@yourhotel.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{s.look.colour}</label>
              <input name="emailBrandColor" defaultValue={property.emailBrandColor ?? ""} placeholder="#0E7C86" className={inputCls} />
            </div>
            <div className="sm:col-span-3">
              <label className={labelCls}>{s.look.footer}</label>
              <input name="emailFooterText" defaultValue={property.emailFooterText ?? ""} placeholder={s.look.footerPlaceholder} className={inputCls} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-[14px] font-bold text-ink-900">{s.look.design}</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">{s.look.designHint}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {EMAIL_THEMES.map((th) => (
              <label key={th.key} className="cursor-pointer">
                <input type="radio" name="emailTheme" value={th.key} defaultChecked={(property.emailTheme || "classic") === th.key} className="peer sr-only" />
                <div className="overflow-hidden rounded-lg border-2 border-surface-border transition-colors peer-checked:border-brand-600 peer-checked:ring-2 peer-checked:ring-brand-600/20">
                  <div className="h-[140px] overflow-hidden bg-white">
                    <iframe
                      title={s.themes[th.key]?.label ?? th.label}
                      srcDoc={render({ ...brand, theme: th.key }).html}
                      tabIndex={-1}
                      className="pointer-events-none h-[500px] w-[580px] origin-top-left"
                      style={{ transform: "scale(0.42)", border: "0" }}
                    />
                  </div>
                  <div className="border-t border-surface-border bg-white px-2.5 py-2">
                    <div className="text-[12px] font-semibold text-ink-900">{s.themes[th.key]?.label ?? th.label}</div>
                    <div className="text-[10.5px] leading-snug text-ink-400">{s.themes[th.key]?.blurb ?? th.blurb}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-3 max-w-xs">
            <label className={labelCls}>{s.look.typeface}</label>
            <select name="emailFont" defaultValue={property.emailFont || "serif"} className={inputCls}>
              {EMAIL_FONTS.map((f) => <option key={f.key} value={f.key}>{s.fonts[f.key] ?? f.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end border-t border-surface-border pt-4">
          <button className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">
            <Palette className="h-4 w-4" /> {s.look.save}
          </button>
        </div>
      </form>

      {/* Its own form (its own action): a form inside a form is dropped by the browser. */}
      <section className="rounded-lg border border-surface-border bg-white p-4 shadow-card">
        <h3 className="mb-3 text-[14px] font-bold text-ink-900">{s.look.logo}</h3>
        {logoSlot}
      </section>

      <section className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
        <div className="border-b border-surface-border px-4 py-3">
          <h3 className="text-[14px] font-bold text-ink-900">{s.look.preview}</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">{s.look.previewHint}</p>
          <p className="mt-1.5 text-[11.5px] text-ink-500">
            <span className="font-semibold text-ink-700">{s.look.from}</span> {preview.fromName}
            {preview.replyTo && <> · <span className="font-semibold text-ink-700">{s.look.replyToShort}</span> {preview.replyTo}</>}
          </p>
          <p className="mt-0.5 text-[13px] font-semibold text-ink-900">{preview.subject}</p>
        </div>
        <iframe title={s.look.preview} srcDoc={preview.html} className="h-[460px] w-full bg-white" />
      </section>
    </div>
  );
}
