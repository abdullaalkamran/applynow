// A destination country isn't its own record anywhere today — it's just a free-text `country`
// field on University. This registry gives every destination country a stable id the moment it's
// first seen, so a future real backend has a real `countries` table (id, name) to migrate
// University.country into as a foreign key, instead of a plain string with no primary key.

export interface CountryRecord {
  id: string;
  name: string;
}

const STORAGE_KEY = "data-mgmt-country-registry";

// Seed ids for the destination countries already present in the catalog's seed data, so existing
// universities resolve to a stable id without needing every University record hand-edited.
const SEED_COUNTRIES: CountryRecord[] = [
  { id: "co1", name: "UK" },
  { id: "co2", name: "United States" },
  { id: "co3", name: "Canada" },
  { id: "co4", name: "Australia" },
  { id: "co5", name: "Ireland" },
  { id: "co6", name: "Germany" },
  { id: "co7", name: "United Arab Emirates" },
];

function loadCustom(): CountryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CountryRecord[]) : [];
  } catch {
    return [];
  }
}

function saveCustom(list: CountryRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getAllCountries(): CountryRecord[] {
  return [...SEED_COUNTRIES, ...loadCustom()];
}

/** Looks up a country's id by name, registering it with a brand-new stable id the first time it's
 * seen (e.g. a data manager typing a country that's never appeared in the catalog before). */
export function getCountryId(name: string): string {
  const trimmed = name.trim();
  const existing = getAllCountries().find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.id;
  const record: CountryRecord = { id: `co-custom-${Date.now().toString(36)}`, name: trimmed };
  saveCustom([...loadCustom(), record]);
  return record.id;
}

export function getCountryName(id: string): string | undefined {
  return getAllCountries().find((c) => c.id === id)?.name;
}
