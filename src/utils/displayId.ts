// Human-readable, unique tracking numbers for students and applications — distinct from the
// internal `id` (used for routing/lookups). Anything created (new student, new application) is assigned the
// next number the first time it's formatted and that assignment is persisted, so the same
// record always shows the same ID and no two records ever collide.

// `offset` keeps numbers already handed out on this browser (when 12 demo students were counted first) from being reused.
function makeIdFormatter(prefix: string, offset: number, storageKey: string) {

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
    const map = loadCounterMap();
    if (map[id]) return `${prefix}-${String(map[id]).padStart(4, "0")}`;

    const nextNum = offset + Object.keys(map).length + 1;
    map[id] = nextNum;
    saveCounterMap(map);
    return `${prefix}-${String(nextNum).padStart(4, "0")}`;
  };
}

export const formatStudentId = makeIdFormatter("STU", 12, "sd-student-id-counters");
export const formatApplicationId = makeIdFormatter("APP", 0, "sd-application-id-counters");
