// A destination country isn't its own record anywhere today — it's just a free-text `country`
// field on University. This registry gives every destination country a stable id the moment it's
// first seen, so a future real backend has a real `countries` table (id, name) to migrate
// University.country into as a foreign key, instead of a plain string with no primary key.
//
// Also carries the "Country Guide" content shown on every university page in that country (Why
// This Country, the Cost Calculator's recommended funds figure, Required Documents with sample
// uploads, Application Procedure, Visa Procedure) — genuinely country-level, not per-university,
// so it's entered once via Data Management's Add/Edit Country form.

export interface RequiredDocument {
  id: string;
  name: string;
  description?: string;
  sampleFileName?: string;
  sampleFileDataUrl?: string; // data: URL — base64-embedded, small files only (no file-storage backend)
}

// Real visa/immigration financial-planning breakdown (modeled on the UK Student visa: CAS
// deposit, Immigration Health Surcharge, visa fee, TB test, air-ticket, then a separate
// bank-statement/proof-of-funds requirement) — genuinely country-specific rules, shown as a
// two-part table (foreign currency + the student's home currency) on the university's Fees tab.
export interface VisaCostConfig {
  casPaymentPercent: number; // e.g. 50 — upfront deposit, % of tuition, paid before the visa stage
  healthSurchargePerYear: number; // e.g. 776 — IHS-equivalent, per year of visa validity, in the university's own currency
  visaApplicationFee: number; // in the university's own currency
  tbTestCostLocal: number; // in the student's home currency
  airTicketCostLocal: number; // in the student's home currency
  tuitionDuePercent: number; // e.g. 50 — remaining tuition due, shown for the bank statement
  livingCostPerMonth: number; // in the university's own currency
  livingCostMonths: number;
  localCurrencyName: string; // e.g. "BDT"
  foreignToLocalRate: number; // e.g. 165 — 1 unit of the university's currency in the local currency
}

export interface CountryRecord {
  id: string;
  name: string;
  whyThisCountry?: string;
  recommendedFundsUSD?: number;
  visaCostConfig?: VisaCostConfig;
  requiredDocuments?: RequiredDocument[];
  applicationProcedure?: string; // one step per line
  visaProcedure?: string; // one step per line
}

const STORAGE_KEY = "data-mgmt-country-registry";
const DELETED_KEY = "data-mgmt-deleted-country-ids";
const OVERRIDES_KEY = "data-mgmt-country-overrides";

// Demo seed countries removed — the registry now starts empty and fills in only from real
// countries entered via Data Management (Add Country, or naming a country while adding a
// university, which auto-registers it through getCountryId() below).
const SEED_COUNTRIES: CountryRecord[] = [];

function nextId(): string {
  return `co-custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
}

function loadCustom(): CountryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as CountryRecord[]) : [];
    return dedupeIds(list);
  } catch {
    return [];
  }
}

// Self-heals a bug from an earlier version of getCountryId(): registering several new countries
// within the same render pass could call Date.now() more than once within the same millisecond,
// producing duplicate ids for genuinely different countries. Reassigns any collision a fresh id
// and persists the fix, so it only ever has to run once per browser.
function dedupeIds(list: CountryRecord[]): CountryRecord[] {
  const seen = new Set<string>();
  let changed = false;
  const fixed = list.map((c) => {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      return c;
    }
    changed = true;
    const id = nextId();
    seen.add(id);
    return { ...c, id };
  });
  if (changed) saveCustom(fixed);
  return fixed;
}

function saveCustom(list: CountryRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadDeleted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DELETED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDeleted(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DELETED_KEY, JSON.stringify([...ids]));
}

function loadOverrides(): Record<string, Partial<CountryRecord>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Partial<CountryRecord>>) : {};
  } catch {
    return {};
  }
}

function saveOverrides(map: Record<string, Partial<CountryRecord>>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(map));
}

export function getAllCountries(): CountryRecord[] {
  const deleted = loadDeleted();
  const overrides = loadOverrides();
  return [...SEED_COUNTRIES, ...loadCustom()]
    .filter((c) => !deleted.has(c.id))
    .map((c) => (overrides[c.id] ? { ...c, ...overrides[c.id] } : c));
}

/** Removes a country from the registry — a custom (data-manager-added) one is dropped outright,
 * a seed one is soft-deleted (added to a hidden-ids set) the same way universityCatalogStore.ts
 * soft-deletes seed universities. Callers should only offer this when the country has zero
 * universities under it (see Countries.tsx) — deleting one that still has real universities
 * wouldn't remove them (University.country is a plain string, not a foreign key), it would just
 * make getCountryId() silently mint a new id for it the next time something looks it up. */
export function deleteCountry(id: string) {
  const custom = loadCustom();
  if (custom.some((c) => c.id === id)) {
    saveCustom(custom.filter((c) => c.id !== id));
    return;
  }
  const deleted = loadDeleted();
  deleted.add(id);
  saveDeleted(deleted);
}

/** Looks up a country's id by name, registering it with a brand-new stable id the first time it's
 * seen (e.g. a data manager typing a country that's never appeared in the catalog before). */
export function getCountryId(name: string): string {
  const trimmed = name.trim();
  const existing = getAllCountries().find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.id;
  const record: CountryRecord = { id: nextId(), name: trimmed };
  saveCustom([...loadCustom(), record]);
  return record.id;
}

export function getCountryName(id: string): string | undefined {
  return getAllCountries().find((c) => c.id === id)?.name;
}

/** The full record (including Country Guide content) for a university's `.country` field —
 * case-insensitive since University.country is free text. */
export function getCountryByName(name: string): CountryRecord | undefined {
  const trimmed = name.trim().toLowerCase();
  return getAllCountries().find((c) => c.name.trim().toLowerCase() === trimmed);
}

/** Saves Country Guide content (Why This Country, recommended funds, required documents,
 * application/visa procedure) — same seed-vs-custom branch as deleteCountry(). */
export function updateCountryDetails(id: string, patch: Partial<Omit<CountryRecord, "id">>) {
  const custom = loadCustom();
  const idx = custom.findIndex((c) => c.id === id);
  if (idx >= 0) {
    custom[idx] = { ...custom[idx], ...patch };
    saveCustom(custom);
    return;
  }
  const overrides = loadOverrides();
  overrides[id] = { ...overrides[id], ...patch };
  saveOverrides(overrides);
}
