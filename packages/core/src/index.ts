/** @revio/core — the shared inventory source of truth. Imported by every app. */

export * from "./domain/types.js";
export * from "./inventory/availability.js";
export * from "./rates/derive.js";
export * from "./rates/occupancy.js";
export * from "./restrictions/resolve.js";
export * from "./restrictions/advance-purchase.js";
export * from "./adapters/channel-adapter.js";
export * from "./adapters/mock-channel-adapter.js";
