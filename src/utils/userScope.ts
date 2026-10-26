// Small per-account bits of UI state that still live in this browser's localStorage (which
// notifications were read, which applications a counsellor has already opened, lead follow-up
// status, …). They used to sit under one fixed key that was WIPED on every logout — so each login
// brought every old notification and "New" badge back as unread, for every account. Keying them by
// the signed-in user instead keeps each account's state across sessions and stops two accounts on
// one browser from sharing it.
const USER_KEY = "sd-auth-user";

function currentUserTag(): string {
  if (typeof window === "undefined") return "anon";
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    const user = raw ? (JSON.parse(raw) as { role?: string; roleUserId?: string }) : null;
    return user?.roleUserId ? `${user.role ?? "user"}-${user.roleUserId}` : "anon";
  } catch {
    return "anon";
  }
}

/** `base` namespaced to whoever is signed in right now, e.g. `sd-notifications-read:student-abc`. */
export function userScopedKey(base: string): string {
  return `${base}:${currentUserTag()}`;
}
