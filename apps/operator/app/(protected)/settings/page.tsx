import { redirect } from "next/navigation";
import { OPERATOR_AREAS } from "@/components/shell/navigation";

/**
 * `/settings` is the entrance to four sections rather than a page of its own.
 *
 * The destination is read from `navigation.ts` rather than kept here, so the redirect and the menu
 * cannot point at different first sections — which is exactly what a second copy of a list is for.
 */
export default function SettingsIndex() {
  const settings = OPERATOR_AREAS.find((a) => a.key === "settings");
  redirect(settings?.sections[0]?.href ?? "/settings/account");
}
