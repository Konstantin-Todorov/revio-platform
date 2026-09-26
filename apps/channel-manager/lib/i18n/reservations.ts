import type { Translations } from "@revio/ui/i18n";

/**
 * RevioLink's Reservations (the channel-bookings monitor) and Search. Statuses are the same words
 * RevioCRS uses for the same stored codes (`reservation/lib/i18n/common.ts`), so one booking reads
 * the same in both products.
 */
export interface CmReservationsStrings {
  title: string;
  subIntegrated: string;
  subStandalone: string;
  searchPlaceholder: string;
  allChannels: string;
  allStatuses: string;
  statuses: Record<string, string>;
  dateTypes: Record<"check_in" | "check_out" | "created" | "cancelled" | "stay", string>;
  from: string;
  filter: string;
  clear: string;
  results: (n: number) => string;
  cols: { channel: string; reservation: string; guest: string; roomRate: string; checkIn: string; checkOut: string; status: string; ack: string; total: string; imported: string };
  noMatch: string;
  none: string;
  direct: string;
  acked: string;
  received: string;
  cancel: string;
  search: {
    title: string;
    resultsFor: (q: string) => string;
    subtitle: string;
    prompt: string;
    nothing: (q: string) => string;
    roomTypes: string;
    ratePlans: string;
    channels: string;
    reservations: string;
  };
  channelStatus: Record<string, string>;
}

export const reservations: Translations<CmReservationsStrings> = {
  en: {
    title: "Reservations",
    subIntegrated: "Channel-bookings monitor — did each booking land and was it acknowledged? The canonical reservation list lives in RevioCRS.",
    subStandalone: "Your reservations — channel bookings land here (standalone mode, no CRS connected); cancel to restore availability",
    searchPlaceholder: "Guest, or booking #s (comma-separated)",
    allChannels: "All channels",
    allStatuses: "All statuses",
    statuses: { confirmed: "confirmed", modified: "modified", cancelled: "cancelled", failed_import: "failed import", overbooked: "overbooked", no_show: "no-show", hold: "hold" },
    dateTypes: { check_in: "Check-in", check_out: "Check-out", created: "Reservation made on", cancelled: "Cancellation date", stay: "Staying on (in-house)" },
    from: "from",
    filter: "Filter",
    clear: "Clear",
    results: (n) => `${n} result${n === 1 ? "" : "s"}`,
    cols: { channel: "Channel", reservation: "Reservation", guest: "Guest", roomRate: "Room · Rate", checkIn: "Check-in", checkOut: "Check-out", status: "Status", ack: "Ack", total: "Total", imported: "Imported" },
    noMatch: "No bookings match these filters.",
    none: "No channel bookings yet. They land here automatically as soon as a connected channel sells a room.",
    direct: "Direct",
    acked: "acked",
    received: "received",
    cancel: "Cancel",
    search: {
      title: "Search",
      resultsFor: (q) => `Results for “${q}”`,
      subtitle: "Search rooms, rates, channels and reservations",
      prompt: "Type in the search bar above to find a room type, rate plan, channel, or reservation.",
      nothing: (q) => `Nothing found for “${q}”.`,
      roomTypes: "Room types",
      ratePlans: "Rate plans",
      channels: "Channels",
      reservations: "Reservations",
    },
    channelStatus: { connected: "connected", pending: "pending", error: "error", disabled: "disabled", paused: "paused", disconnected: "disconnected", not_connected: "not connected" },
  },
  bg: {
    title: "Резервации",
    subIntegrated: "Проследяване на резервациите от каналите — пристигна ли всяка и потвърдена ли е? Основният списък с резервации е в RevioCRS.",
    subStandalone: "Вашите резервации — резервациите от каналите пристигат тук (самостоятелен режим, без свързан RevioCRS); анулирането възстановява наличността",
    searchPlaceholder: "Гост или номера на резервации (със запетая)",
    allChannels: "Всички канали",
    allStatuses: "Всички статуси",
    statuses: { confirmed: "потвърдена", modified: "променена", cancelled: "анулирана", failed_import: "неуспешен внос", overbooked: "свръхрезервирана", no_show: "неявил се", hold: "задържана" },
    dateTypes: { check_in: "Настаняване", check_out: "Напускане", created: "Направена на", cancelled: "Дата на анулиране", stay: "Отседнали на (в хотела)" },
    from: "от",
    filter: "Филтрирай",
    clear: "Изчисти",
    results: (n) => `${n} ${n === 1 ? "резултат" : "резултата"}`,
    cols: { channel: "Канал", reservation: "Резервация", guest: "Гост", roomRate: "Стая · Цена", checkIn: "Настаняване", checkOut: "Напускане", status: "Статус", ack: "Потвърждение", total: "Общо", imported: "Внесена" },
    noMatch: "Няма резервации, отговарящи на филтрите.",
    none: "Все още няма резервации от каналите. Пристигат тук автоматично, щом свързан канал продаде стая.",
    direct: "Директно",
    acked: "потвърдена",
    received: "получена",
    cancel: "Анулирай",
    search: {
      title: "Търсене",
      resultsFor: (q) => `Резултати за „${q}“`,
      subtitle: "Търсене на стаи, цени, канали и резервации",
      prompt: "Пишете в полето за търсене горе, за да намерите тип стая, ценови план, канал или резервация.",
      nothing: (q) => `Нищо не е намерено за „${q}“.`,
      roomTypes: "Типове стаи",
      ratePlans: "Ценови планове",
      channels: "Канали",
      reservations: "Резервации",
    },
    channelStatus: { connected: "свързан", pending: "изчаква", error: "грешка", disabled: "изключен", paused: "на пауза", disconnected: "откачен", not_connected: "не е свързан" },
  },
};
