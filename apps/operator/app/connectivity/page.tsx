import { KeyRound } from "lucide-react";
import { Placeholder } from "@/components/ui/Placeholder";

export default function Page() {
  return (
    <Placeholder
      title="Connectivity"
      subtitle="OTA / Channex credentials and certification status — operator-only"
      icon={<KeyRound className="h-7 w-7" />}
      points={[
        "Encrypted OTA tokens, never exposed to hotels",
        "Channex vs direct-OTA adapter status per channel",
        "Certification progress (Booking, Expedia, …)",
        "Today the platform runs on the MockChannelAdapter",
      ]}
    />
  );
}
