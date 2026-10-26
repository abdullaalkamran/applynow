import { useEffect, useState } from "react";
import { getUniversityById } from "./universityCatalogStore";
import { apiGet } from "../utils/apiClient";
import type { University } from "../types";

/** One university by id for a detail page. Uses the cached catalog when it has it; otherwise fetches just this university
 * (a single small request) instead of showing "not found" — or sitting blank — until the whole multi-megabyte catalog has
 * downloaded, which on a slow connection or a busy server looked like the page timing out. */
export function useUniversity(id: string | undefined): { university: University | undefined; loading: boolean } {
  const cached = id ? getUniversityById(id) : undefined;
  const [fetched, setFetched] = useState<University | undefined>(undefined);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!id || cached) return;
    let cancelled = false;
    apiGet<University>(`/api/universities/${encodeURIComponent(id)}`)
      .then((u) => { if (!cancelled) setFetched(u); })
      .catch(() => { /* a 404 or a network failure both end as "not found" below */ })
      .finally(() => { if (!cancelled) setSettled(true); });
    return () => { cancelled = true; };
  }, [id, cached]);

  const university = cached ?? fetched;
  return { university, loading: !university && !settled };
}
