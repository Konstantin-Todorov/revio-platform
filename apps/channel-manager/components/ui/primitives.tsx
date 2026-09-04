/**
 * Re-export shim. These four primitives now live in `@revio/ui/primitives`.
 *
 * They were four near-identical copies — three byte-identical, and this app's only differing by a
 * missing optional prop. Kept as a shim rather than deleted so the ~75 existing `components/ui/
 * primitives` imports across the apps did not all have to move in one commit; import from
 * `@revio/ui/primitives` directly in new code.
 */
export { StatusPill, Card, CardHeader, PageHeader } from "@revio/ui/primitives";
export type { Tone, Surface } from "@revio/ui/primitives";
