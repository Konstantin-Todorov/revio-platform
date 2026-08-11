/** @revio/core — the shared inventory source of truth. Imported by every app. */

export * from "./domain/types.js";
export * from "./domain/connectivity.js";
export * from "./inventory/availability.js";
export * from "./inventory/waterfall.js";
export * from "./metrics/formulas.js";
export * from "./metrics/channel-economics.js";
export * from "./guests/recognition.js";
export * from "./rates/derive.js";
export * from "./rates/occupancy.js";
export * from "./restrictions/resolve.js";
export * from "./restrictions/capabilities.js";
export * from "./restrictions/advance-purchase.js";
export * from "./adapters/channel-adapter.js";
export * from "./adapters/cm-connector.js";
export * from "./adapters/mock-channel-adapter.js";
export * from "./email/templates.js";
export * from "./onboarding/setup.js";
export * from "./pricing/fees.js";
export * from "./pricing/extras.js";
export * from "./booking/presets.js";
export * from "./rooms/amenities.js";
export * from "./branding/logo.js";
