import { Link2 } from "lucide-react";
import { Placeholder } from "@/components/ui/Placeholder";

export default function Page() {
  return (
    <Placeholder
      title="Mapping"
      subtitle="Link your room types and rate plans to each channel's own IDs"
      icon={<Link2 className="h-7 w-7" />}
      points={[
        "Room, rate plan, product, policy and meal-plan mapping",
        "Statuses: complete, incomplete, missing room/rate, error",
        "Self-service — hotels remap after renovations themselves",
        "Seeded: 168 mappings across 4 channels (5 incomplete)",
      ]}
    />
  );
}
