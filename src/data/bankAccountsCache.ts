// The in-memory list of every bank account the signed-in user can see — kept in its own tiny module (no store imports) so
// utilities like documentChecklist.ts can read it without pulling in the journey/record stores and creating import cycles.
// Filled and updated by studentBankAccountsStore.ts.
export interface BankAccount {
  id?: string;
  studentId?: string;
  bankName: string;
  status: string; // Not Required | Not Started | Preparing | Maintaining | Matured | Ready | Expired
  depositType?: string;
  openingDate?: string;
  /** Set by the counsellor: a Maintaining account becomes Matured automatically on this date. */
  maturityDate?: string;
  amount?: number;
  currency?: string;
  accountHolder?: string;
  accountType?: string;
}

export type StoredBankAccount = BankAccount & { studentId: string };

let accounts: StoredBankAccount[] = [];

export const getBankAccountsCache = () => accounts;
export const setBankAccountsCache = (next: StoredBankAccount[]) => { accounts = next; };

export function loadBankAccounts(studentId: string): StoredBankAccount[] {
  return accounts.filter((a) => a.studentId === studentId);
}

/** Accounts that hold money (Maintaining onwards) — these are the ones that need proof documents. */
export const HOLDING_ACCOUNT_STATUSES = new Set(["Maintaining", "Matured", "Ready"]);
