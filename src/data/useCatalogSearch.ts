import { useEffect, useRef, useState } from "react";
import { usePreservedState } from "../utils/syncCache";
import {
  fetchFacets, searchPrograms, searchUniversities, toSearchFilters,
  type CardUniversity, type Facets, type ProgramRow, type SearchFilters, type SearchPage, type SortBy,
} from "./catalogSearchApi";
import type { UniversityFilterState } from "../utils/universityFilter";

export const SEARCH_DEBOUNCE_MS = 300;

// JSON.stringify drops a Set's members ({}), so list them out.
export const filterStateKey = (f: UniversityFilterState) => JSON.stringify(f, (_k, v) => (v instanceof Set ? [...v] : v));

/** `value`, but only after it has stopped changing for `ms` — so typing in a search box sends one request, not one per key. */
export function useDebounced<T>(value: T, ms = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** One failed attempt is retried once — a busy shared host answers 503 now and then. */
async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if ((err as Error)?.name === "StaleSessionError") throw err;
    await new Promise((r) => setTimeout(r, 800));
    return run();
  }
}

interface PageOptions {
  enabled: boolean;
  view: "courses" | "universities";
  query: string;
  filters: UniversityFilterState;
  sort: SortBy;
  sortCurrency: string;
  shortlistKeys?: string[];
  pageSize: number;
  /** Keeps the page number across a cache-driven rebuild of the screen (see syncCache.ts). */
  persistKey: string;
}

/** One server page of search results, with the same shape the screens already used from usePagedList. Filters/search text are
 * debounced; a new search returns to page 1; the previous page stays on screen until the next one arrives. */
export function useCatalogPage<T extends ProgramRow | CardUniversity>(o: PageOptions) {
  const [page, setPage] = usePreservedState(o.persistKey, 1);
  const key = JSON.stringify({ v: o.view, q: o.query, f: filterStateKey(o.filters), s: o.sort, c: o.sortCurrency, k: o.shortlistKeys });
  const settledKey = useDebounced(key);
  const latest = useRef(o);
  useEffect(() => { latest.current = o; });
  const [nonce, setNonce] = useState(0);

  const [data, setData] = useState<SearchPage<T> | null>(null);
  const [loading, setLoading] = useState(o.enabled);
  const [error, setError] = useState(false);
  const lastKey = useRef(settledKey);
  const seq = useRef(0);

  useEffect(() => {
    if (!o.enabled) return;
    // A different search returns to page 1 (but not on the first run after a rebuild, which keeps the saved page).
    if (lastKey.current !== settledKey) {
      lastKey.current = settledKey;
      if (page !== 1) { setPage(1); return; }
    }
    const mine = ++seq.current;
    const cur = latest.current;
    const params = {
      view: cur.view, q: cur.query, filters: toSearchFilters(cur.filters) as SearchFilters, sort: cur.sort,
      sortCurrency: cur.sortCurrency, page, limit: cur.pageSize, shortlistKeys: cur.shortlistKeys,
    };
    setLoading(true);
    setError(false);
    withRetry<SearchPage<ProgramRow | CardUniversity>>(() => (cur.view === "courses" ? searchPrograms(params) : searchUniversities(params)))
      .then((res) => {
        if (mine !== seq.current) return; // a newer search is already on its way
        setData(res as SearchPage<T>);
        setLoading(false);
        if (res.page !== page) setPage(res.page); // the server clamped an out-of-range page
      })
      .catch((err) => {
        if (mine !== seq.current || (err as Error)?.name === "StaleSessionError") return;
        setError(true);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the settled search + page; the rest is read from `latest`
  }, [settledKey, page, o.enabled, nonce]);

  const total = data?.total ?? 0;
  return {
    items: data?.items ?? [],
    total,
    totalPages: Math.max(1, Math.ceil(total / o.pageSize)),
    page,
    setPage,
    loading,
    error,
    currencies: data?.currencies ?? [],
    /** Runs the same search again (the "Try again" button after a failure). */
    reload: () => setNonce((n) => n + 1),
    /** True until the first response has arrived. */
    initialLoading: loading && data === null,
  };
}

/** The dropdown options for the chosen filters (each list leaves out its own selection), fetched debounced. */
export function useCatalogFacets(filters: UniversityFilterState, enabled = true): Facets | null {
  const key = useDebounced(filterStateKey(filters));
  const [facets, setFacets] = useState<Facets | null>(null);
  const seq = useRef(0);
  const latest = useRef(filters);
  useEffect(() => { latest.current = filters; });
  useEffect(() => {
    if (!enabled) return;
    const mine = ++seq.current;
    withRetry(() => fetchFacets(toSearchFilters(latest.current)))
      .then((res) => { if (mine === seq.current) setFacets(res); })
      .catch(() => { /* keep the previous options; the dropdowns still show what is selected */ });
  }, [key, enabled]);
  return facets;
}
