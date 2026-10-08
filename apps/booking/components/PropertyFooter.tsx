import Link from "next/link";
import { Clock, CreditCard, MapPin, Phone, Mail, ShieldCheck, Ticket } from "lucide-react";
import type { PublicProperty } from "@/lib/property";
import { serverKit } from "@/lib/i18n/server";
import { REVIO_CONTACT } from "@revio/core";
import { ConsentSettingsButton } from "@/components/Consent";

/**
 * The hotel's own details, closing every page — in three columns a guest scans for one thing each:
 * how to reach the hotel, what to know about the stay, and where to go when they need their booking.
 *
 * There is no Revio branding here on purpose. This is the hotel's booking page, and a platform
 * byline at the bottom of it would tell a guest they are transacting with someone other than the
 * hotel — the exact impression the product exists to remove.
 *
 * The strip under the columns is the legal minimum, and it is the HOTEL's: the entity a guest is
 * contracting with (a distance sale must name the trader, and "Hotel Sofia" is rarely the company
 * that takes the money), the privacy notice, and a way to report illegal content. The report goes
 * to our office address because we host the page (EU Digital Services Act, Art. 16) — it is the one
 * line here that reaches us, and it is worded so it does not read as a byline.
 */
export async function PropertyFooter({ property }: { property: PublicProperty }) {
  const { s } = await serverKit(property);
  const f = s.footer;
  const muted = { color: "hsl(var(--ink-soft))" };
  const mapUrl = property.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.name}, ${property.address}`)}`
    : null;
  return (
    <footer className="border-t" style={{ borderColor: "hsl(var(--line))", backgroundColor: "hsl(var(--surface))" }}>
      <div className="mx-auto grid w-full max-w-[72rem] grid-cols-1 gap-8 px-5 py-10 text-[13px] sm:grid-cols-3 sm:px-8">
        <section>
          <p className="display text-[1.1rem]">{property.name}</p>
          <ul className="mt-3 space-y-2" style={muted}>
            {property.address && (
              <li className="flex items-start gap-2">
                <MapPin size={14} aria-hidden className="mt-0.5 shrink-0" />
                <span>
                  {property.address}
                  {mapUrl && (
                    <>
                      {" · "}
                      <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="link-quiet font-semibold">{f.directions}</a>
                    </>
                  )}
                </span>
              </li>
            )}
            {property.phone && (
              <li className="flex items-center gap-2">
                <Phone size={14} aria-hidden className="shrink-0" />
                <a href={`tel:${property.phone.replace(/\s+/g, "")}`} className="link-quiet">{property.phone}</a>
              </li>
            )}
            {property.contactEmail && (
              <li className="flex items-center gap-2">
                <Mail size={14} aria-hidden className="shrink-0" />
                <a href={`mailto:${property.contactEmail}`} className="link-quiet break-all">{property.contactEmail}</a>
              </li>
            )}
          </ul>
        </section>

        <section>
          <p className="eyebrow">{f.stay}</p>
          <ul className="mt-3 space-y-2" style={muted}>
            <li className="flex items-start gap-2">
              <Clock size={14} aria-hidden className="mt-0.5 shrink-0" />
              {f.times(property.checkInTime, property.checkOutTime)}
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0" />
              <span>{f.allIn} {f.directBenefit}</span>
            </li>
          </ul>
        </section>

        <section>
          <p className="eyebrow">{f.help}</p>
          <ul className="mt-3 space-y-2" style={muted}>
            <li className="flex items-start gap-2">
              <Ticket size={14} aria-hidden className="mt-0.5 shrink-0" />
              <Link href={`/${property.slug}/my-booking`} className="link-quiet font-semibold">{f.myBooking}</Link>
            </li>
            {(property.tags.ga4Id || property.tags.metaPixelId) && (
              <li className="flex items-start gap-2">
                <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0" />
                <ConsentSettingsButton label={s.consent.settings} />
              </li>
            )}
            {property.paymentReady && (
              <li className="flex items-start gap-2">
                <CreditCard size={14} aria-hidden className="mt-0.5 shrink-0" />
                {f.securePay}
              </li>
            )}
          </ul>
        </section>
      </div>
      <div className="border-t" style={{ borderColor: "hsl(var(--line))" }}>
        <p className="mx-auto flex w-full max-w-[72rem] flex-wrap gap-x-3 gap-y-1 px-5 py-4 text-[12px] sm:px-8" style={muted}>
          {property.legal.name && <span>{f.operatedBy(property.legal.name)}</span>}
          {property.legal.vatId && <span>{f.vatId(property.legal.vatId)}</span>}
          {property.legal.address && <span>{property.legal.address}</span>}
          <a
            href={property.privacyUrl}
            className="link-quiet font-semibold"
            {...(property.privacyIsOwn ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {f.privacy}
          </a>
          <a
            href={`mailto:${REVIO_CONTACT.email}?subject=${encodeURIComponent(`${f.report}: ${property.name} (/${property.slug})`)}`}
            className="link-quiet"
          >
            {f.report}
          </a>
        </p>
      </div>
    </footer>
  );
}
