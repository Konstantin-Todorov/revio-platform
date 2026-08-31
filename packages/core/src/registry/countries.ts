/**
 * Countries for the guest register — ISO 3166-1 alpha-2 with an English name.
 *
 * NOT exhaustive, and the UI must never treat it as a closed list: it backs a suggestion list on a
 * free-text field, so a guest from a country not named here is still registrable by typing the code.
 * A register that cannot record a Japanese tourist because a dropdown was short is a register the
 * hotel keeps somewhere else instead.
 *
 * Covers the EEA and Switzerland in full — `registerCategory` turns on exactly that set — plus the
 * source markets a Bulgarian property actually sees.
 */
export const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  // EEA + CH — the т. 1.1 set, complete.
  AT: "Austria", BE: "Belgium", BG: "Bulgaria", HR: "Croatia", CY: "Cyprus", CZ: "Czechia",
  DK: "Denmark", EE: "Estonia", FI: "Finland", FR: "France", DE: "Germany", GR: "Greece",
  HU: "Hungary", IE: "Ireland", IT: "Italy", LV: "Latvia", LT: "Lithuania", LU: "Luxembourg",
  MT: "Malta", NL: "Netherlands", PL: "Poland", PT: "Portugal", RO: "Romania", SK: "Slovakia",
  SI: "Slovenia", ES: "Spain", SE: "Sweden", IS: "Iceland", LI: "Liechtenstein", NO: "Norway",
  CH: "Switzerland",
  // Neighbours and the larger source markets.
  AL: "Albania", AM: "Armenia", AU: "Australia", AZ: "Azerbaijan", BA: "Bosnia and Herzegovina",
  BR: "Brazil", CA: "Canada", CN: "China", GE: "Georgia", IL: "Israel", IN: "India", JP: "Japan",
  KZ: "Kazakhstan", KR: "South Korea", MD: "Moldova", ME: "Montenegro", MK: "North Macedonia",
  NZ: "New Zealand", RS: "Serbia", RU: "Russia", TR: "Türkiye", UA: "Ukraine",
  AE: "United Arab Emirates", GB: "United Kingdom", US: "United States", ZA: "South Africa",
};

/** The code's country name, or the code itself when it is one we do not name. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "—";
  const k = code.trim().toUpperCase();
  return COUNTRY_NAMES[k] ?? k;
}

/** Normalise typed input to a storable code. Returns null for anything that is not two letters. */
export function normaliseCountryCode(raw: string | null | undefined): string | null {
  const k = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(k) ? k : null;
}
