import {
  Activity, BarChart3, Building2, CreditCard, LayoutDashboard, LifeBuoy, Settings,
} from "lucide-react";

/**
 * The operator console's information architecture, in one place.
 *
 * ## Why this exists, and what two failed attempts taught
 *
 * The console grew to fourteen flat sidebar links and the founder called it chaotic. He was right:
 * fourteen peers is not a menu, it is an inventory, and nothing about it says which screens belong
 * to the same job.
 *
 * **Attempt 1** put headings above groups of the same fourteen links. Rejected — *"it still reads as
 * one long, amateur list."* Correct: a heading over a list is still a list, and the sidebar was
 * still asking somebody to read fourteen things to find one.
 *
 * **Attempt 2** was rejected as off-design and reverted. *"It did not make it with our design and it
 * was bad."*
 *
 * So the rule this file follows: **the sidebar shows AREAS, never screens.** Seven of them, each a
 * genuinely different question somebody arrives with. Choosing one reveals its screens as a tab row,
 * using the exact underline tabs already shipped on `/clients/[id]` — the pattern the founder said he
 * liked. Nothing is invented; an existing pattern is applied one level up.
 *
 * ## The grouping, and why each area is one question
 *
 * | Area | The question | Screens |
 * | --- | --- | --- |
 * | Overview | *how are we doing this morning?* | one |
 * | Clients | *who buys, and who might?* | a lead is the stage before a client — same sitting |
 * | Support | *what have they asked?* | one |
 * | Revenue | *what do we charge, and what did we invoice?* | the price list is the decision, invoices the consequence — so Plans stays first |
 * | Operations | *is the machinery running?* | health, faults, sign-ins, and the connections underneath |
 * | Product | *what did we build, and what do they use?* | |
 * | Settings | *who are we?* | one, and it keeps its own vertical navigation |
 *
 * ⚠️ **The auth log is in Operations, not Settings, and that is deliberate.** The founder's rule was
 * *"it is read when something has gone wrong, and a screen you have to remember lives inside another
 * one is a screen nobody finds in a hurry."* Operations is precisely where somebody goes when
 * something has gone wrong, so this honours the rule rather than working around it — nesting it in
 * Settings would put it behind the one area nobody opens in a hurry.
 *
 * ⚠️ **No route changes, ever, from this file.** Every href below already existed. This is
 * presentation: no action, data fetch or `revalidatePath` call moves, which is what makes a
 * navigation change safe to ship.
 */

export interface OperatorScreen {
  href: string;
  label: string;
}

export interface OperatorArea {
  key: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** The screens inside. One screen means no tab row is drawn — a single tab is furniture. */
  screens: OperatorScreen[];
}

export const OPERATOR_AREAS: OperatorArea[] = [
  {
    key: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    screens: [{ href: "/overview", label: "Overview" }],
  },
  {
    key: "clients",
    label: "Clients",
    icon: Building2,
    screens: [
      { href: "/clients", label: "Clients" },
      // A demo request is the stage before a client, and the two get looked at in the same sitting.
      { href: "/leads", label: "Demo requests" },
    ],
  },
  {
    key: "support",
    label: "Support",
    icon: LifeBuoy,
    screens: [{ href: "/support", label: "Support" }],
  },
  {
    key: "revenue",
    label: "Revenue",
    icon: CreditCard,
    screens: [
      // Plans above Billing: the price list is the decision, the invoices are its consequence.
      { href: "/plans", label: "Plans & pricing" },
      { href: "/billing", label: "Billing" },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    icon: Activity,
    screens: [
      { href: "/health", label: "Platform health" },
      { href: "/errors", label: "Error log" },
      { href: "/auth-log", label: "Auth log" },
      // Integrations above Connectivity: this is every service we depend on, while Connectivity is
      // the one hotel-by-hotel exception inside it.
      { href: "/integrations", label: "Integrations" },
      { href: "/connectivity", label: "Connectivity" },
    ],
  },
  {
    key: "product",
    label: "Product",
    icon: BarChart3,
    screens: [
      { href: "/analytics", label: "Product analytics" },
      { href: "/platform-history", label: "Platform history" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    // One screen on purpose: Settings already has its own vertical section list, and a tab row above
    // a section list is two navigations for one place.
    screens: [{ href: "/settings", label: "Settings" }],
  },
];

/** Does this path belong to this screen — the screen itself, or anything beneath it? */
function matches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Which area a path belongs to, or null for a route that lives outside the menu.
 *
 * Longest href wins, so a future `/clients/archive` screen would beat `/clients` rather than
 * depending on declaration order. `/search` and `/invoice/[id]` deliberately match nothing: they are
 * reached from the topbar and from a link, and highlighting an unrelated area while you read an
 * invoice would be worse than highlighting none.
 */
export function areaForPath(pathname: string): OperatorArea | null {
  let best: { area: OperatorArea; length: number } | null = null;
  for (const area of OPERATOR_AREAS) {
    for (const screen of area.screens) {
      if (matches(pathname, screen.href) && (!best || screen.href.length > best.length)) {
        best = { area, length: screen.href.length };
      }
    }
  }
  return best?.area ?? null;
}

/**
 * The tab row for a path — empty when there should not be one.
 *
 * Two cases return nothing, and both are deliberate:
 *
 * - **an area with one screen**, because a solitary tab is furniture that says nothing;
 * - **a detail page** (`/clients/abc`, `/integrations/stripe`), because you have drilled in and those
 *   pages carry their own navigation. `/clients/abc` already has its own tab row, and stacking two
 *   rows of tabs is exactly the "amateur list" problem again, one level down.
 */
export function tabsForPath(pathname: string): OperatorScreen[] {
  const area = areaForPath(pathname);
  if (!area || area.screens.length < 2) return [];
  const onScreenItself = area.screens.some((s) => s.href === pathname);
  return onScreenItself ? area.screens : [];
}
