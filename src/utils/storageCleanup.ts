// One-time, versioned clean-up of localStorage keys this app used to write and no longer reads.
//
// Deliberately conservative: only keys that are provably dead (nothing in the code reads them) are listed, and only app-owned
// keys. Anything that could hold unsaved user work — profile drafts (`sd-profile-*`, `sd-academic-levels:*`), the auth session
// (`sd-auth-*`), shortlists, notification flags, AI chats — is never touched here. Keys the app never wrote (browser extensions
// and other scripts add some of their own, e.g. `__WOV`/`__GMO`) are none of this code's business and are left alone.
const VERSION_KEY = "sd-storage-cleanup-version";
const CURRENT_VERSION = 1;

/** version → keys first confirmed dead in that version. */
const OBSOLETE_BY_VERSION: Record<number, string[]> = {
  1: ["demo-role"], // an old demo-role switcher flag; nothing reads it any more
};

/** Runs every clean-up step newer than the one this browser last ran. Safe to call on every start. */
export function runStorageCleanup(storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage): number {
  if (!storage) return 0;
  try {
    const done = Number(storage.getItem(VERSION_KEY) ?? 0) || 0;
    if (done >= CURRENT_VERSION) return 0;
    let removed = 0;
    for (let v = done + 1; v <= CURRENT_VERSION; v++) {
      for (const key of OBSOLETE_BY_VERSION[v] ?? []) {
        if (storage.getItem(key) !== null) { storage.removeItem(key); removed++; }
      }
    }
    storage.setItem(VERSION_KEY, String(CURRENT_VERSION));
    return removed;
  } catch {
    return 0; // storage unavailable or full — try again next start
  }
}

/** Where the bytes in localStorage are, biggest first, with whether each key looks app-owned — for diagnosing a bloated
 * browser (run `copy(JSON.stringify(describeStorageUsage()))` in the console). Reads only; changes nothing. */
const APP_PREFIXES = ["sd-", "staff-", "data-mgmt-", "agent-shortlist:", "demo-"];
export function describeStorageUsage(storage: Storage = window.localStorage) {
  const rows: { key: string; bytes: number; appOwned: boolean }[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i) ?? "";
    rows.push({ key, bytes: key.length + (storage.getItem(key)?.length ?? 0), appOwned: APP_PREFIXES.some((p) => key.startsWith(p)) });
  }
  return rows.sort((a, b) => b.bytes - a.bytes);
}
