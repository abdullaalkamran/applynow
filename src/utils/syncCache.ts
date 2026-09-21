// Shared plumbing for the "synchronous cache backed by a real API" pattern used by the stores
// migrated to Postgres (applicationsStore, applicationJourneyStore, tasksStore, messagesStore,
// agentStudentsStore, counsellorStudentsStore, staffStore, allStudentsStore).
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
import { useEffect, useRef, useState } from "react";

const listeners = new Set<() => void>();

// Bumped on every cache change — lets a component that mounts (and subscribes) *after* a change
// already happened catch up, instead of only reacting to changes that happen after it started
// listening. This matters on a full page reload: AuthContext kicks off warmCaches() as soon as
// fetchMe() resolves, but the shell that calls useCacheSync() (AppLayout/StudentShell/etc.) only
// mounts — and only then registers its subscription — once React finishes committing that state
// update. A fast local fetch can resolve and call notifyCacheChange() in that gap, before any
// listener exists to hear it; without this counter that update is lost and the page is stuck
// showing the empty first-render state forever, even though the cache itself did get populated.
let version = 0;

// While a hold is active, cache changes still land in the stores (and still bump `version`) but
// the shells aren't told — so the routed page isn't remounted out from under an open modal. See
// useHoldCacheSync() below.
let holds = 0;
let changedWhileHeld = false;

/** Call after any store's cache is mutated (initial load or after a write) so subscribed shells
 * re-render with fresh data. */
export function notifyCacheChange() {
  version++;
  if (holds > 0) {
    changedWhileHeld = true;
    return;
  }
  listeners.forEach((l) => l());
}

/** Pauses the page remount that notifyCacheChange() normally triggers, for as long as the calling
 * component is mounted; any change that happened meanwhile is delivered the moment it unmounts.
 *
 * Why: the shells key their `<Outlet>` on the cache tick (see useCacheSync), so *every* cache
 * change remounts the current page and resets all of its local state — including whichever modal
 * it had open. A modal that itself writes to a store (the student ApplyModal creating an
 * application) would therefore be unmounted by its own successful save, before it could show its
 * confirmation screen; the 12s background poll can do the same to any modal mid-flow. Mount this
 * inside such a modal.
 *
 * `active` lets an inline form (always mounted, but only sometimes being edited) hold just while
 * it's open — e.g. the Dashboard's Financial Readiness card, which otherwise snapped shut and
 * dropped half-typed values on the next poll. When it flips back to false the deferred change
 * is delivered then. */
export function useHoldCacheSync(active = true) {
  useEffect(() => {
    if (!active) return;
    holds++;
    return () => {
      holds--;
      if (holds === 0 && changedWhileHeld) {
        changedWhileHeld = false;
        listeners.forEach((l) => l());
      }
    };
  }, [active]);
}

/** Cheap structural-equality check for a background refresh's fetched array against what's
 * already cached — used by every store's refreshX() so periodic polling (see warmCaches.ts's
 * startCachePolling) only calls notifyCacheChange(), and so only remounts the current page (per
 * useCacheSync's doc comment above), when something actually changed. Without this, polling every
 * few seconds would remount — and reset all local UI state on — every open page that often,
 * whether or not another account had actually changed anything. */
export function cacheChanged<T>(next: T[], current: T[]): boolean {
  if (next.length !== current.length) return true;
  // Order-insensitive: Postgres is free to return the same rows in a different physical order
  // after an update, and a list that merely re-ordered must not count as "changed" — that would
  // remount the open page (dropping scroll position and half-typed input) for nothing.
  return JSON.stringify(sortedForCompare(next)) !== JSON.stringify(sortedForCompare(current));
}

function sortedForCompare<T>(rows: T[]): T[] {
  const key = (row: T): string => {
    const r = row as Record<string, unknown>;
    return String(r.id ?? r.studentId ?? r.applicationId ?? r.universityId ?? r.threadId ?? JSON.stringify(row));
  };
  return [...rows].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/** Mounted once per role shell (AppLayout, StudentShell, CounsellorShell, AgentShell). Returns a
 * tick number that changes whenever any migrated store's cache changes — the shell must put this
 * on the `<Outlet key={tick} />` it renders (not just let the returned re-render happen on its
 * own). React Router's `<Outlet />` memoizes its rendered child against the current route match,
 * so a shell re-rendering from its own local state does NOT, on its own, re-render the routed page
 * underneath — confirmed by tracing an actual reload: the shell re-rendered on every cache
 * update, but the page component's own render never fired again. Keying the Outlet forces a
 * remount of the current route's content when the cache changes, which is the only thing that
 * reliably gets components reading a store directly in their render body (the pre-migration
 * pattern, used all over the app) to pick up data that arrived after their own last render. */
export function useCacheSync(): number {
  const [tick, setTick] = useState(0);
  const lastSeenVersion = useRef(version);

  useEffect(() => {
    // Catch up on any change that landed between this component's first render and this effect
    // registering its subscription (e.g. warmCaches() resolving before mount completes).
    if (version !== lastSeenVersion.current) {
      lastSeenVersion.current = version;
      setTick((t) => t + 1);
    }

    const listener = () => {
      lastSeenVersion.current = version;
      setTick((t) => t + 1);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return tick;
}
