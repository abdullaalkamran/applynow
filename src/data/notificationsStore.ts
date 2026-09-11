const READ_KEY = "sd-notifications-read";

export function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persistReadIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
}

export function markNotificationRead(id: string) {
  const ids = loadReadIds();
  ids.add(id);
  persistReadIds(ids);
}

export function markAllNotificationsRead(allIds: string[]) {
  const ids = loadReadIds();
  allIds.forEach((id) => ids.add(id));
  persistReadIds(ids);
}
