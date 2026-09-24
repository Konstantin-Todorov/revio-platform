import { brandOf, templateStates } from "@revio/email";
import { GuestEmails } from "@revio/ui/guest-emails";
import { EmailLogoUpload } from "@revio/ui/email-logo-upload";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { saveEmailBranding, setDefaultLanguage, uploadEmailLogo, removeEmailLogo } from "@/lib/actions-email";
import { getProperty } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Guest emails — the shared screen (`@revio/ui/guest-emails`), the same in RevioLink, RevioCRS and
 * RevioPMS over the same rows. This page only loads the property and hands over this product's actions.
 */
export default async function GuestEmailsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const property = await getProperty();
  const brand = brandOf(property);
  const [states, session] = await Promise.all([templateStates(prisma, property.id), getSession()]);
  // What this hotel runs decides what each email's status can honestly say.
  const runs = {
    crs: Boolean(session?.entitlements.reservation),
    pms: Boolean(session?.entitlements.pms),
    bookingPage: Boolean(property.bookingEngineEnabled),
  };

  return (
    <GuestEmails
      
      tab={tab === "look" ? "look" : "emails"}
      basePath="/settings/emails"
      editorHref={(key, lang) => `/settings/emails/${key}?lang=${lang}`}
      property={property}
      brand={brand}
      states={states}
      runs={runs}
      setLanguageAction={setDefaultLanguage}
      saveLookAction={saveEmailBranding}
      logoSlot={<EmailLogoUpload currentUrl={brand.logoUrl ?? null} uploadAction={uploadEmailLogo} removeAction={removeEmailLogo} />}
      teamHref="/settings/delivery"
    />
  );
}
