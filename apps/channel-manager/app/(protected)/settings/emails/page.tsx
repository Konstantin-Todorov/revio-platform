import Link from "next/link";
import { ArrowLeft, Mail, Palette, RotateCcw, Users } from "lucide-react";
import { renderEmail, SAMPLE_DETAILS } from "@revio/core";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { getProperty } from "@/lib/data";
import { listPropertyTemplates, brandOf } from "@/lib/email-engine";
import { saveEmailBranding, saveEmailTemplate, resetEmailTemplate } from "@/lib/actions-email";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400";

export default async function EmailSettingsPage() {
  const property = await getProperty();
  const templates = await listPropertyTemplates(property.id);
  const brand = brandOf(property);

  // Live preview for EVERY template, rendered with the property's real branding — so a hotel can see
  // each email exactly as its guest receives it, not just the confirmation.
  const previews = new Map(
    templates.map((t) => [
      t.def.key,
      renderEmail({
        subject: t.subject,
        body: t.body,
        brand,
        vars: t.def.variables,
        details: t.def.audience === "guest" ? SAMPLE_DETAILS : [],
        preheader: t.def.description,
      }),
    ]),
  );
  const preview = previews.get("booking_confirmation")!;

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
          <div className="col-span-2">
            <label className={labelCls}>Logo URL</label>
            <input name="emailLogoUrl" defaultValue={property.emailLogoUrl ?? ""} placeholder="https://yourhotel.com/logo.png" className={inputCls} />
          </div>
          <div className="col-span-2 lg:col-span-3">
            <label className={labelCls}>Footer (address / legal line)</label>
            <input name="emailFooterText" defaultValue={property.emailFooterText ?? ""} placeholder="1 Vitosha Blvd, Sofia · +359 2 000 0000" className={inputCls} />
          </div>
          <div className="col-span-2 flex justify-end lg:col-span-3">
            <button className="rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <Palette className="mr-1.5 inline h-3.5 w-3.5" /> Save branding
            </button>
          </div>
        </form>
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
        <div className="divide-y divide-surface-border">
          {templates.map((t) => (
            <details key={t.def.key} className="group">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 hover:bg-surface-muted">
                <Mail className="h-4 w-4 shrink-0 text-ink-400" />
                <span className="text-[13px] font-semibold text-ink-900">{t.def.label}</span>
                {t.def.audience === "staff" && (
                  <span className="inline-flex items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-500">
                    <Users className="h-3 w-3" /> internal
                  </span>
                )}
                {t.customised && <StatusPill tone="info">edited</StatusPill>}
                {!t.enabled && <StatusPill tone="neutral">off</StatusPill>}
                {!t.def.canDisable && <span className="text-[10.5px] text-ink-400">always sent</span>}
                <span className="ml-auto text-[11.5px] text-ink-400">{t.def.description}</span>
              </summary>

              <form action={saveEmailTemplate} className="space-y-3 border-t border-surface-border/60 bg-surface-muted/30 p-4">
                <input type="hidden" name="key" value={t.def.key} />
                {t.def.canDisable && (
                  <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-700">
                    <input type="checkbox" name="enabled" defaultChecked={t.enabled} className="h-4 w-4 rounded border-surface-border text-brand-600" />
                    Send this email
                  </label>
                )}
                <div>
                  <label className={labelCls}>Subject</label>
                  <input name="subject" defaultValue={t.subject} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Message</label>
                  <textarea name="body" defaultValue={t.body} rows={10} className={`${inputCls} font-mono leading-relaxed`} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Available:</span>
                  {Object.keys(t.def.variables).map((v) => (
                    <code key={v} className="rounded bg-white px-1.5 py-0.5 text-[11px] text-brand-700">{`{{${v}}}`}</code>
                  ))}
                </div>
                <div className="rounded-lg border border-surface-border bg-white p-3">
                  <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                    Preview — as the guest receives it
                  </div>
                  <iframe
                    title={`Preview ${t.def.label}`}
                    srcDoc={previews.get(t.def.key)!.html}
                    className="h-[360px] w-full rounded border border-surface-border bg-white"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  {t.customised && (
                    <button formAction={resetEmailTemplate} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-600 hover:bg-surface-muted">
                      <RotateCcw className="h-3.5 w-3.5" /> Reset to default
                    </button>
                  )}
                  <button className="rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Save</button>
                </div>
              </form>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
