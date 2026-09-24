import { brandOf, templateStates } from "@revio/email";
import { GuestEmails } from "@revio/ui/guest-emails";
import { EmailLogoUpload } from "@revio/ui/email-logo-upload";
import { prisma } from "@/lib/db";
import { saveEmailBranding, setDefaultLanguage, uploadEmailLogo, removeEmailLogo } from "@/lib/actions-email";
import { activeProperty } from "@/lib/data";
import { getLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

/**
 * Guest emails — the shared screen (`@revio/ui/guest-emails`), the same in RevioLink, RevioCRS and
 * RevioPMS over the same rows. This page only loads the property and hands over this product's actions.
 */
export default async function GuestEmailsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const { property } = await activeProperty();
  const locale = await getLocale();
  const brand = brandOf(property);
  const states = await templateStates(prisma, property.id);

  return (
    <GuestEmails
      locale={locale}
      tab={tab === "look" ? "look" : "emails"}
      basePath="/settings/emails"
      editorHref={(key, lang) => `/settings/emails/${key}?lang=${lang}`}
      property={property}
      brand={brand}
      states={states}
      setLanguageAction={setDefaultLanguage}
      saveLookAction={saveEmailBranding}
      logoSlot={<EmailLogoUpload currentUrl={brand.logoUrl ?? null} uploadAction={uploadEmailLogo} removeAction={removeEmailLogo} />}
      
    />
  );
}
