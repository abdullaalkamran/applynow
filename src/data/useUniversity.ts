import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const cachedId = cached?.id;
  useEffect(() => {
    if (cachedId && needsCourses) hydrateUniversity(cachedId).catch(() => { /* the full catalog load will still fill it in */ });
  }, [cachedId, needsCourses]);

  useEffect(() => {
    if (!id || cached) return;
    // Already holding this university (the address just changed from its id to its readable name): nothing to fetch.
    if (fetched && (fetched.id === id || fetched.slug === id)) return;
    let cancelled = false;
    (pub ? publicGet<University>(`/api/public/universities/${encodeURIComponent(id)}`) : apiGet<University>(`/api/universities/${encodeURIComponent(id)}`))
      .then((u) => { if (!cancelled) setFetched(u); })
      .catch(() => { /* a 404 or a network failure both end as "not found" below */ })
      .finally(() => { if (!cancelled) setSettled(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fetched` is only read to skip a pointless refetch
  }, [id, cached, pub]);

  const university = cached ?? fetched;

  // Signed-in pages: an id-style address (/student/universities/u-custom-abc) is replaced by the readable one
  // (/student/universities/bpp-university) as soon as the university's name is known. Same page, same state.
  const navigate = useNavigate();
  const location = useLocation();
  const slug = university?.slug;
  useEffect(() => {
    if (pub || !id || !slug || id === slug) return;
    const m = location.pathname.match(/^(.*\/universities\/)([^/]+)$/);
    if (m && decodeURIComponent(m[2]) === id) navigate(`${m[1]}${encodeURIComponent(slug)}`, { replace: true, state: location.state });
  }, [pub, id, slug, location.pathname, location.state, navigate]);

  return { university, loading: needsCourses || (!university && !settled) };
}
