import Link from "next/link";
import { ArrowLeft, ChevronRight, Mail, Palette, Users } from "lucide-react";
import { renderEmail, SAMPLE_DETAILS, sampleDetails, EMAIL_THEMES, EMAIL_FONTS, EMAIL_LOCALES } from "@revio/core";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { getProperty } from "@/lib/data";
import { listPropertyTemplates, brandOf } from "@revio/email";
import { prisma } from "@/lib/db";
import { saveEmailBranding } from "@/lib/actions-email";
import { LogoUpload } from "@/components/email/LogoUpload";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400";

export default async function EmailSettingsPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const sp = await searchParams;
  const locale = EMAIL_LOCALES.some((l) => l.key === sp.lang) ? sp.lang! : "en";
  const property = await getProperty();
  const templates = await listPropertyTemplates(prisma, property.id, locale);
  const brand = brandOf(property);
  const logoUrl = brand.logoUrl ?? null;

  // Only the confirmation is previewed on this page — the other seven are previewed live, per
  // keystroke, inside the focused editor.
  const confirmationTpl = templates.find((t) => t.def.key === "booking_confirmation")!;
  const preview = renderEmail({
    subject: confirmationTpl.subject,
    body: confirmationTpl.body,
    brand,
    vars: confirmationTpl.def.variables,
    details: sampleDetails(locale),
    preheader: confirmationTpl.def.description,
  });

  // One miniature of the confirmation per theme, so a hotel picks by eye rather than by name.
  const themeSwatches = EMAIL_THEMES.map((th) => ({
    ...th,
    html: renderEmail({
      subject: confirmationTpl.subject,
      body: confirmationTpl.body,
      brand: { ...brand, theme: th.key },
      vars: confirmationTpl.def.variables,
      details: SAMPLE_DETAILS,
    }).html,
  }));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/settings" className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
        <PageHeader
          title="Guest emails"
          subtitle={`${property.name} · what your guests receive, in your words and your branding`}
        />
      </div>

      {/* Branding — applied to every guest email this property sends. */}
      <Card>
        <CardHeader
          title="Your branding"
          subtitle="Applied to every guest email. The sending domain stays ours for deliverability; everything the guest sees is yours."
        />
        <form action={saveEmailBranding} className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-3">
          <div>
            <label className={labelCls}>Sender name</label>
            <input name="emailSenderName" defaultValue={property.emailSenderName ?? ""} placeholder={property.name} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Reply-to address</label>
            <input type="email" name="emailReplyTo" defaultValue={property.emailReplyTo ?? ""} placeholder="reception@yourhotel.com" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Brand colour</label>
            <input name="emailBrandColor" defaultValue={property.emailBrandColor ?? ""} placeholder="#0E7C86" className={inputCls} />
          </div>

          <div className="col-span-2 lg:col-span-3">
            <label className={labelCls}>Footer (address / legal line)</label>
            <input name="emailFooterText" defaultValue={property.emailFooterText ?? ""} placeholder="1 Vitosha Blvd, Sofia · +359 2 000 0000" className={inputCls} />
          </div>
          {/* Design — a different look per hotel, chosen by eye. */}
          <div className="col-span-2 lg:col-span-3">
            <label className={labelCls}>Design</label>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {themeSwatches.map((th) => (
                <label key={th.key} className="cursor-pointer">
                  <input
                    type="radio"
                    name="emailTheme"
                    value={th.key}
                    defaultChecked={(property.emailTheme || "classic") === th.key}
                    className="peer sr-only"
                  />
                  <div className="overflow-hidden rounded-lg border-2 border-surface-border transition-colors peer-checked:border-brand-600 peer-checked:ring-2 peer-checked:ring-brand-600/20">
                    <div className="h-[150px] overflow-hidden bg-white">
                      <iframe
                        title={`${th.label} theme`}
                        srcDoc={th.html}
                        tabIndex={-1}
                        className="pointer-events-none h-[500px] w-[580px] origin-top-left"
                        style={{ transform: "scale(0.44)", border: "0" }}
                      />
                    </div>
                    <div className="border-t border-surface-border bg-white px-2.5 py-2">
                      <div className="text-[12px] font-semibold text-ink-900">{th.label}</div>
                      <div className="text-[10.5px] leading-snug text-ink-400">{th.blurb}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Typeface</label>
            <select name="emailFont" defaultValue={property.emailFont || "serif"} className={inputCls}>
              {EMAIL_FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div className="col-span-2 flex items-end justify-end lg:col-span-2">
            <button className="rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <Palette className="mr-1.5 inline h-3.5 w-3.5" /> Save branding &amp; design
            </button>
          </div>
        </form>

        {/*
          The logo sits OUTSIDE the branding form, not inside it.

          `LogoUpload` is its own form with its own action, and a form nested in a form is invalid
          HTML: the browser drops the inner one, so pressing "Upload logo" submitted the BRANDING
          form instead — saving branding and never uploading. It also produced a hydration error on
          every render of this page. Uploading is a separate action from saving branding, and now the
          markup says so.
        */}
        <div className="border-t border-surface-border px-4 py-4">
          <label className={labelCls}>Logo</label>
          <LogoUpload currentUrl={logoUrl} />
        </div>
      </Card>

      {/* Live preview */}
      <Card>
        <CardHeader title="Preview" subtitle="Your booking confirmation, exactly as a guest receives it" />
        <div className="p-4">
          <div className="mb-2 text-[11.5px] text-ink-500">
            <span className="font-semibold text-ink-700">From:</span> {preview.fromName}
            {preview.replyTo && <> · <span className="font-semibold text-ink-700">Reply-to:</span> {preview.replyTo}</>}
          </div>
          <div className="mb-2 text-[13px] font-semibold text-ink-900">{preview.subject}</div>
          <iframe
            title="Email preview"
            srcDoc={preview.html}
            className="h-[420px] w-full rounded-lg border border-surface-border bg-white"
          />
        </div>
      </Card>

      {/* The catalogue */}
      <Card>
        <CardHeader
          title={`Emails (${templates.length})`}
          subtitle="Switch each one on or off and edit the wording. {{placeholders}} are filled in automatically."
        />
        {/*
          The language sits on its own row above the list, labelled, rather than as a control in the
          card header. It changes what every row below means — open a row and you edit THAT language —
          so it is a mode, not an option, and a mode the reader has to notice before clicking anything.
          As a header action it was mistaken for decoration.
        */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-surface-border bg-surface-muted/40 px-4 py-3">
          <span className="text-[12px] font-semibold text-ink-700">Editing language</span>
          <div className="flex items-center gap-1 rounded-md border border-surface-border bg-white p-0.5">
            {EMAIL_LOCALES.map((l) => (
              <Link
                key={l.key}
                href={`/settings/emails?lang=${l.key}`}
                className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  locale === l.key ? "bg-brand-800 text-white" : "text-ink-500 hover:bg-surface-muted"
                }`}
              >
                {l.label}
                {(property.defaultLanguage ?? "en") === l.key && (
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wide ${
                      locale === l.key ? "text-white/70" : "text-ink-400"
                    }`}
                  >
                    default
                  </span>
                )}
              </Link>
            ))}
          </div>
          <p className="w-full text-[11.5px] text-ink-500 sm:w-auto sm:flex-1">
            Each language is edited separately. A guest receives their own language when we know it,
            otherwise your default. Untranslated emails fall back to English rather than not sending.
          </p>
        </div>
        <div className="divide-y divide-surface-border">
          {templates.map((t) => (
            /* Each email opens in focus mode — one email, full screen, live preview. Editing wording
               a guest will read deserves the whole window, not an accordion inside a settings page. */
            <Link
              key={t.def.key}
              href={`/email/${t.def.key}?lang=${locale}`}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                <Mail className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-ink-900">{t.def.label}</span>
                  {t.def.audience === "staff" && (
                    <span className="inline-flex items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-500">
                      <Users className="h-3 w-3" /> internal
                    </span>
                  )}
                  {t.customised && <StatusPill tone="info">edited</StatusPill>}
                  {!t.enabled && <StatusPill tone="neutral">off</StatusPill>}
                  {!t.def.canDisable && <span className="text-[10.5px] text-ink-400">always sent</span>}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-ink-400">{t.def.description}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
