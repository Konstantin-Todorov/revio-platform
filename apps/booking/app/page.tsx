import { notFound } from "next/navigation";

/**
 * The bare origin is not a product — every real page is a hotel's own. Nothing here should hint at
 * the platform or list its clients, so it behaves exactly like an unknown slug.
 */
export default function Root() {
  notFound();
}
