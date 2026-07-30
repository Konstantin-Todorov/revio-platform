import { notFound, redirect } from "next/navigation";
import { EMAIL_LOCALES, EMAIL_TEMPLATE_BY_KEY, defaultsFor, sampleDetails } from "@revio/core";
import { getProperty } from "@/lib/data";
import { brandOf } from "@revio/email";
import { prisma } from "@/lib/db";
import { EmailEditor } from "@/components/email/EmailEditor";

export const dynamic = "force-dynamic";

/** One email, full screen: wording on the left, the guest's view on the right, nothing else. */
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
  if (!def) notFound();

  const locale = EMAIL_LOCALES.some((l) => l.key === sp.lang) ? sp.lang! : "en";
  const property = await getProperty();
  /**
   * Every language's row, not just the one being edited — so each tab can say whether the hotel has
   * actually written that language or is still showing our wording. Without it a hotel opens
   * Bulgarian, sees text, and has no way to tell it is ours rather than theirs.
   */
  const rows = await prisma.emailTemplate.findMany({ where: { propertyId: property.id, key } });
  const row = rows.find((r) => r.locale === locale) ?? null;
  const fallback = defaultsFor(def, locale);

  return (
    /**
     * `key` matters: switching language is a navigation to the SAME route, so React keeps the editor
     * mounted and its useState-from-props would hold the previous language's text — the tab would
     * change while the words did not. Remounting per locale is the fix.
     */
    <EmailEditor
      key={locale}
      templateKey={key}
      label={def.label}
      description={def.description}
      audience={def.audience}
      canDisable={def.canDisable}
      variables={def.variables}
      locale={locale}
      locales={EMAIL_LOCALES.map((l) => ({
        key: l.key,
        label: l.label,
        /** Has the hotel written this language, or is it still our wording? */
        edited: rows.some((r) => r.locale === l.key),
        /** The language most guests actually receive — worth knowing before you spend time on another. */
        primary: (property.defaultLanguage ?? "en") === l.key,
      }))}
      enabled={row?.enabled ?? true}
      subject={row?.subject ?? fallback.subject}
      body={row?.body ?? fallback.body}
      customised={Boolean(row)}
      brand={brandOf(property)}
      details={def.audience === "guest" ? sampleDetails(locale) : []}
      defaults={{ subject: fallback.subject, body: fallback.body }}
    />
  );
}
