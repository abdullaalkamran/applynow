import { userScopedKey } from "../utils/userScope";

const STORAGE_KEY = "sd-shortlisted-programs";

function loadShortlist(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(userScopedKey(STORAGE_KEY));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveShortlist(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(userScopedKey(STORAGE_KEY), JSON.stringify([...ids]));
}

export function isShortlisted(programKey: string): boolean {
  return loadShortlist().has(programKey);
}

export function toggleShortlisted(programKey: string): boolean {
  const ids = loadShortlist();
  const nowShortlisted = !ids.has(programKey);
  if (nowShortlisted) ids.add(programKey);
  else ids.delete(programKey);
  saveShortlist(ids);
  return nowShortlisted;
}

export function shortlistedCount(): number {
  return loadShortlist().size;
}
