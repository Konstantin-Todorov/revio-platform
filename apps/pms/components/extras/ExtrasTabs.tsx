import Link from "next/link";
import { BookOpen, DoorOpen } from "lucide-react";

/**
 * The two jobs of Extras & Charges, side by side at the top of both screens: charge a guest, and
 * keep the list of what can be charged.
 *
 * The catalog used to be a small "Catalog" button in the corner of the charge screen — the founder
 * could not find it. A tab is the shape everybody already knows for "the other half of this page",
 * and it says how many items there are before anybody clicks.
 */
export function ExtrasTabs({ active, t, catalogCount }: {
  active: "post" | "catalog";
  t: { post: string; catalog: string };
  catalogCount: number;
}) {
  const tab = (id: "post" | "catalog", href: string, label: string, Icon: typeof DoorOpen, count?: number) => (
    <Link
      href={href}
      aria-current={active === id ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors ${
        active === id ? "border-accent-600 text-accent-700" : "border-transparent text-ink-500 hover:text-ink-700"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
      {count !== undefined && <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10.5px] font-bold text-ink-500">{count}</span>}
    </Link>
  );
  return (
    <div className="mb-4 flex items-center gap-1 border-b border-surface-border">
      {tab("post", "/minibar", t.post, DoorOpen)}
      {tab("catalog", "/minibar/catalog", t.catalog, BookOpen, catalogCount)}
    </div>
  );
}
