export { prisma } from "./client.js";
export { forTenant, forSystem } from "./rls.js";
export { encryptSecret, decryptSecret, keyHint } from "./crypto.js";
export {
  checkLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
  pruneLoginAttempts,
  type LoginScope,
  type GateResult,
} from "./login-gate.js";
export * from "@prisma/client";
