// Human-readable, unique tracking numbers for students and applications — distinct from the
// internal `id` (used for routing/lookups). Seeded records get a stable number from their
// position in mockData; anything created later (new student, new application) is assigned the
// next number the first time it's formatted and that assignment is persisted, so the same
// record always shows the same ID and no two records ever collide.

import { STUDENTS, APPLICATIONS } from "../data/mockData";

function makeIdFormatter(prefix: string, seedIds: string[], storageKey: string) {
  const seedIndex = new Map(seedIds.map((id, i) => [id, i + 1]));

  function loadCounterMap(): Record<string, number> {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  }

  function saveCounterMap(map: Record<string, number>) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(map));
  }

  return function formatId(id: string): string {
    const seeded = seedIndex.get(id);
    if (seeded) return `${prefix}-${String(seeded).padStart(4, "0")}`;

    const map = loadCounterMap();
    if (map[id]) return `${prefix}-${String(map[id]).padStart(4, "0")}`;

    const nextNum = seedIds.length + Object.keys(map).length + 1;
    map[id] = nextNum;
    saveCounterMap(map);
    return `${prefix}-${String(nextNum).padStart(4, "0")}`;
  };
}

export const formatStudentId = makeIdFormatter("STU", STUDENTS.map((s) => s.id), "sd-student-id-counters");
export const formatApplicationId = makeIdFormatter("APP", APPLICATIONS.map((a) => a.id), "sd-application-id-counters");
