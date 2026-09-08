import { redirect } from "next/navigation";
import { SETTINGS_SECTIONS } from "./sections";

/**
 * `/settings` is the entrance to four sections rather than a page of its own.
 *
 * Every inbound link, bookmark and support answer that pointed at `/settings` still works and lands
 * on the first section.
 */
export default function SettingsIndex() {
  redirect(SETTINGS_SECTIONS[0]!.href);
}
