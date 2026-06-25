import { SlidersHorizontal } from "lucide-react";
import { Placeholder } from "@/components/ui/Placeholder";

export default function Page() {
  return (
    <Placeholder
      title="Bulk Update"
      subtitle="Change rates, availability and restrictions across many dates, rooms and channels at once"
      icon={<SlidersHorizontal className="h-7 w-7" />}
      points={[
        "Date range, days of week, room types, rate plans, channels",
        "Set exact price, ±amount, ±%, copy from another plan, rounding",
        "Availability, Min/Max LOS, CTA, CTD, Stop Sell, Advance Purchase",
        "Preview before apply — writes through @revio/core",
      ]}
    />
  );
}
