import { redirect } from "next/navigation";
import { SETTINGS_SECTIONS } from "./sections";

/**
 * `/settings` is not a page any more — it is the entrance to five.
 *
 * A redirect rather than a landing screen: a menu whose only content is the menu beside it wastes a
 * click and a screen. Every inbound link, bookmark and support answer that pointed at `/settings`
 * still works and lands on the first section.
 */
export default function SettingsIndex() {
  redirect(SETTINGS_SECTIONS[0]!.href);
}
