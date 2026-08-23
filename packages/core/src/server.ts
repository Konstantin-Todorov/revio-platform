/**
 * Server-only exports.
 *
 * `@revio/core` is imported by `@revio/ui`, which is browser code. Anything reaching for a Node
 * built-in therefore cannot live in the main barrel: re-exporting TOTP from `index.ts` immediately
 * broke `packages/ui`'s typecheck with "Cannot find module 'node:crypto'", and a bundler would have
 * made the same complaint at build time in a client component.
 *
 * So the rule is the import path. `@revio/core` stays safe to import anywhere; `@revio/core/server`
 * says out loud that it runs on a server, and the compiler enforces it rather than a convention
 * everyone has to remember.
 */
export * from "./auth/totp.js";
