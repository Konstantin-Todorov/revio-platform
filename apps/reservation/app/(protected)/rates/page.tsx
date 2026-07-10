import { redirect } from "next/navigation";

/** Dissolved (spec §2): products → Rooms & Rates · standing defaults → Settings ·
 * restriction rules → Bulk Rates & Availability. */
export default function Page() {
  redirect("/rooms-rates");
}
