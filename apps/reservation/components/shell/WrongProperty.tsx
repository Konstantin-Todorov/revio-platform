import { redirect } from "next/navigation";
import { WrongPropertyPage } from "@revio/ui/wrong-property";
import { setActiveProperty } from "@/lib/actions-session";
import { i18n } from "@/lib/i18n/server";
import { wrongProperty } from "@/lib/i18n/wrong-property";

/** RevioCRS's side of `WrongPropertyPage`: a booking or a guest at the account's other hotel. */
export async function WrongProperty({
  kind, href, name, propertyId, propertyName,
}: {
  kind: "booking" | "guest";
  href: string;
  name: string;
  propertyId: string;
  propertyName: string;
}) {
  async function switchAndOpen() {
    "use server";
    await setActiveProperty(propertyId);
    redirect(href);
  }
  const t = (await i18n()).t(wrongProperty);
  return (
    <WrongPropertyPage
      title={t.title(name || t.thatRecord, propertyName)}
      body={t.body(t.things[kind])}
      switchLabel={t.switchTo(propertyName)}
      stayLabel={t.stay}
      stayHref="/dashboard"
      switchAction={switchAndOpen}
    />
  );
}
