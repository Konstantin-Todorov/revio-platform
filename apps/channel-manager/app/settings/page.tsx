import { Settings } from "lucide-react";
import { Placeholder } from "@/components/ui/Placeholder";

export default function Page() {
  return (
    <Placeholder
      title="Settings"
      subtitle="Property, currency, users & permissions, API / PMS connection"
      icon={<Settings className="h-7 w-7" />}
      points={[
        "Property: timezone, base currency, sync horizon, check-in/out",
        "Currency: default conversion & rounding rules",
        "Users & roles: Owner, Admin, Revenue/Distribution Manager, Read-only",
        "API / PMS connection: credentials, webhooks (placeholder in V1)",
      ]}
    />
  );
}
