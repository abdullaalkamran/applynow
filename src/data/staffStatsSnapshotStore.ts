interface Snapshot {
  date: string; // YYYY-MM-DD the snapshot was taken
  values: Record<string, number>;
}

function keyFor(namespace: string): string {
  return `staff-stats-snapshot:${namespace}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadSnapshot(namespace: string): Snapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(namespace));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

/**
 * Real (not fabricated) trend deltas: compares today's stat values against the last snapshot
 * taken on a *different* day, then records today's values for tomorrow's comparison. On the
 * first-ever run (no prior snapshot), there's nothing honest to compare against yet, so callers
 * get `null` and should render that as "New" rather than inventing a percentage. `namespace`
 * keeps unrelated dashboards (counsellor, agent, …) from overwriting each other's snapshot under
 * the same metric names.
 */
export function getStatTrends(currentValues: Record<string, number>, namespace: string = "counsellor"): Record<string, number | null> {
  const snapshot = loadSnapshot(namespace);
  const trends: Record<string, number | null> = {};

  const compareAgainst = snapshot && snapshot.date !== today() ? snapshot.values : null;

  for (const key of Object.keys(currentValues)) {
    const prev = compareAgainst?.[key];
    if (prev === undefined || prev === 0) {
      trends[key] = null;
    } else {
      trends[key] = Math.round(((currentValues[key] - prev) / prev) * 100);
    }
  }

  if (typeof window !== "undefined" && (!snapshot || snapshot.date !== today())) {
    window.localStorage.setItem(keyFor(namespace), JSON.stringify({ date: today(), values: currentValues }));
  }

  return trends;
}
