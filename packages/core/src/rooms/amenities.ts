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
  /**
   * A lucide icon NAME, not a component.
   *
   * The icon belongs next to the label in both places this list appears — the hotel ticking boxes
   * scans a grid of thirty-five checkboxes far faster with a picture beside each one, and the guest
   * comparing two rooms is scanning rather than reading. But `packages/core` is pure domain data
   * with no React in it, so what lives here is the name; `@revio/ui` resolves it to a component.
   * That split also means a non-React consumer (the Channex mapping, a PDF, an email) can use this
   * list without dragging an icon library along.
   */
  icon: string;
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
export const ROOM_AMENITIES = [
  // Comfort
  { key: "air_conditioning", label: "Air conditioning", group: "comfort", icon: "AirVent" },
  { key: "heating", label: "Heating", group: "comfort", icon: "Thermometer" },
  { key: "wifi", label: "Free WiFi", group: "comfort", icon: "Wifi" },
  { key: "tv", label: "TV", group: "comfort", icon: "Tv" },
  { key: "safe", label: "In-room safe", group: "comfort", icon: "Vault" },
  { key: "desk", label: "Work desk", group: "comfort", icon: "Laptop" },
  { key: "soundproofing", label: "Soundproofing", group: "comfort", icon: "EarOff" },
  { key: "iron", label: "Iron & board", group: "comfort", icon: "Shirt" },

  // Bathroom
  { key: "private_bathroom", label: "Private bathroom", group: "bathroom", icon: "DoorClosed" },
  { key: "shower", label: "Shower", group: "bathroom", icon: "ShowerHead" },
  { key: "bathtub", label: "Bathtub", group: "bathroom", icon: "Bath" },
  { key: "hairdryer", label: "Hairdryer", group: "bathroom", icon: "Wind" },
  { key: "toiletries", label: "Free toiletries", group: "bathroom", icon: "Droplets" },
  { key: "bathrobes", label: "Bathrobes & slippers", group: "bathroom", icon: "Footprints" },

  // Kitchen & dining
  { key: "kitchenette", label: "Kitchenette", group: "kitchen", icon: "CookingPot" },
  { key: "fridge", label: "Fridge", group: "kitchen", icon: "Refrigerator" },
  { key: "minibar", label: "Minibar", group: "kitchen", icon: "Wine" },
  { key: "coffee_tea", label: "Coffee & tea making", group: "kitchen", icon: "Coffee" },
  { key: "microwave", label: "Microwave", group: "kitchen", icon: "Microwave" },
  { key: "dishwasher", label: "Dishwasher", group: "kitchen", icon: "WashingMachine" },

  // Outlook & space
  { key: "balcony", label: "Balcony", group: "view", icon: "DoorOpen" },
  { key: "terrace", label: "Terrace", group: "view", icon: "Umbrella" },
  { key: "sea_view", label: "Sea view", group: "view", icon: "Waves" },
  { key: "mountain_view", label: "Mountain view", group: "view", icon: "Mountain" },
  { key: "city_view", label: "City view", group: "view", icon: "Building2" },
  { key: "garden_view", label: "Garden view", group: "view", icon: "Trees" },
  { key: "private_pool", label: "Private pool", group: "view", icon: "LifeBuoy" },

  // Family
  { key: "cot_available", label: "Cot available", group: "family", icon: "Baby" },
  { key: "extra_bed_available", label: "Extra bed possible", group: "family", icon: "BedSingle" },
  { key: "connecting_rooms", label: "Connecting rooms possible", group: "family", icon: "Link2" },
  { key: "family_friendly", label: "Suitable for children", group: "family", icon: "Users" },

  // Good to know — the ones a guest filters on to EXCLUDE a room, which is why they belong here
  // rather than buried in prose.
  { key: "smoking_allowed", label: "Smoking allowed", group: "policy", icon: "Cigarette" },
  { key: "pets_allowed", label: "Pets allowed", group: "policy", icon: "PawPrint" },
  { key: "accessible", label: "Step-free access", group: "policy", icon: "Accessibility" },
  { key: "ground_floor", label: "Ground floor", group: "policy", icon: "ArrowDownToLine" },
  { key: "lift_access", label: "Lift access", group: "policy", icon: "ArrowUpDown" },
  /*
   * `as const satisfies` rather than a plain `RoomAmenity[]` annotation.
   *
   * `satisfies` still type-checks every entry against RoomAmenity, but `as const` keeps the literal
   * strings, which is what makes `RoomIconName` below a closed union. That union is what turns
   * "someone added an amenity and forgot its icon" from a silent fallback in production into a
   * compile error in `@revio/ui`.
   */
] as const satisfies readonly RoomAmenity[];

export const ROOM_AMENITY_BY_KEY: Record<string, RoomAmenity> = Object.fromEntries(
  ROOM_AMENITIES.map((a) => [a.key, a]),
);

/** Keep only keys we recognise, in list order — so a stale or forged key never reaches a guest. */
export function resolveAmenities(keys: readonly string[]): RoomAmenity[] {
  const chosen = new Set(keys);
  return ROOM_AMENITIES.filter((a) => chosen.has(a.key));
}

/**
 * Which few amenities earn a place on the ROOM CARD, in the order they win it.
 *
 * A card has room for about four, and the four must be chosen by what separates one room from
 * another — not by list order. Taking the first four of `ROOM_AMENITIES` would put "Air conditioning,
 * Heating, Free WiFi, TV" on every card in the hotel, which tells a guest comparing two rooms
 * precisely nothing. A sea view does.
 *
 * So: the differentiators first (what you can see out of it, then what you can do in it), the
 * expected-everywhere comforts last, and the exclusion flags near the end — those matter enormously
 * to the few guests they apply to, and those guests will open the detail view anyway.
 */
export const CARD_AMENITY_PRIORITY: readonly string[] = [
  "sea_view", "private_pool", "mountain_view", "balcony", "terrace", "garden_view", "city_view",
  "kitchenette", "bathtub", "family_friendly", "accessible", "pets_allowed",
  "air_conditioning", "wifi", "minibar", "coffee_tea", "desk",
];

/** The handful to show on a card, most distinguishing first. */
export function headlineAmenities(keys: readonly string[], limit = 4): RoomAmenity[] {
  const has = new Set(keys);
  const picked = CARD_AMENITY_PRIORITY.filter((k) => has.has(k)).slice(0, limit);
  return picked.map((k) => ROOM_AMENITY_BY_KEY[k]!);
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
  { key: "single", label: "1 single bed", icon: "BedSingle" },
  { key: "twin", label: "2 single beds", icon: "BedSingle" },
  { key: "double", label: "1 double bed", icon: "BedDouble" },
  { key: "queen", label: "1 queen bed", icon: "BedDouble" },
  { key: "king", label: "1 king bed", icon: "BedDouble" },
  { key: "double_single", label: "1 double + 1 single", icon: "BedDouble" },
  { key: "two_double", label: "2 double beds", icon: "BedDouble" },
  { key: "sofa_bed", label: "1 sofa bed", icon: "Sofa" },
  { key: "bunk", label: "Bunk beds", icon: "Bed" },
  { key: "dorm_bed", label: "A bed in a shared room", icon: "Bed" },
] as const;

export const BED_SETUP_BY_KEY: Record<string, string> = Object.fromEntries(
  BED_SETUPS.map((b) => [b.key, b.label]),
);

/** Same split as amenities: the name here, the component in `@revio/ui`. */
export const BED_SETUP_ICON_BY_KEY: Record<string, string> = Object.fromEntries(
  BED_SETUPS.map((b) => [b.key, b.icon]),
);

/**
 * Every icon name this vocabulary can ask for — amenities and bed setups together.
 *
 * `@revio/ui` types its name→component map as `Record<RoomIconName, LucideIcon>`, so adding an
 * amenity with a new icon fails the build there until the icon is actually imported. Without this,
 * the failure mode is a room quietly showing a generic tick where the hotel expected a balcony.
 */
export type RoomIconName =
  | (typeof ROOM_AMENITIES)[number]["icon"]
  | (typeof BED_SETUPS)[number]["icon"];
