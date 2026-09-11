// Tracks which applications a counsellor has already opened, so a freshly student-submitted
// application can be flagged "New" on the counsellor's Applications page until they check it.

const STORAGE_KEY = "sd-counsellor-seen-applications";

function loadSeenIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isSeenByCounsellor(applicationId: string): boolean {
  return loadSeenIds().includes(applicationId);
}

export function markSeenByCounsellor(applicationId: string) {
  if (typeof window === "undefined") return;
  const ids = loadSeenIds();
  if (ids.includes(applicationId)) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, applicationId]));
}
