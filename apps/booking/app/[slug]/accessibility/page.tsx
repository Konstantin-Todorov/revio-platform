import { notFound } from "next/navigation";
import Link from "next/link";
import { REVIO_CONTACT } from "@revio/core";
import { getPublicProperty } from "@/lib/property";
import { serverKit } from "@/lib/i18n/server";
import { PropertyHeader } from "@/components/PropertyHeader";
import { PropertyFooter } from "@/components/PropertyFooter";

export const dynamic = "force-dynamic";

/** When this statement was last checked against the page. Change it when the page changes. */
const PREPARED = "2026-10-12";

/**
 * The accessibility statement (European Accessibility Act, in force 28 June 2025; WCAG 2.1 AA via
 * EN 301 549).
 *
 * A booking page is a consumer e-commerce service, so a guest is owed a statement of what it does,
 * what is known not to work, and who to tell. It is written from what the code actually does — the
 * measured contrast in `lib/brand.ts`, the keyboard calendar, the two-minute hold warning — and it
 * names its own gaps, because a statement that claims more than the page does is the one thing
 * worse than having none.
 */
export default async function AccessibilityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = await getPublicProperty(slug);
  if (!property) notFound();

  const { s, locale } = await serverKit(property);
  const a = s.a11y;
  const date = new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${PREPARED}T12:00:00Z`));
  const muted = { color: "hsl(var(--ink-soft))" };

  return (
    <>
      <PropertyHeader property={property} />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[42rem] px-5 pb-20 pt-10 sm:px-8">
        <h1 className="display text-[2rem]">{a.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed" style={muted}>{a.intro(property.name)}</p>
        <div className="mt-8 space-y-6 text-[14.5px] leading-relaxed">
          <section>
            <h2 className="text-[15px] font-semibold" style={{ color: "hsl(var(--ink))" }}>{a.standardTitle}</h2>
            <p className="mt-1.5" style={muted}>{a.standardBody}</p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold" style={{ color: "hsl(var(--ink))" }}>{a.doesTitle}</h2>
            <ul className="mt-1.5 list-disc space-y-1 pl-5" style={muted}>
              {a.does.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold" style={{ color: "hsl(var(--ink))" }}>{a.limitsTitle}</h2>
            <ul className="mt-1.5 list-disc space-y-1 pl-5" style={muted}>
              {a.limits.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold" style={{ color: "hsl(var(--ink))" }}>{a.holdTitle}</h2>
            <p className="mt-1.5" style={muted}>{a.holdBody}</p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold" style={{ color: "hsl(var(--ink))" }}>{a.contactTitle}</h2>
            <p className="mt-1.5" style={muted}>{a.contactBody(property.contactEmail ?? property.name, REVIO_CONTACT.email)}</p>
          </section>
          <p className="text-[13px]" style={muted}>{a.checked(date)}</p>
        </div>
        <Link href={`/${property.slug}`} className="link-quiet mt-10 inline-block text-[14px] font-semibold">
          {s.privacyNotice.back}
        </Link>
      </main>
      <PropertyFooter property={property} />
    </>
  );
}
