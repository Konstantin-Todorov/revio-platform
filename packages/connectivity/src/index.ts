export {
  ChannexChannelAdapter,
  CHANNEX_STAGING_URL,
  type ChannexConfig,
} from "./channex-channel-adapter.js";
export {
  createChannelAdapter,
  type AdapterMode,
  type AdapterSelection,
} from "./factory.js";
export {
  toRestrictionValue,
  toAvailabilityValue,
  toRawReservation,
  unsupportedReason,
  type ChannexRestrictionValue,
  type ChannexAvailabilityValue,
  type ChannexBooking,
} from "./channex-mappers.js";
export {
  syncChannel,
  syncRealChannels,
  listChannelProducts,
  pauseChannel,
  resumeChannel,
  disconnectChannel,
  reconnectChannel,
  pullChannel,
  stayScope,
  type SyncOutcome,
  type PullOutcome,
  type PushScope,
  type PushField,
  type ScopedStay,
} from "./sync.js";

export {
  CERT_TESTS,
  verifyTest,
  rowDays,
  type WireRow,
  type TestSpec,
  type Expectation,
  type Verdict,
} from "./cert-expectations.js";
export { indexRateMappings, resolveExternalRateId, unmappedPairs, type RatePlanMappingRow, type RateMappingIndex } from "./rate-mapping.js";
export {
  CHANNEL_CODES, parseAdapter, toField, visibleFields, visibleFieldsFor, defaultSettings, missingRequired,
  type ChannelAdapterDescriptor, type ChannelField, type ChannelFieldType, type FieldRule,
} from "./channex-channels.js";
export {
  channexApiConfig, fetchChannelAdapter, testChannelConnection, createChannexChannel, activateChannexChannel,
  type ChannexApiConfig, type ConnectionTest,
} from "./channex-channel-api.js";
