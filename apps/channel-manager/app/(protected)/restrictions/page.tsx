import { redirect } from "next/navigation";

// V2 IA: Restrictions merged into Bulk Update — one screen for mass edits + standing rules.
export default function Page() {
  redirect("/bulk-update");
}
