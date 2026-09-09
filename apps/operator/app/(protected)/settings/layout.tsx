import type { ReactNode } from "react";

/**
 * Settings is now an area like any other.
 *
 * It used to render its own `SettingsNav` down the left of the page, which meant the console had
 * **two different vertical menus doing one job** — the shell's and this one — sitting side by side
 * on this screen and nowhere else. The shell's `SectionPanel` is that menu now, driven by the same
 * `navigation.ts` as every other area, so there is one of them (`docs/UI-STANDARD.md` rule 3).
 *
 * The three hotel products keep `@revio/ui/settings-nav`: they have one settings screen and no area
 * rail, so for them it is still the right and only pattern. This console outgrew it.
 *
 * Nothing left here but the children — which is the shape a layout should reach when the thing it
 * was wrapping has moved somewhere it belongs.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
