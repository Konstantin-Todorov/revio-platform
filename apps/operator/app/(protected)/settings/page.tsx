import { Settings } from "lucide-react";
import { Placeholder } from "@/components/ui/Placeholder";

export default function Page() {
  return (
    <Placeholder
      title="Settings"
      subtitle="Operator team, roles and platform configuration"
      icon={<Settings className="h-7 w-7" />}
      points={[
        "Operator staff and roles (super-admin, support)",
        "Platform-wide defaults",
        "Audit of operator actions",
        "API keys for the platform",
      ]}
    />
  );
}
