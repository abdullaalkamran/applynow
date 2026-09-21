// Per-university commission rates — set by admin, read by every agent. Postgres-backed via
// /api/commission-rates (server/src/routes/commissionRates.js), same synchronous-cache pattern as
// staffStore.ts. A single shared store (not per-agent) since the rate a university pays is a
// platform-level agreement, not something each agent negotiates individually. Bonuses are the
// platform's own promotional top-up on selected universities, layered on top of the base rate.
//
// A university with no saved rate has *no* rate (see hasCommissionRate) — nothing is invented for
// it, so agents never see a figure an admin didn't actually set.
import { apiGet, apiPut, apiDelete } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";

export type CommissionMode = "percent" | "fixed";

export interface CommissionRate {
  // "percent": ratePercent of the course tuition fee. "fixed": fixedAmountUSD per enrolment,
  // regardless of tuition.
  mode: CommissionMode;
  ratePercent: number;
  fixedAmountUSD: number;
  // Platform bonus — always a % of tuition, whichever mode the base is in. 0 = no bonus.
  bonusPercent: number;
  bonusLabel: string; // "" = no bonus
}

interface StoredRate extends CommissionRate {
  universityId: string;
  updatedAt: string;
}

export const EMPTY_RATE: CommissionRate = { mode: "percent", ratePercent: 0, fixedAmountUSD: 0, bonusPercent: 0, bonusLabel: "" };

let cache: StoredRate[] = [];
let refreshSeq = 0;

export async function refreshCommissionRates(): Promise<void> {
  const seq = ++refreshSeq;
  const next = await apiGet<StoredRate[]>("/api/commission-rates");
  // A slower, older response landing after a newer one must not win.
  if (seq !== refreshSeq) return;
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

export function hasCommissionRate(universityId: string): boolean {
  return cache.some((r) => r.universityId === universityId);
}

/** The saved rate, or EMPTY_RATE (0%) when none has been set — check hasCommissionRate() to tell
 * "not set" apart from a genuine 0. */
export function getCommissionRate(universityId: string): CommissionRate {
  const stored = cache.find((r) => r.universityId === universityId);
  if (!stored) return EMPTY_RATE;
  const { universityId: _id, updatedAt: _at, ...rate } = stored;
  return rate;
}

/** Admin-only on the server. Awaited (not optimistic) so the caller can surface a validation
 * error instead of showing a value that was never saved. */
export async function setCommissionRate(universityId: string, rate: CommissionRate): Promise<void> {
  const saved = await apiPut<StoredRate>(`/api/commission-rates/${universityId}`, rate);
  cache = [...cache.filter((r) => r.universityId !== universityId), saved];
  notifyCacheChange();
}

export async function clearCommissionRate(universityId: string): Promise<void> {
  await apiDelete<void>(`/api/commission-rates/${universityId}`);
  cache = cache.filter((r) => r.universityId !== universityId);
  notifyCacheChange();
}

export function loadCommissionRatesFor(universityIds: string[]): Record<string, CommissionRate> {
  const out: Record<string, CommissionRate> = {};
  universityIds.forEach((id) => { out[id] = getCommissionRate(id); });
  return out;
}

/** Human-readable summary of a rate, e.g. "12% of tuition" or "$500 per enrolment". */
export function describeCommissionRate(rate: CommissionRate): string {
  return rate.mode === "fixed" ? `$${rate.fixedAmountUSD.toLocaleString()} per enrolment` : `${rate.ratePercent}% of tuition`;
}

/** Drops everything cached for the current session — called on logout/login (see warmCaches.ts)
 * so the next user on this browser never sees the previous one's data. */
export function clearCommissionRatesCache() {
  cache = [];
}
