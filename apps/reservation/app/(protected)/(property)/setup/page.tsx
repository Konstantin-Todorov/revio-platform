import { redirect } from "next/navigation";

/** Merged into Rooms & Rates (spec §2) — physical counts + OOO/closure periods live there now. */
export default function Page() {
  redirect("/rooms-rates");
}
