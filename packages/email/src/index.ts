/**
 * @revio/email — every guest-facing email the platform sends.
 *
 * Templates and rendering are pure and live in @revio/core; this package is the side-effecting half:
 * resolve a property's saved wording and branding, render, and hand the result to a transport that
 * is Resend when configured and a log line when it is not.
 */
export * from "./transport.js";
export * from "./engine.js";
