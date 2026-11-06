import { useEffect, useState } from "react";
import { peekUniversityById, hydrateUniversity } from "./universityCatalogStore";
import { apiGet } from "../utils/apiClient";
import { publicGet } from "./blogApi";
import { usePublicMode } from "./publicMode";
import type { University } from "../types";

/** One university by id for a detail page. Uses the cached catalog when it has it; otherwise fetches just this university
 * (a single small request) instead of showing "not found" — or sitting blank — until the whole multi-megabyte catalog has
 * downloaded, which on a slow connection or a busy server looked like the page timing out. */
export function useUniversity(id: string | undefined): { university: University | undefined; loading: boolean } {
  // Logged-out visitors never touch the signed-in catalog cache: they fetch the one university from the public endpoint.
  const pub = usePublicMode();
  const cached = id && !pub ? peekUniversityById(id) : undefined;
  const [fetched, setFetched] = useState<University | undefined>(undefined);
  const [settled, setSettled] = useState(false);

  const needsCourses = cached?.coursesLoaded === false;
  useEffect(() => {
    if (id && needsCourses) hydrateUniversity(id).catch(() => { /* the full catalog load will still fill it in */ });
  }, [id, needsCourses]);

  useEffect(() => {
    if (!id || cached) return;
    let cancelled = false;
    (pub ? publicGet<University>(`/api/public/universities/${encodeURIComponent(id)}`) : apiGet<University>(`/api/universities/${encodeURIComponent(id)}`))
      .then((u) => { if (!cancelled) setFetched(u); })
      .catch(() => { /* a 404 or a network failure both end as "not found" below */ })
      .finally(() => { if (!cancelled) setSettled(true); });
    return () => { cancelled = true; };
  }, [id, cached, pub]);

  const university = cached ?? fetched;
  return { university, loading: needsCourses || (!university && !settled) };
}
