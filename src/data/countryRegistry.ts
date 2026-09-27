// Postgres/MySQL-backed via /api/countries (server/src/routes/countries.js) — the real Country
// Guide catalog, shared across every account instead of living only in the browser that created
// it. Same synchronous-cache pattern as universityCatalogStore.ts: reads stay synchronous (every
// existing call site here never needs to change), backed by a cache warmed after login and kept
// current after every write.
//
// Also carries the "Country Guide" content shown on every university page in that country (Why
// This Country, the Cost Calculator's recommended funds figure, Required Documents with sample
// uploads, Application Procedure, Visa Procedure) — genuinely country-level, not per-university,
// so it's entered once via Data Management's Add/Edit Country form.
import { loadStoredAuth } from "../utils/authClient";
import { apiGet, apiPatch, apiDelete } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";

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

export interface WhyStudyHighlight {
  id: string;
  title: string;
  description: string;
}

export interface UsefulLink {
  id: string;
  label: string;
  url: string;
}

// Free-text on purpose, same as VisaCostConfig's neighbors — a real range like "£10,000 - £25,000"
// or "2 years (Graduate Route)" doesn't parse into a number cleanly, and country pages don't need
// to compute against these the way the Fees tab computes against VisaCostConfig.
export interface CountryKeyInfo {
  popularIntakes?: string;
  avgTuitionFeeRange?: string;
  costOfLivingRange?: string;
  postStudyWorkVisa?: string;
  dependentsAllowed?: string;
  partTimeWork?: string;
  applicationProcessingTime?: string;
}

export interface CountryRecord {
  id: string;
  name: string;
  // The country's own small logo/flag image — shown as its identity badge on the Country Detail
  // page's hero and on every "country card" list (Data Management's Countries page, a counsellor's
  // Partners page), same data: URL upload convention as photoUrl below. Distinct from photoUrl,
  // which is the large hero banner image, not a compact badge. Falls back to the static dial-code
  // list's flag emoji (see countries.ts), then a generic globe icon, when unset.
  logoUrl?: string;
  whyThisCountry?: string;
  recommendedFundsUSD?: number;
  visaCostConfig?: VisaCostConfig;
  requiredDocuments?: RequiredDocument[];
  applicationProcedure?: string; // one step per line
  visaProcedure?: string; // one step per line
  // Country Overview page content (see CountryOverview.tsx) — everything here is optional and
  // each section hides on its own when empty, same convention as the fields above.
  tagline?: string; // short hero subhead, e.g. "World-class education. Global opportunities."
  internationalStudentStat?: string; // e.g. "680,000+"
  whyStudyHighlights?: WhyStudyHighlight[];
  keyInfo?: CountryKeyInfo;
  usefulLinks?: UsefulLink[];
  // Uploaded via Data Management (data: URL — base64-embedded, small files only, same as
  // RequiredDocument's sample uploads above). CountryHero falls back to its abstract SkylineArt
  // illustration wherever this is absent.
  photoUrl?: string;
  // Currency symbols universities in this country are typically priced in, e.g. ["£"] for the UK
  // or ["$", "C$"] for a country where both a local and foreign-quoted fee are common. Offered as
  // the University form's currency picklist for this country, plus a "custom currency" escape
  // hatch (see addCurrencyToCountry) that adds whatever's typed to this list for next time.
  currencySymbols?: string[];
}

let cache: CountryRecord[] = [];
let refreshSeq = 0;

export async function refreshCountries(): Promise<void> {
  const seq = ++refreshSeq;
  const next = await apiGet<CountryRecord[]>("/api/countries");
  // A slower, older response landing after a newer one must not win.
  if (seq !== refreshSeq) return;
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

// Stable ids for the four countries requirementRules.ts references by name at module load time
// (getCountryId("UK"), etc.) — real rows for all four (seeded by the migration that added the rest
// of Country's columns), but getCountryId() below still special-cases a name match against this
// list directly, synchronously, independent of whatever the cache currently holds — RULES in
// requirementRules.ts is built at module-load time, before login/warmCaches has ever populated the
// cache from the server, so these four specifically can never wait on a network round trip. This
// also keeps deleting one of them from Data Management from resurrecting it with a new id the next
// time something looks it up by name.
// "UK" is the seed's canonical name (matching requirementRules.ts's own getCountryId("UK") call),
// but a human naturally types "United Kingdom" — without this alias, that produced a second,
// genuinely different country row (confirmed in production: a data manager's own past entry
// migrated in as a separate "United Kingdom" alongside the empty "UK" seed).
const SEED_COUNTRY_IDS: Record<string, string> = {
  uk: "co-seed-uk",
  "united kingdom": "co-seed-uk",
  australia: "co-seed-australia",
  canada: "co-seed-canada",
  "united states": "co-seed-united-states",
  usa: "co-seed-united-states",
};

function nextId(): string {
  return `co-custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
}

export function getAllCountries(): CountryRecord[] {
  return cache;
}

/** Removes a country from the catalog. Callers should only offer this when the country has zero
 * universities under it (see Countries.tsx) — deleting one that still has real universities
 * wouldn't remove them (University.country is a plain string, not a foreign key), it would just
 * make getCountryId() mint/return an id for it again the next time something looks it up (or, for
 * one of the four fixed-id countries above, keep returning that same fixed id with no matching row
 * until it's re-added). */
export function deleteCountry(id: string) {
  const prev = cache;
  cache = cache.filter((c) => c.id !== id);
  notifyCacheChange();
  apiDelete(`/api/countries/${id}`).catch((err) => {
    // Roll the optimistic change back so the UI never shows a delete that didn't happen — unless
    // the session ended meanwhile, in which case the cache was already cleared on purpose.
    if ((err as Error)?.name === "StaleSessionError") return;
    cache = prev;
    notifyCacheChange();
    console.warn("Failed to delete country:", err);
  });
}

/** Looks up a country's id by name, registering it (optimistically, then persisted through the
 * upsert-on-PATCH endpoint) with a brand-new stable id the first time it's seen — e.g. a data
 * manager typing a country that's never appeared in the catalog before, or naming one while adding
 * a university. Matches one of the four fixed seed ids first, before touching the cache at all. */
export function getCountryId(name: string): string {
  const trimmed = name.trim();
  const seedId = SEED_COUNTRY_IDS[trimmed.toLowerCase()];
  if (seedId) return seedId;
  const existing = cache.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.id;

  const id = nextId();
  const record: CountryRecord = { id, name: trimmed };
  cache = [...cache, record];
  notifyCacheChange();
  apiPatch<CountryRecord>(`/api/countries/${id}`, { name: trimmed })
    .then((created) => {
      cache = cache.map((c) => (c.id === id ? created : c));
      notifyCacheChange();
    })
    .catch((err) => {
      if ((err as Error)?.name === "StaleSessionError") return;
      // Left in place rather than rolled back: unlike a university/course, plenty of other reads
      // this same render pass (getCountryByName, a university's own .country string) already
      // depend on this id resolving for the rest of the session even if the persist failed — a
      // later refreshCountries() that still doesn't find it server-side is the actual signal to
      // watch for, not something to silently undo mid-session.
      console.warn(`Failed to persist new country "${trimmed}":`, err);
    });
  return id;
}

export function getCountryName(id: string): string | undefined {
  return cache.find((c) => c.id === id)?.name;
}

/** The full record (including Country Guide content) for a university's `.country` field —
 * case-insensitive since University.country is free text. */
export function getCountryByName(name: string): CountryRecord | undefined {
  const trimmed = name.trim().toLowerCase();
  return cache.find((c) => c.name.trim().toLowerCase() === trimmed);
}

/** Saves Country Guide content (Why This Country, recommended funds, required documents,
 * application/visa procedure, Overview page content) — upserts server-side, so this also works as
 * the second half of "register a brand-new country" (getCountryId to mint the id, then this to
 * fill in its content) regardless of which of the two requests reaches the server first. */
export function updateCountryDetails(id: string, patch: Partial<Omit<CountryRecord, "id">>) {
  const prev = cache;
  const existing = cache.find((c) => c.id === id);
  cache = existing
    ? cache.map((c) => (c.id === id ? { ...c, ...patch } : c))
    : [...cache, { id, name: patch.name ?? id, ...patch }];
  notifyCacheChange();

  apiPatch<CountryRecord>(`/api/countries/${id}`, patch)
    .then((updated) => {
      cache = cache.map((c) => (c.id === id ? updated : c));
      notifyCacheChange();
    })
    .catch((err) => {
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to persist country update:", err);
    });
}

/** Adds a custom currency symbol to a country's picklist — used when someone typing a university's
 * currency picks "+ Add a custom currency…" instead of one already on file, so the same symbol is
 * offered without retyping the next time a university in that country is added. No-ops if the
 * country isn't found or the symbol's blank or already listed. */
export function addCurrencyToCountry(countryName: string, symbol: string) {
  const trimmed = symbol.trim();
  if (!trimmed) return;
  const record = getCountryByName(countryName);
  if (!record) return;
  const current = record.currencySymbols ?? [];
  if (current.includes(trimmed)) return;
  updateCountryDetails(record.id, { currencySymbols: [...current, trimmed] });
}

// --- One-time recovery of whatever this browser had saved locally before this store moved to the
// server — otherwise a country someone already spent time filling in (Why This Country, visa cost
// breakdown, required documents, ...) would just silently vanish the moment this ships, since the
// new cache starts out reading from the server instead of localStorage. Runs once per browser
// (tracked by MIGRATED_KEY) and only ever adds/fills in data; it never deletes the old localStorage
// keys' *content*, only stops re-attempting.
const LEGACY_STORAGE_KEY = "data-mgmt-country-registry";
const LEGACY_OVERRIDES_KEY = "data-mgmt-country-overrides";
const LEGACY_DELETED_KEY = "data-mgmt-deleted-country-ids";
const MIGRATED_KEY = "data-mgmt-countries-migrated-to-server";

export async function migrateLegacyLocalCountries(): Promise<void> {
  if (typeof window === "undefined" || window.localStorage.getItem(MIGRATED_KEY)) return;
  // Only Data Management (or an admin) may write the catalog — any other role would just get a
  // 403 from the server for every legacy row, on every load.
  const role = loadStoredAuth()?.user.role;
  if (role !== "data" && role !== "admin") return;

  let legacyCustom: CountryRecord[] = [];
  let legacyOverrides: Record<string, Partial<CountryRecord>> = {};
  let legacyDeleted: string[] = [];
  try {
    legacyCustom = JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");
    legacyOverrides = JSON.parse(window.localStorage.getItem(LEGACY_OVERRIDES_KEY) || "{}");
    legacyDeleted = JSON.parse(window.localStorage.getItem(LEGACY_DELETED_KEY) || "[]");
  } catch {
    window.localStorage.setItem(MIGRATED_KEY, "true");
    return;
  }
  const deleted = new Set(legacyDeleted);
  // Custom (data-manager-added) countries this browser knew about, plus overrides recorded against
  // one of the four fixed seed ids (Country Guide content entered for UK/Australia/Canada/US) —
  // both are just a name+id and a patch of content, so both migrate through the same upsert PATCH.
  const rows: { id: string; patch: Partial<CountryRecord> }[] = [
    ...legacyCustom.filter((c) => !deleted.has(c.id)).map((c) => ({ id: c.id, patch: c })),
    ...Object.entries(legacyOverrides)
      .filter(([id]) => !deleted.has(id))
      .map(([id, patch]) => ({ id, patch })),
  ];
  if (rows.length === 0) {
    window.localStorage.setItem(MIGRATED_KEY, "true");
    return;
  }
  for (const { id, patch } of rows) {
    try {
      await apiPatch<CountryRecord>(`/api/countries/${id}`, patch);
    } catch (err) {
      console.warn(`Failed to migrate locally-saved country "${patch.name ?? id}" to the server:`, err);
      return; // leaves MIGRATED_KEY unset so this retries next load instead of losing the rest
    }
  }
  window.localStorage.setItem(MIGRATED_KEY, "true");
  await refreshCountries();
}

/** Drops everything cached for the current session — called on logout/login (see warmCaches.ts)
 * so the next user on this browser never sees the previous one's data. */
export function clearCountryRegistryCache() {
  cache = [];
}
