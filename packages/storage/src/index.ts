/**
 * @revio/storage — object storage for user-uploaded media.
 *
 * Two apps need this and an app may never import another app's internals (root CLAUDE.md): RevioCRS
 * writes room photos, and RevioDirect reads them. The S3 driver is loaded lazily by `getObjectStore`
 * so a deployment running on local disk never pulls the AWS SDK into its bundle.
 */
export * from "./store.js";
export * from "./keys.js";
