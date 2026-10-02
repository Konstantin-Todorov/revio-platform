import { notFound } from "next/navigation";
import { Ticket } from "lucide-react";
import { getPublicProperty } from "@/lib/property";
import { serverKit } from "@/lib/i18n/server";
import { PropertyHeader } from "@/components/PropertyHeader";
import { PropertyFooter } from "@/components/PropertyFooter";
import { FindBooking } from "@/components/ManageBooking";

export const dynamic = "force-dynamic";

/**
 * "My booking" — where a guest who lost the email (or is on another device) gets back to their
 * booking. Reference + email, and the private link goes to that inbox: the same answer whether or
 * not they matched, so the form cannot be used to learn who has booked the hotel.
 */
export default async function MyBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = await getPublicProperty(slug);
  if (!property) notFound();
  const { s } = await serverKit(property);
  return (
    <>
      <PropertyHeader property={property} />
      <main className="mx-auto w-full max-w-[34rem] px-5 pb-20 pt-10 sm:px-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "hsl(var(--brand-wash))", color: "hsl(var(--brand-text))" }}>
          <Ticket size={22} aria-hidden />
        </span>
        <h1 className="display mt-4 text-[2rem]">{s.myBooking.title}</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>{s.myBooking.body}</p>
        <FindBooking slug={property.slug} />
      </main>
      <PropertyFooter property={property} />
    </>
  );
}
