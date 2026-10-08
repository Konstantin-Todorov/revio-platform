import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { REVIO_ENTITY } from "@revio/core";
import { getPublicProperty } from "@/lib/property";
import { serverKit } from "@/lib/i18n/server";
import { PropertyHeader } from "@/components/PropertyHeader";
import { PropertyFooter } from "@/components/PropertyFooter";

export const dynamic = "force-dynamic";

/**
 * The privacy notice for a hotel that has not linked its own (GDPR Art. 13).
 *
 * The booking form asks a stranger for a name, an email and a phone number, and the information
 * about what happens to them must be available AT that moment — not on a website the guest may never
 * open. Before this page existed, a hotel with no policy of its own collected all three with no
 * notice at all, and the platform gave it no way not to.
 *
 * Built from the hotel's own facts — its legal entity and address from its invoicing identity, its
 * contact email — and from what this product actually does with the data, so it cannot promise
 * anything the code does not do. A hotel that has its own policy sets it in RevioCRS → Booking Engine,
 * and every link then goes there instead; this page redirects too, so an old link never shows a
 * notice the hotel has replaced.
 */
export default async function PrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = await getPublicProperty(slug);
  if (!property) notFound();
  if (property.privacyIsOwn) redirect(property.privacyUrl);

  const { s, locale } = await serverKit(property);
  const n = s.privacyNotice;
  const controller = [property.legal.name ?? property.name, property.legal.vatId, property.legal.address ?? property.address]
    .filter(Boolean)
    .join(", ");
  const contact = property.contactEmail ?? property.name;
  const processor = `${REVIO_ENTITY.name[locale === "bg" ? "bg" : "en"]} (Revio)`;

  const sections: [string, string][] = [
    [n.controllerTitle, n.controllerBody(controller)],
    [n.whatTitle, n.whatBody],
    [n.whyTitle, n.whyBody],
    [n.whoTitle, n.whoBody(processor)],
    [n.keepTitle, n.keepBody],
    [n.marketingTitle, n.marketingBody],
    [n.rightsTitle, n.rightsBody(contact)],
    [n.complaintTitle, n.complaintBody],
    [n.cookiesTitle, n.cookiesBody],
  ];

  return (
    <>
      <PropertyHeader property={property} />
      <main className="mx-auto w-full max-w-[42rem] px-5 pb-20 pt-10 sm:px-8">
        <h1 className="display text-[2rem]">{n.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>{n.intro(property.name)}</p>
        <div className="mt-8 space-y-6">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-[15px] font-semibold" style={{ color: "hsl(var(--ink))" }}>{title}</h2>
              <p className="mt-1.5 text-[14.5px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>{body}</p>
            </section>
          ))}
        </div>
        <Link href={`/${property.slug}`} className="link-quiet mt-10 inline-block text-[14px] font-semibold">
          {n.back}
        </Link>
      </main>
      <PropertyFooter property={property} />
    </>
  );
}
