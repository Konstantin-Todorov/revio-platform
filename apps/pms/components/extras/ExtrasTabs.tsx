import { BookOpen, DoorOpen } from "lucide-react";
import { LinkTabs } from "@revio/ui/link-tabs";

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
  return (
    <div className="mb-4">
      <LinkTabs
        label={`${t.post} · ${t.catalog}`}
        tabs={[
          { href: "/minibar", label: t.post, active: active === "post", icon: <DoorOpen className="h-4 w-4" /> },
          { href: "/minibar/catalog", label: t.catalog, active: active === "catalog", icon: <BookOpen className="h-4 w-4" />, badge: String(catalogCount) },
        ]}
      />
    </div>
  );
}
