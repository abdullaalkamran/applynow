export interface StaffMessageSeed {
  id: string;
  studentId: string;
  preview: string;
  time: string;
  unreadSeed: number;
}

// Seeded against the counsellor's real assigned students.
const SEED: StaffMessageSeed[] = [
  { id: "sm1", studentId: "s1", preview: "Thank you for the guidance!", time: "10:24 AM", unreadSeed: 2 },
  { id: "sm2", studentId: "s2", preview: "I have uploaded the documents.", time: "09:18 AM", unreadSeed: 1 },
  { id: "sm3", studentId: "s3", preview: "Can we schedule a call tomorrow?", time: "Yesterday", unreadSeed: 0 },
];

const READ_KEY = "staff-messages-read";

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function markMessageRead(id: string) {
  if (typeof window === "undefined") return;
  const ids = loadReadIds();
  ids.add(id);
  window.localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
}

export interface StaffMessage extends StaffMessageSeed {
  unread: number;
}

export function getStaffMessages(): StaffMessage[] {
  const readIds = loadReadIds();
  return SEED.map((m) => ({ ...m, unread: readIds.has(m.id) ? 0 : m.unreadSeed }));
}

export function unreadStaffMessageCount(): number {
  return getStaffMessages().reduce((sum, m) => sum + m.unread, 0);
}
