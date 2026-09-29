import { BED_SETUPS, ROOM_AMENITIES, ROOM_AMENITY_GROUPS } from "@revio/core";
import type { Translations } from "./i18n";

/**
 * What a room offers, in the reader's language — amenities, their groups, bed setups.
 *
 * The keys are defined once in `@revio/core` (Channex takes them as ids). RevioCRS shows them to the
 * hotel while it fills them in; RevioDirect shows them to the guest choosing a room. One module, so
 * the chip the hotel ticked and the line the guest reads cannot say different things (moved here
 * from RevioCRS's own dictionary on 2026-09-29, when RevioDirect needed the same words).
 *
 * English is BUILT from core, so it cannot drift; Bulgarian is keyed by the same keys, so a new
 * amenity in core is a missing key in the coverage test rather than an English chip on a Bulgarian page.
 */
export interface RoomContentStrings {
  amenities: Record<string, string>;
  amenityGroups: Record<string, string>;
  bedSetups: Record<string, string>;
}

const coreLabels = <T extends { key: string; label: string }>(list: readonly T[]) =>
  Object.fromEntries(list.map((x) => [x.key, x.label])) as Record<string, string>;

export const roomContentStrings: Translations<RoomContentStrings> = {
  en: {
    amenities: coreLabels(ROOM_AMENITIES),
    amenityGroups: coreLabels(ROOM_AMENITY_GROUPS),
    bedSetups: coreLabels(BED_SETUPS),
  },
  bg: {
    amenities: {
      air_conditioning: "Климатик", heating: "Отопление", wifi: "Безплатен WiFi", tv: "Телевизор",
      safe: "Сейф в стаята", desk: "Бюро", soundproofing: "Шумоизолация", iron: "Ютия и дъска",
      private_bathroom: "Собствена баня", shower: "Душ", bathtub: "Вана", hairdryer: "Сешоар",
      toiletries: "Безплатни тоалетни принадлежности", bathrobes: "Халати и чехли",
      kitchenette: "Кухненски бокс", fridge: "Хладилник", minibar: "Минибар", coffee_tea: "Кафе и чай",
      microwave: "Микровълнова фурна", dishwasher: "Съдомиялна",
      balcony: "Балкон", terrace: "Тераса", sea_view: "Изглед към морето", mountain_view: "Изглед към планината",
      city_view: "Изглед към града", garden_view: "Изглед към градината", private_pool: "Собствен басейн",
      cot_available: "Бебешка кошара при заявка", extra_bed_available: "Възможно допълнително легло",
      connecting_rooms: "Възможни свързани стаи", family_friendly: "Подходяща за деца",
      smoking_allowed: "Пушенето е разрешено", pets_allowed: "Домашни любимци са разрешени",
      accessible: "Достъп без стъпала", ground_floor: "Партер", lift_access: "Достъп с асансьор",
    },
    amenityGroups: {
      comfort: "Комфорт", bathroom: "Баня", kitchen: "Кухня и хранене", view: "Изглед и пространство",
      family: "Семейство", policy: "Добре е да знаете",
    },
    bedSetups: {
      single: "1 единично легло", twin: "2 единични легла", double: "1 двойно легло",
      queen: "1 голямо двойно легло (queen)", king: "1 много голямо двойно легло (king)",
      double_single: "1 двойно + 1 единично", two_double: "2 двойни легла", sofa_bed: "1 разтегателен диван",
      bunk: "Двуетажни легла", dorm_bed: "Легло в обща стая",
    },
  },
};
