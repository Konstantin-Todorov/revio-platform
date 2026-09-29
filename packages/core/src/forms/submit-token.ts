/**
 * The form field a create form's one-time token travels in. One name, read by `@revio/db`
 * (`claimSubmitToken`) and written by `@revio/ui` (`SubmitTokenField`) — kept here so the two
 * cannot drift apart into a server that never finds the token it guards on.
 */
export const SUBMIT_TOKEN_FIELD = "_submit";
