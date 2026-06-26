import { CreditCard } from "lucide-react";
import { Placeholder } from "@/components/ui/Placeholder";

export default function Page() {
  return (
    <Placeholder
      title="Billing"
      subtitle="Plans, invoices and usage per client"
      icon={<CreditCard className="h-7 w-7" />}
      points={[
        "Plan per client by room-count tier (Starter / Growth / Scale)",
        "Invoices and payment status",
        "Usage (properties, products, channels) feeding the plan",
        "Stripe integration — later phase",
      ]}
    />
  );
}
