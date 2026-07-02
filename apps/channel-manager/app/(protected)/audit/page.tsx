import { redirect } from "next/navigation";

// V2 IA: the Audit Log lives inside the Sync Center now.
export default function Page() {
  redirect("/sync?tab=audit");
}
