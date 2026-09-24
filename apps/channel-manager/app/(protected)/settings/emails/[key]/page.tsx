import { notFound } from "next/navigation";
import { EMAIL_LOCALES, EMAIL_SENT_BY, EMAIL_TEMPLATE_BY_KEY, defaultsFor, sampleDetails } from "@revio/core";
import { brandOf } from "@revio/email";
import { EmailEditor } from "@revio/ui/email-editor";
import { guestEmailsStrings } from "@revio/ui/guest-emails-strings";
import { translate } from "@revio/ui/i18n";
import { prisma } from "@/lib/db";
import { saveEmailTemplate, resetEmailTemplate } from "@/lib/actions-email";
import { getProperty } from "@/lib/data";

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

  const property = await getProperty();
  const guestLang = property.defaultLanguage ?? "en";
  const lang = EMAIL_LOCALES.some((l) => l.key === sp.lang) ? sp.lang! : guestLang;
  // Every language's row, so each tab can say whether the hotel wrote it or it is still ours.
  const rows = await prisma.emailTemplate.findMany({ where: { propertyId: property.id, key } });
  const row = rows.find((r) => r.locale === lang) ?? null;
  const fallback = defaultsFor(def!, lang);
  const words = translate(guestEmailsStrings, "en").templates[key];

  return (
    /* `key`: switching language is a navigation to the same route, and without a remount the editor
       would keep the previous language's text under the new tab. */
    <EmailEditor
      key={lang}
      templateKey={key}
      label={words?.label ?? def!.label}
      description={words?.when ?? def!.description}
      canDisable={def!.canDisable}
      wired={(EMAIL_SENT_BY[key] ?? []).length > 0}
      variables={def!.variables}
      locale={lang}
      locales={EMAIL_LOCALES.map((l) => ({
        key: l.key,
        label: l.label,
        edited: rows.some((r) => r.locale === l.key),
        primary: guestLang === l.key,
      }))}
      enabled={row?.enabled ?? true}
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
