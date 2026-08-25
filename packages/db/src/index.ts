export { prisma } from "./client.js";
export {
  forTenant,
  forSystem,
  withTenantTransaction,
  withSystemTransaction,
  type TenantTx,
  type TxOptions,
} from "./rls.js";
export { encryptSecret, decryptSecret, keyHint, hasPreviousKey } from "./crypto.js";
export { markBillable, isBillablePeriod, type BillableReason } from "./billing-start.js";
export { checkHealth, type HealthResult, type HealthState } from "./health.js";
export {
  recordAppError, listAppErrors, countOpenAppErrors, resolveAppError, pruneAppErrors,
  errorSignature, type AppErrorRow, type ServiceName,
} from "./app-errors.js";
export {
  checkLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
  pruneLoginAttempts,
  type LoginScope,
  type GateResult,
} from "./login-gate.js";
export {
  requestPasswordReset,
  inviteStaff,
  completePasswordSet,
  type AuthScope,
  type SendableEmail,
  type SetPasswordResult,
} from "./auth-flows.js";
export {
  issueToken,
  resolveToken,
  consumeToken,
  revokeTokensFor,
  pruneAuthTokens,
  hashToken,
  type ResolvedToken,
  type TokenResolution,
} from "./auth-tokens.js";
export { getWelcomeFacts, otherProducts } from "./welcome-facts.js";
export {
  recordAuthEvent,
  requestOrigin,
  deviceLabel,
  isNewOrigin,
  signInDetail,
  listAuthEvents,
  listAuthEventsForTenant,
  pruneAuthEvents,
  AUTH_EVENT,
  AUTH_EVENT_RETENTION_DAYS,
  type AuthEventType,
  type AuthEventScope,
  type AuthEventRow,
} from "./auth-events.js";
export {
  beginTotpEnrolment,
  confirmTotpEnrolment,
  verifySecondFactor,
  disableTotp,
  requiresSecondFactor,
  type EnrolmentOffer,
  type ConfirmResult,
  type SecondFactorResult,
} from "./operator-2fa.js";
export {
  acquireJobLease,
  releaseJobLease,
  withJobLease,
  JOB,
  type LeaseResult,
} from "./job-lease.js";
export {
  claimHold,
  nightsBetween,
  type ClaimHoldInput,
  type ClaimResult,
  type SellableByNight,
} from "./inventory-claim.js";
export * from "@prisma/client";
