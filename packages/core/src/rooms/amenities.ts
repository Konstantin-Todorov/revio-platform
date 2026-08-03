/**
 * What a room HAS — the vocabulary a guest ticks against when choosing between two rooms.
 *
 * A **fixed, curated list**, not free text. Three reasons, in order of how much they cost to get
 * wrong:
 *
 * 1. **It has to leave the building.** Channex takes a room type's `facilities` as a list of ids
 *    (`docs.channex.io` → Room Types Collection), so a hotel that fills this in once can have the
 *    same content pushed to Booking.com and Expedia later instead of retyping it there. Free text
 *    cannot be mapped to anything.
 * 2. **Comparison only works on a shared vocabulary.** A guest deciding between two rooms is
 *    scanning for differences; "WiFi" in one room and "Wi-Fi included" in another reads as two
 *    different things and defeats the entire point of the list.
 * 3. **It stays clean.** Left open, a chain accumulates "WiFi", "Wi-Fi" and "wifi" within a month.
 *
 * The keys are the stored value and are **permanent** — renaming one silently empties that amenity
 * on every room that had it. Labels are display-only and safe to reword.
 */

export interface RoomAmenity {
  /** Stored on the room type. Never rename; add a new key and migrate instead. */
  key: string;
  label: string;
  group: RoomAmenityGroup;
}

export type RoomAmenityGroup = "comfort" | "bathroom" | "kitchen" | "view" | "family" | "policy";

/** Group order and headings — the order a guest reads them in, not alphabetical. */
export const ROOM_AMENITY_GROUPS: { key: RoomAmenityGroup; label: string }[] = [
  { key: "comfort", label: "Comfort" },
  { key: "bathroom", label: "Bathroom" },
  { key: "kitchen", label: "Kitchen & dining" },
  { key: "view", label: "Outlook & space" },
  { key: "family", label: "Family" },
  { key: "policy", label: "Good to know" },
];

/**
 * The list itself. Deliberately short — every entry a hotel has to consider is a small tax on
 * getting the room live at all, so this covers what a guest actually decides on and stops.
 */
export const ROOM_AMENITIES: RoomAmenity[] = [
  // Comfort
  { key: "air_conditioning", label: "Air conditioning", group: "comfort" },
  { key: "heating", label: "Heating", group: "comfort" },
  { key: "wifi", label: "Free WiFi", group: "comfort" },
  { key: "tv", label: "TV", group: "comfort" },
  { key: "safe", label: "In-room safe", group: "comfort" },
  { key: "desk", label: "Work desk", group: "comfort" },
  { key: "soundproofing", label: "Soundproofing", group: "comfort" },
  { key: "iron", label: "Iron & board", group: "comfort" },

  // Bathroom
  { key: "private_bathroom", label: "Private bathroom", group: "bathroom" },
  { key: "shower", label: "Shower", group: "bathroom" },
  { key: "bathtub", label: "Bathtub", group: "bathroom" },
  { key: "hairdryer", label: "Hairdryer", group: "bathroom" },
  { key: "toiletries", label: "Free toiletries", group: "bathroom" },
  { key: "bathrobes", label: "Bathrobes & slippers", group: "bathroom" },

  // Kitchen & dining
  { key: "kitchenette", label: "Kitchenette", group: "kitchen" },
  { key: "fridge", label: "Fridge", group: "kitchen" },
  { key: "minibar", label: "Minibar", group: "kitchen" },
  { key: "coffee_tea", label: "Coffee & tea making", group: "kitchen" },
  { key: "microwave", label: "Microwave", group: "kitchen" },
  { key: "dishwasher", label: "Dishwasher", group: "kitchen" },

  // Outlook & space
  { key: "balcony", label: "Balcony", group: "view" },
  { key: "terrace", label: "Terrace", group: "view" },
  { key: "sea_view", label: "Sea view", group: "view" },
  { key: "mountain_view", label: "Mountain view", group: "view" },
  { key: "city_view", label: "City view", group: "view" },
  { key: "garden_view", label: "Garden view", group: "view" },
  { key: "private_pool", label: "Private pool", group: "view" },

  // Family
  { key: "cot_available", label: "Cot available", group: "family" },
  { key: "extra_bed_available", label: "Extra bed possible", group: "family" },
  { key: "connecting_rooms", label: "Connecting rooms possible", group: "family" },
  { key: "family_friendly", label: "Suitable for children", group: "family" },

  // Good to know — the ones a guest filters on to EXCLUDE a room, which is why they belong here
  // rather than buried in prose.
  { key: "smoking_allowed", label: "Smoking allowed", group: "policy" },
  { key: "pets_allowed", label: "Pets allowed", group: "policy" },
  { key: "accessible", label: "Step-free access", group: "policy" },
  { key: "ground_floor", label: "Ground floor", group: "policy" },
  { key: "lift_access", label: "Lift access", group: "policy" },
];

export const ROOM_AMENITY_BY_KEY: Record<string, RoomAmenity> = Object.fromEntries(
  ROOM_AMENITIES.map((a) => [a.key, a]),
);

/** Keep only keys we recognise, in list order — so a stale or forged key never reaches a guest. */
export function resolveAmenities(keys: readonly string[]): RoomAmenity[] {
  const chosen = new Set(keys);
  return ROOM_AMENITIES.filter((a) => chosen.has(a.key));
}

/** Grouped for display, skipping groups the room has nothing in. */
export function groupAmenities(keys: readonly string[]): { group: RoomAmenityGroup; label: string; items: RoomAmenity[] }[] {
  const resolved = resolveAmenities(keys);
  return ROOM_AMENITY_GROUPS.map((g) => ({
    group: g.key,
    label: g.label,
    items: resolved.filter((a) => a.group === g.key),
  })).filter((g) => g.items.length > 0);
}

/**
 * Bed setups, as a fixed list for the same reason as amenities: a guest scanning three rooms needs
 * "1 double bed" to mean the same thing in all three.
 */
export const BED_SETUPS = [
  { key: "single", label: "1 single bed" },
  { key: "twin", label: "2 single beds" },
  { key: "double", label: "1 double bed" },
  { key: "queen", label: "1 queen bed" },
  { key: "king", label: "1 king bed" },
  { key: "double_single", label: "1 double + 1 single" },
  { key: "two_double", label: "2 double beds" },
  { key: "sofa_bed", label: "1 sofa bed" },
  { key: "bunk", label: "Bunk beds" },
  { key: "dorm_bed", label: "A bed in a shared room" },
] as const;

export const BED_SETUP_BY_KEY: Record<string, string> = Object.fromEntries(
  BED_SETUPS.map((b) => [b.key, b.label]),
);
