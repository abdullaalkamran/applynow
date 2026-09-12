// Per-university commission rates — set by admin, read by every agent. A single shared store
// (not per-agent) since the rate a university pays is a platform-level agreement, not something
// each agent negotiates individually. Bonuses are the platform's own promotional top-up on
// selected universities (e.g. a push campaign), layered on top of the base rate.

export interface CommissionRate {
  ratePercent: number;
  bonusPercent: number; // 0 = no bonus
  bonusLabel: string; // "" = no bonus
}

const STORAGE_KEY = "commission-rates-v1";

// Deterministic variety across the catalogue without hand-listing every university id — a stable
// 10-18% base band derived from the id, so rates look realistic before admin ever edits them.
function defaultRateFor(universityId: string): CommissionRate {
  const seed = [...universityId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return { ratePercent: 10 + (seed % 9), bonusPercent: 0, bonusLabel: "" };
}

// A couple of universities ship with a platform bonus already active, so the "extra bonus for
// selected universities" feature is visible out of the box rather than only after an admin edits it.
const BONUS_SEED: Record<string, { bonusPercent: number; bonusLabel: string }> = {
  u9: { bonusPercent: 3, bonusLabel: "Spring Intake Push" },
  u7: { bonusPercent: 2, bonusLabel: "Priority Partner Bonus" },
};

function loadAll(): Record<string, CommissionRate> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CommissionRate>) : {};
  } catch {
    return {};
  }
}

function saveAll(map: Record<string, CommissionRate>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getCommissionRate(universityId: string): CommissionRate {
  const stored = loadAll()[universityId];
  if (stored) return stored;
  const base = defaultRateFor(universityId);
  const bonus = BONUS_SEED[universityId];
  return bonus ? { ...base, ...bonus } : base;
}

export function setCommissionRate(universityId: string, rate: CommissionRate) {
  const all = loadAll();
  all[universityId] = rate;
  saveAll(all);
}

export function loadCommissionRatesFor(universityIds: string[]): Record<string, CommissionRate> {
  const out: Record<string, CommissionRate> = {};
  universityIds.forEach((id) => { out[id] = getCommissionRate(id); });
  return out;
}
