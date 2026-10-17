// A student can hold their funds across several banks. Same synchronous-cache pattern as
// studentFinancialReadinessStore.ts (which keeps the derived one-record summary of these accounts that the journey
// stage, tasks and notifications read). Both the student's own Dashboard card and a counsellor's Journey panel edit
// through saveBankAccounts().
import { apiGet, apiPut } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged, dedupeInFlight } from "../utils/syncCache";
import { refreshFinancialReadiness } from "./studentFinancialReadinessStore";
import { refreshCachedJourneys } from "./applicationJourneyStore";
import { getBankAccountsCache, setBankAccountsCache, loadBankAccounts, type BankAccount, type StoredBankAccount } from "./bankAccountsCache";

export type { BankAccount } from "./bankAccountsCache";

let refreshSeq = 0;

export function refreshBankAccounts(): Promise<void> {
  return dedupeInFlight("bank-accounts", async () => {
    const seq = ++refreshSeq;
    const next = await apiGet<StoredBankAccount[]>("/api/financial-readiness/accounts");
    if (seq !== refreshSeq) return; // a slower, older response must not win
    if (!cacheChanged(next, getBankAccountsCache())) return;
    setBankAccountsCache(next);
    notifyCacheChange();
  });
}

export { loadBankAccounts };

/** Replaces the student's whole account list. Awaited (not optimistic) so the editor can show a real error — the
 * server also validates and re-derives the shared summary, so everything that reads it is refreshed afterwards. */
export async function saveBankAccounts(studentId: string, accounts: BankAccount[]): Promise<void> {
  const res = await apiPut<{ accounts: StoredBankAccount[] }>(
    `/api/financial-readiness/${encodeURIComponent(studentId)}/accounts`,
    { accounts }
  );
  setBankAccountsCache([...getBankAccountsCache().filter((a) => a.studentId !== studentId), ...res.accounts]);
  notifyCacheChange();
  await Promise.all([refreshFinancialReadiness(), Promise.resolve(refreshCachedJourneys())]).catch(() => undefined);
}

export function clearBankAccountsCache() {
  setBankAccountsCache([]);
}
