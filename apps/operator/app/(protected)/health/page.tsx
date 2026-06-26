import { Activity } from "lucide-react";
import { Placeholder } from "@/components/ui/Placeholder";

export default function Page() {
  return (
    <Placeholder
      title="Platform Health"
      subtitle="Cross-tenant sync health, queue depth and error volumes"
      icon={<Activity className="h-7 w-7" />}
      points={[
        "Sync success/failure rates across all hotels",
        "Queue depth and retry backlog (Redis/BullMQ)",
        "Error volume trends by channel",
        "Per-tenant health already on the Overview screen",
      ]}
    />
  );
}
