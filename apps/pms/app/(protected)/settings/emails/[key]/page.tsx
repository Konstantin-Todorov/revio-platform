import { notFound } from "next/navigation";
import { EMAIL_LOCALES, EMAIL_OPT_IN, EMAIL_TEMPLATE_BY_KEY, defaultsFor, emailStatus, sampleDetails } from "@revio/core";
import { brandOf } from "@revio/email";
import { EmailEditor } from "@revio/ui/email-editor";
import { guestEmailsStrings } from "@revio/ui/guest-emails-strings";
import { translate } from "@revio/ui/i18n";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { saveEmailTemplate, resetEmailTemplate } from "@/lib/actions-email";
import { activeProperty } from "@/lib/data";
import { getLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

/** One email: wording on the left, the guest's inbox view on the right, in one language at a time. */
export default async function EmailEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { key } = await params;
  const sp = await searchParams;
  const def = EMAIL_TEMPLATE_BY_KEY[key];
  if (!def || def.audience !== "guest") notFound();

  const { property } = await activeProperty();
  const guestLang = property.defaultLanguage ?? "en";
  const lang = EMAIL_LOCALES.some((l) => l.key === sp.lang) ? sp.lang! : guestLang;
  // Every language's row, so each tab can say whether the hotel wrote it or it is still ours.
  const rows = await prisma.emailTemplate.findMany({ where: { propertyId: property.id, key } });
  const row = rows.find((r) => r.locale === lang) ?? null;
  const fallback = defaultsFor(def!, lang);
  const ui = translate(guestEmailsStrings, await getLocale());
  const words = ui.templates[key];
  const session = await getSession();
  const status = emailStatus({
    key,
    runs: { crs: Boolean(session?.entitlements.reservation), pms: Boolean(session?.entitlements.pms), bookingPage: Boolean(property.bookingEngineEnabled) },
    switchedOff: row ? !row.enabled : false,
    switchedOn: Boolean(row?.enabled),
  });

  return (
    /* `key`: switching language is a navigation to the same route, and without a remount the editor
       would keep the previous language's text under the new tab. */
    <EmailEditor
      key={lang}
      templateKey={key}
      label={words?.label ?? def!.label}
      description={words?.when ?? def!.description}
      canDisable={def!.canDisable}
      notice={status.kind === "needs" ? ui.status.needsHint[status.needs] : null}
      variables={def!.variables}
      locale={lang}
      locales={EMAIL_LOCALES.map((l) => ({
        key: l.key,
        label: l.label,
        edited: rows.some((r) => r.locale === l.key),
        primary: guestLang === l.key,
      }))}
      enabled={row?.enabled ?? !EMAIL_OPT_IN.has(key)}
      subject={row?.subject ?? fallback.subject}
      body={row?.body ?? fallback.body}
      customised={Boolean(row)}
      brand={brandOf(property)}
      details={sampleDetails(lang)}
      defaults={{ subject: fallback.subject, body: fallback.body }}
      saveAction={saveEmailTemplate}
      resetAction={resetEmailTemplate}
      backHref="/settings/emails"
      langHref={`/settings/emails/${key}?lang={lang}`}
    />
  );
}
