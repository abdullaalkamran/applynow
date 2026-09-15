// Shared plumbing for the "synchronous cache backed by a real API" pattern used by the stores
// migrated to Postgres (applicationsStore, applicationJourneyStore, tasksStore, messagesStore,
// agentStudentsStore, counsellorStudentsStore, staffStore).
//
// Why this exists: dozens of call sites read these stores synchronously (`getAllApplications()`
// used directly in a component's render body, or inside plain non-React functions like the AI
// tool registry and taskBoard.ts's aggregation logic, where React hooks can't be used at all).
// Converting every one of those to `await` would cascade async through the entire AI
// tool-calling call graph — a much larger, riskier rewrite. Instead, each store keeps an
// in-memory cache that's warmed from the real API in the background and kept current after every
// mutation; reads stay synchronous exactly as they were against localStorage, just backed by
// Postgres instead. The trade-off (documented in the migration plan): a brief empty/stale window
// right after login before the first fetch resolves, and no cross-tab live sync — acceptable for
// this app's actual usage pattern, and a much smaller, lower-risk change than a full async rewrite.
import { useEffect, useState } from "react";

const listeners = new Set<() => void>();

/** Call after any store's cache is mutated (initial load or after a write) so subscribed shells
 * re-render with fresh data. */
export function notifyCacheChange() {
  listeners.forEach((l) => l());
}

/** Mounted once per role shell (AppLayout, StudentShell, CounsellorShell, AgentShell) — forces
 * that shell's subtree to re-render whenever any migrated store's cache changes, so components
 * reading a store directly in their render body (the existing, pre-migration pattern) pick up
 * data that arrived after their own last render without needing to know anything about caching. */
export function useCacheSync() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
