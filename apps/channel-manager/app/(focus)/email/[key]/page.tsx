import { notFound, redirect } from "next/navigation";
import { EMAIL_LOCALES, EMAIL_TEMPLATE_BY_KEY, defaultsFor, sampleDetails } from "@revio/core";
import { getProperty } from "@/lib/data";
import { brandOf } from "@/lib/email-engine";
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
  const row = await prisma.emailTemplate.findUnique({
    where: { propertyId_key_locale: { propertyId: property.id, key, locale } },
  });
  const fallback = defaultsFor(def, locale);

  return (
    <EmailEditor
      templateKey={key}
      label={def.label}
      description={def.description}
      audience={def.audience}
      canDisable={def.canDisable}
      variables={def.variables}
      locale={locale}
      locales={EMAIL_LOCALES.map((l) => ({ key: l.key, label: l.label }))}
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
