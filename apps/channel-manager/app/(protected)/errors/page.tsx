import { redirect } from "next/navigation";

// V2 IA: the Error Center lives inside the Sync Center now.
export default function Page() {
  redirect("/sync?tab=errors");
}
