import { useEffect, useRef, useState } from "react";
import { usePreservedState } from "./syncCache";

/** Slices an already-loaded array into pages of `pageSize` — purely a display concern, since every
 * list this backs is already fetched in full into a client-side cache (see universityCatalogStore.ts
 * and friends). Pass `resetKey` as whatever identifies the current search/filter state (e.g. a
 * query string, or the filter object itself) so changing it snaps back to page 1 — otherwise
 * narrowing a search while on page 5 of the old results could land on an empty page. `page` is
 * clamped to the valid range regardless, as a safety net for any other way the list can shrink. */
export function usePagedList<T>(items: T[], pageSize = 30, resetKey?: unknown, persistKey?: string) {
  // With a persistKey the page number survives the page being rebuilt by a cache refresh (see syncCache.ts), so a background
  // data update doesn't send the student back to page 1.
  const local = useState(1);
  const kept = usePreservedState(persistKey ?? "paged:unused", 1);
  const [page, setPage] = persistKey ? kept : local;

  // Reset to page 1 only when the search/filter actually CHANGES — not on the first run after a rebuild.
  const lastKey = useRef(resetKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on the caller's own resetKey, not on `items`
  useEffect(() => {
    if (lastKey.current !== resetKey) {
      lastKey.current = resetKey;
      setPage(1);
    }
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    setPage,
    totalPages,
    pageItems: items.slice(start, start + pageSize),
    totalItems: items.length,
  };
}
