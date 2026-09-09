import {
  Activity, BarChart3, Building2, CreditCard, LayoutDashboard, LifeBuoy, Settings,
} from "lucide-react";

/**
 * The operator console's information architecture — three levels, and each one has a job.
 *
 * ```
 *  ┌────┬──────────────┬─────────────────────────────────┐
 *  │ ▣  │ Operations   │  Integrations                   │
 *  │ ◉  │              │  ┌──────────┬────────────────┐  │
 *  │ ◈  │  Health      │  │ Details  │ Subscription   │  │  ← level 3, inside a page
 *  │ ◐  │  Errors      │  └──────────┴────────────────┘  │
 *  │ ◑  │ ▸Integrations│                                 │
 *  │ ◒  │  Connectivity│  …                              │
 *  └────┴──────────────┴─────────────────────────────────┘
 *    ↑        ↑
 *  areas   sections
 * ```
 *
 * **Level 1 — areas, as icons.** Six or seven of them, each a different question somebody arrives
 * with. Icons only, so the rail stays narrow and the eye has almost nothing to read.
 *
 * **Level 2 — sections, as a VERTICAL list.** The founder's instruction, and it is the shape
 * Settings has always had here: *"first a vertical menu, and then if needed, add horizontal inside
 * one of them."* An area with a single screen shows no panel at all — a list of one is furniture.
 *
 * **Level 3 — horizontal tabs, inside a page**, for several views of ONE thing: the three tabs on a
 * client, the modes on the Stripe screen. Those live in the pages that own them and are not
 * described here, because they are part of that screen rather than part of the menu.
 *
 * ## Why the shape changed twice before this
 *
 * Fourteen flat links were called chaotic, correctly. Headings over the same fourteen links were
 * rejected — *"it still reads as one long, amateur list."* A rebuild was reverted as off-design.
 * Then areas with horizontal tabs, which worked but put the menu in two directions at once.
 *
 * The founder's own reference is the pattern above, and the reason it wins is that **the vertical
 * list is the one that scales**: Operations has five sections and Settings four, and neither reads
 * as a row of tabs competing with the page's own. Horizontal is reserved for what it is genuinely
 * good at — a few views of a single record.
 *
 * ⚠️ **No route ever changes from this file.** Every href below already existed. Presentation only:
 * no action, data fetch or `revalidatePath` moves, which is what makes a navigation change safe.
 */

export interface OperatorSection {
  href: string;
  label: string;
  /** One line under the label, where the name alone does not say what the screen is for. */
  blurb?: string;
}

export interface OperatorArea {
  key: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Where the rail icon goes. For an area with sections, its first section. */
  href: string;
  /** The vertical list. Empty means this area is a single screen and shows no panel. */
  sections: OperatorSection[];
  /**
   * Paths that belong to this area without being sections of it — `/settings` redirecting to its
   * first section, `/clients/abc` under Clients. Without these the rail goes dark exactly when
   * somebody has drilled in, which is when they most need to know where they are.
   */
  extraPaths?: string[];
}

export const OPERATOR_AREAS: OperatorArea[] = [
  {
    key: "home",
    label: "Overview",
    icon: LayoutDashboard,
    href: "/overview",
    sections: [],
  },
  {
    key: "clients",
    label: "Clients",
    icon: Building2,
    href: "/clients",
    sections: [
      { href: "/clients", label: "Clients", blurb: "Every hotel, what they pay and what needs a call" },
      // A demo request is the stage before a client, and the two get looked at in the same sitting.
      { href: "/leads", label: "Demo requests", blurb: "Prospects from the website, and who has not been answered" },
    ],
  },
  {
    key: "support",
    label: "Support",
    icon: LifeBuoy,
    href: "/support",
    // Its own area rather than a section under Clients: it is opened many times a day, and burying
    // a queue one level down adds a click to every one of them.
    sections: [],
  },
  {
    key: "revenue",
    label: "Revenue",
    icon: CreditCard,
    href: "/plans",
    sections: [
      // Plans first: the price list is the decision, the invoices are its consequence.
      { href: "/plans", label: "Plans & pricing", blurb: "What everything costs, computed by the code that invoices it" },
      { href: "/billing", label: "Billing", blurb: "Invoices, payment links and what is still outstanding" },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    icon: Activity,
    href: "/health",
    sections: [
      { href: "/health", label: "Platform health", blurb: "Sync, jobs and errors across every hotel" },
      { href: "/errors", label: "Error log", blurb: "Application faults, grouped rather than one row per occurrence" },
      // Here rather than in Settings. The founder's rule was that it is read when something has gone
      // wrong and must not be buried — and this is the area you open when something has gone wrong.
      { href: "/auth-log", label: "Auth log", blurb: "Sign-ins, failures and attempts against no account" },
      { href: "/integrations", label: "Integrations", blurb: "Stripe, email and everything else Revio connects to" },
      { href: "/connectivity", label: "Connectivity", blurb: "Channex keys, and the hotels that bring their own" },
    ],
  },
  {
    key: "product",
    label: "Product",
    icon: BarChart3,
    href: "/analytics",
    sections: [
      { href: "/analytics", label: "Product analytics", blurb: "What people actually open, and who has gone quiet" },
      { href: "/platform-history", label: "Platform history", blurb: "What we built, and what is next" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    href: "/settings/account",
    /*
     * Settings is now an area like any other, and its four sections are the SAME level-2 panel as
     * everything else.
     *
     * It used to render its own vertical nav inside the page, which meant the console had two
     * different vertical menus doing one job — the exact "one component per concept" rule this
     * codebase keeps (`docs/UI-STANDARD.md` rule 3). Unifying them is the tidy-up, not a side effect.
     */
    sections: [
      { href: "/settings/account", label: "Your account", blurb: "Who you are here, your second factor and your sessions" },
      { href: "/settings/company", label: "Company details", blurb: "Who we are on every invoice, and which VAT registration we hold" },
      { href: "/settings/staff", label: "Operator staff", blurb: "The people with access to every hotel on the platform" },
      { href: "/settings/platform", label: "Platform", blurb: "How the platform is put together" },
    ],
    extraPaths: ["/settings"],
  },
];

/** Segment-aware, so `/clients` never claims `/clients-archive`. */
function matches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Which area a path belongs to, or null for a route outside the menu.
 *
 * Longest match wins, so ordering in the array is never load-bearing. `/search` and `/invoice/[id]`
 * deliberately match nothing: they are reached from the topbar and from links, and lighting up an
 * unrelated area while somebody reads an invoice is worse than lighting up none.
 */
export function areaForPath(pathname: string): OperatorArea | null {
  /*
   * Every path an area answers to, flattened first, then the longest match wins.
   *
   * Written as a plain loop rather than a closure that assigns to an outer variable: TypeScript
   * cannot narrow a `let` written inside a callback, and the version that did compiled to `never`
   * at the return. Straight-line code is also simply easier to read here.
   */
  const candidates: { area: OperatorArea; href: string }[] = OPERATOR_AREAS.flatMap((area) =>
    [area.href, ...area.sections.map((s) => s.href), ...(area.extraPaths ?? [])].map((href) => ({ area, href })),
  );

  let best: { area: OperatorArea; href: string } | null = null;
  for (const c of candidates) {
    if (!matches(pathname, c.href)) continue;
    if (best === null || c.href.length > best.href.length) best = c;
  }
  return best === null ? null : best.area;
}

/**
 * The vertical list for a path — empty when there should be no panel at all.
 *
 * An area with one screen gets none: a list of one item is furniture that takes a column of the
 * window to say nothing. That is why Overview and Support open full width.
 */
export function sectionsForPath(pathname: string): OperatorSection[] {
  const area = areaForPath(pathname);
  return area && area.sections.length >= 2 ? area.sections : [];
}

/** Which section is open, for the panel's highlight. Detail pages keep their parent lit. */
export function activeSection(pathname: string, sections: OperatorSection[]): string | null {
  let best: { href: string; length: number } | null = null;
  for (const s of sections) {
    if (matches(pathname, s.href) && (!best || s.href.length > best.length)) best = { href: s.href, length: s.href.length };
  }
  return best?.href ?? null;
}
