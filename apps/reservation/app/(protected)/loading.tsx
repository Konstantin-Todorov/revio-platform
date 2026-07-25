import { PageSkeleton } from "@revio/ui/skeleton";

/** Route-level fallback while a screen's queries run. Shown in the shell, so the nav stays usable. */
export default function Loading() {
  return <PageSkeleton />;
}
