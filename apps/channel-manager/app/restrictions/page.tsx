import { Ban } from "lucide-react";
import { Placeholder } from "@/components/ui/Placeholder";

export default function Page() {
  return (
    <Placeholder
      title="Restrictions"
      subtitle="Restriction rules, quick Stop Sell and quick Advance Purchase"
      icon={<Ban className="h-7 w-7" />}
      points={[
        "Rules across a date range + channels in one action",
        "Stop Sell, Min/Max LOS, CTA, CTD, Advance Purchase, Allotment",
        "Priority: manual edit > rule > rate-plan default (in @revio/core)",
        "Seeded: Easter Min LOS, Summer CTA, Long-Stay Min LOS",
      ]}
    />
  );
}
