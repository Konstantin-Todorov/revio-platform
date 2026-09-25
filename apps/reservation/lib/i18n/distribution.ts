import type { Translations } from "@revio/ui/i18n";

/**
 * Distribution — the one connected channel manager, what reaches the channels, and which channels
 * sell the rooms. „канален мениджър“ per the glossary (never the borrowing). Channel names are the
 * channels' own and are not translated; `modes` words core's `connectivityModeLabel` by mode.
 */
export interface DistributionStrings {
  title: string;
  subtitle: (property: string) => string;
  cmTitle: string;
  cmSubtitle: string;
  cmStatus: Record<string, string>;
  internal: string;
  delivered: (pct: number) => string;
  internalLead: string;
  internalBold: string;
  internalTail: string;
  cmLabel: string;
  /** The internal connector's name — core's `displayName` for `reviolink_internal`. */
  internalName: string;
  reviolinkInternal: string;
  otherThirdParty: string;
  onRequest: string;
  reachTitle: string;
  reachSub: string;
  nothingToSetUp: string;
  sells: string;
  sameThings: string;
  inStep: string;
  mappingHint: string;
  channelsTitle: (n: number) => string;
  cols: { channel: string; status: string; mode: string; lastSync: string };
  channelStatus: Record<string, string>;
  modes: Record<string, string>;
  perOta: string;
  fullDetailLead: string;
  syncCenter: string;
  fullDetailTail: string;
  actions: {
    cancel: string;
    working: string;
    reconnect: string;
    reconnectTitle: string;
    reconnectBody: string;
    resume: string;
    resumeLabel: string;
    resumeTitle: string;
    resumeBody: string;
    pause: string;
    pauseTitle: string;
    pauseConfirm: string;
    pauseBody: string;
    disconnect: string;
    disconnectTitle: string;
    disconnectLead: string;
    preserved: string;
    disconnectTail: string;
  };
}

export const distribution: Translations<DistributionStrings> = {
  en: {
    title: "Distribution",
    subtitle: (p) => `${p} · your channel manager handles every OTA connection`,
    cmTitle: "Connected Channel Manager",
    cmSubtitle: "One per property — RevioLink, or a third-party channel manager",
    cmStatus: { connected: "connected", paused: "paused", disconnected: "disconnected" },
    internal: " · internal",
    delivered: (p) => `${p}% delivered · last 24h`,
    internalLead: "This property runs on the platform's own channel manager — the connection is ",
    internalBold: "internal: shared inventory core, no network hop",
    internalTail: ". Every reservation, hold and out-of-order period you create here is already in the numbers RevioLink pushes to the OTAs.",
    cmLabel: "Channel manager:",
    internalName: "RevioLink (this platform)",
    reviolinkInternal: "RevioLink (internal)",
    otherThirdParty: "Other third-party",
    onRequest: "Plugs into the identical ChannelManagerConnector — available on request, never a second code path",
    reachTitle: "What reaches your channels",
    reachSub: "The room types and rate plans your channel manager sends out",
    nothingToSetUp: "Nothing to set up.",
    sells: " RevioLink sells the ",
    sameThings: "same room types and rate plans",
    inStep: " you edit here, so they are already in step.",
    mappingHint: "Matching them to each channel’s own listings is done in RevioLink → Mapping.",
    channelsTitle: (n) => `Channels your rooms are sold on (${n})`,
    cols: { channel: "Channel", status: "Status", mode: "Mode", lastSync: "Last sync" },
    channelStatus: { connected: "connected", pending: "pending", error: "error", disabled: "disabled", not_connected: "not connected" },
    modes: { mock: "Test connection", channex_sandbox: "Channex — test", channex_prod: "Channex" },
    perOta: "Per-OTA configuration (mapping, commissions, re-sync) lives inside the channel manager, never here.",
    fullDetailLead: "Full push/pull detail (logs, errors, re-sync, mapping, pull bookings) lives in ",
    syncCenter: "RevioLink → Sync Center",
    fullDetailTail: " — this screen is the CRS view of the same shared records.",
    actions: {
      cancel: "Cancel",
      working: "Working…",
      reconnect: "Reconnect",
      reconnectTitle: "Reconnect the channel manager?",
      reconnectBody: "Distribution resumes through the preserved CRS↔CM mapping — nothing to re-map.",
      resume: "Resume",
      resumeLabel: "Resume distribution",
      resumeTitle: "Resume distribution?",
      resumeBody: "Pushes resume immediately through the connected channel manager.",
      pause: "Pause",
      pauseTitle: "Pause distribution?",
      pauseConfirm: "Pause distribution",
      pauseBody: "Stops ALL pushes to every channel, reversibly. Rates, availability and mappings stay untouched — resume restores distribution instantly.",
      disconnect: "Disconnect",
      disconnectTitle: "Disconnect the channel manager?",
      disconnectLead: "Stops distribution and marks the connection dormant. The CRS↔CM mapping is ",
      preserved: "preserved",
      disconnectTail: " — reconnecting later never forces a re-map — and reservations already imported are not touched.",
    },
  },
  bg: {
    title: "Дистрибуция",
    subtitle: (p) => `${p} · каналният Ви мениджър поддържа връзките с всички OTA`,
    cmTitle: "Свързан канален мениджър",
    cmSubtitle: "Един за обект — RevioLink или канален мениджър на друга фирма",
    cmStatus: { connected: "свързан", paused: "на пауза", disconnected: "откачен" },
    internal: " · вътрешен",
    delivered: (p) => `${p}% доставени · последните 24 ч`,
    internalLead: "Този обект работи с каналния мениджър на платформата — връзката е ",
    internalBold: "вътрешна: обща база за наличност, без мрежова връзка",
    internalTail: ". Всяка резервация, задържане и период извън експлоатация, които създавате тук, вече са в числата, които RevioLink изпраща към OTA.",
    cmLabel: "Канален мениджър:",
    internalName: "RevioLink (тази платформа)",
    reviolinkInternal: "RevioLink (вътрешен)",
    otherThirdParty: "Друг",
    onRequest: "Включва се през същия ChannelManagerConnector — при заявка, никога като отделна реализация",
    reachTitle: "Какво стига до каналите Ви",
    reachSub: "Типовете стаи и ценовите планове, които каналният мениджър изпраща",
    nothingToSetUp: "Няма нищо за настройване.",
    sells: " RevioLink продава ",
    sameThings: "същите типове стаи и ценови планове",
    inStep: ", които редактирате тук, така че вече съвпадат.",
    mappingHint: "Свързването им с обявите на всеки канал става в RevioLink → Съответствия.",
    channelsTitle: (n) => `Канали, в които се продават стаите Ви (${n})`,
    cols: { channel: "Канал", status: "Статус", mode: "Режим", lastSync: "Последна синхронизация" },
    channelStatus: { connected: "свързан", pending: "изчаква", error: "грешка", disabled: "изключен", not_connected: "не е свързан" },
    modes: { mock: "Тестова връзка", channex_sandbox: "Channex — тест", channex_prod: "Channex" },
    perOta: "Настройките за всяка OTA (съответствия, комисионни, повторна синхронизация) са в каналния мениджър, не тук.",
    fullDetailLead: "Пълните подробности за изпращане и изтегляне (журнал, грешки, повторна синхронизация, съответствия, изтегляне на резервации) са в ",
    syncCenter: "RevioLink → Синхронизация",
    fullDetailTail: " — този екран е изгледът на RevioCRS към същите общи записи.",
    actions: {
      cancel: "Отказ",
      working: "Изпълнява се…",
      reconnect: "Свържи отново",
      reconnectTitle: "Да се свърже ли отново каналният мениджър?",
      reconnectBody: "Дистрибуцията продължава през запазените съответствия между RevioCRS и каналния мениджър — не е нужно нищо да се свързва наново.",
      resume: "Продължи",
      resumeLabel: "Продължи дистрибуцията",
      resumeTitle: "Да продължи ли дистрибуцията?",
      resumeBody: "Изпращането продължава веднага през свързания канален мениджър.",
      pause: "Пауза",
      pauseTitle: "Пауза на дистрибуцията?",
      pauseConfirm: "Спри дистрибуцията",
      pauseBody: "Спира ВСИЧКО изпращане към всеки канал, обратимо. Цените, наличността и съответствията остават непроменени — продължаването възстановява дистрибуцията веднага.",
      disconnect: "Откачи",
      disconnectTitle: "Да се откачи ли каналният мениджър?",
      disconnectLead: "Спира дистрибуцията и маркира връзката като неактивна. Съответствията между RevioCRS и каналния мениджър се ",
      preserved: "запазват",
      disconnectTail: " — повторното свързване никога не изисква ново съпоставяне — и вече внесените резервации не се пипат.",
    },
  },
};
