// One public country page — the same layout as the student's country page (hero, Overview / Universities / Courses / Subjects
// tabs, same cards), for visitors who aren't signed in. Data: the country guide + summary from /api/public/countries/:slug, and the
// university and course lists from the same public search the Explore pages use.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GraduationCap, BookOpen, ChevronRight, Wallet } from "lucide-react";
import { PublicShell } from "./PublicPages";
import { LogoBadge, Pagination } from "../../components/ui/mobile";
import { NeuTabs } from "../../components/ui/NeuTabs";
import { CountryHero, CountryOverviewCards } from "../../components/CountryOverview";
import { CountryGuideDisclosure } from "../../components/CountryGuideSection";
import { setPageMeta } from "../../utils/pageMeta";
import { courseFeeText } from "../../utils/courseFee";
import { emptyFilters } from "../../utils/universityFilter";
import { fetchPublicCountry, type PublicCountryDetail } from "../../data/countryPagesApi";
import { searchPrograms, searchUniversities, toSearchFilters, asUniversity, asCourse, type CardUniversity, type ProgramRow } from "../../data/catalogSearchApi";
import { seedCountries } from "../../data/countryRegistry";
import { loadPublicReference } from "../../data/publicMode";
import type { University } from "../../types";

const TABS = ["Overview", "Universities", "Courses", "Subjects"] as const;
const PAGE_SIZE = 20;
const uniPath = (u: { id: string; slug?: string }) => `/universities/${encodeURIComponent(u.slug ?? u.id)}`;

/** One server page of the public search for this country; the previous page stays until the next arrives. */
function useCountrySearch<T>(destinations: string[] | null, view: "universities" | "courses", enabled: boolean) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: T[]; total: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const key = destinations?.join("|") ?? "";
  useEffect(() => { setPage(1); setData(null); }, [key]);
  useEffect(() => {
    if (!enabled || !destinations) return;
    let cancelled = false;
    setFailed(false);
    const params = { view, q: "", filters: toSearchFilters({ ...emptyFilters(), destination: new Set(destinations) }), sort: view === "universities" ? ("rank" as const) : ("best" as const), sortCurrency: "", page, limit: PAGE_SIZE };
    const run = view === "universities" ? searchUniversities(params, true) : searchPrograms(params, true);
    (run as unknown as Promise<{ items: T[]; total: number }>).then((r) => { if (!cancelled) setData({ items: r.items, total: r.total }); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `destinations`
  }, [enabled, key, view, page]);
  return { page, setPage, data, failed, totalPages: Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE)) };
}

export default function PublicCountry() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<PublicCountryDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "failed">("loading");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setState("loading");
    void loadPublicReference();
    fetchPublicCountry(slug, controller.signal)
      .then((d) => {
        seedCountries([d.country]);
        setDetail(d); setState("ready");
        // An id- or name-style address becomes the readable one, on the same page.
        if (d.slug !== slug) navigate(`/countries/${encodeURIComponent(d.slug)}`, { replace: true });
      })
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setState((e as { status?: number })?.status === 404 ? "missing" : "failed"); });
    return () => controller.abort();
  }, [slug, navigate]);

  const name = detail?.country.name ?? "";
  useEffect(() => {
    if (!detail) return;
    const c = detail.country;
    return setPageMeta(`Study in ${c.name}: Universities, Fees & Courses — UnifinderAi`,
      [c.tagline, c.whyThisCountry, `${detail.universityCount} partner universities and ${detail.courseCount} courses on UnifinderAi.`].filter(Boolean).join(" "), `/countries/${detail.slug}`);
  }, [detail]);

  const unis = useCountrySearch<CardUniversity>(detail?.destinations ?? null, "universities", tab === "Universities");
  const courses = useCountrySearch<ProgramRow>(detail?.destinations ?? null, "courses", tab === "Courses");
  const overviewUniversities = useMemo(() => (detail?.topUniversities ?? []).map((u) => ({ id: u.id, name: u.name, worldRank: u.worldRank }) as unknown as University), [detail]);

  return (
    <PublicShell>
      <div className="pb-10 lg:mx-auto lg:max-w-6xl">
        <div className="px-5 pt-2">
          {state === "loading" && <div className="h-52 animate-pulse rounded-2xl bg-neutral-200/70" />}
          {state === "missing" && <p className="py-10 text-neutral-500">This country doesn't exist or is no longer available. <Link to="/countries" className="font-medium text-neutral-900 underline">See all countries</Link></p>}
          {state === "failed" && <p className="py-10 text-neutral-500">We couldn't load this country right now. Please try again in a moment.</p>}

          {state === "ready" && detail && (
            <>
              <CountryHero
                country={name}
                countryDetails={detail.country}
                actions={<button onClick={() => setTab("Universities")} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-white/90">Explore Universities</button>}
              />
              <p className="mt-3 text-[13px] text-neutral-500">
                {detail.universityCount} {detail.universityCount === 1 ? "university" : "universities"} · {detail.courseCount.toLocaleString("en-US")} {detail.courseCount === 1 ? "program" : "programs"}
              </p>
              <NeuTabs tabs={TABS} value={tab} onChange={setTab} ariaLabel="Sections" className="mt-4" />

              {tab === "Overview" && (
                <div className="mt-4">
                  <CountryOverviewCards
                    country={name}
                    countryDetails={detail.country}
                    universities={overviewUniversities}
                    subjectCounts={detail.subjectCounts}
                    onOpenUniversity={(id) => { const u = detail.topUniversities.find((x) => x.id === id); if (u) navigate(uniPath(u)); }}
                    onViewAllUniversities={() => setTab("Universities")}
                    onViewAllSubjects={() => setTab("Subjects")}
                  />
                  <div className="mt-5"><CountryGuideDisclosure country={detail.country} /></div>
                </div>
              )}

              {tab === "Universities" && (
                <div className="mt-4 space-y-2.5">
                  {unis.data === null && !unis.failed && [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-neutral-200/70" />)}
                  {unis.failed && <p className="text-sm text-neutral-500">We couldn't load the universities right now. Please try again in a moment.</p>}
                  {unis.data?.items.map((u) => (
                    <Link key={u.id} to={uniPath(u)} className="flex w-full items-center gap-3 rounded-2xl bg-[var(--sd-card)] p-4 text-left shadow-neu">
                      <LogoBadge name={u.name} logoUrl={u.logoUrl} className="h-12 w-12 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">{u.name}</p>
                        <p className="truncate text-xs text-neutral-400">{u.city}, {u.country}</p>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-neutral-500">
                          <span className="inline-flex items-center gap-1"><GraduationCap size={11} /> {u.worldRank} world rank</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-neutral-300" />
                    </Link>
                  ))}
                  {unis.data?.items.length === 0 && <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-neu"><p className="text-sm font-medium text-neutral-700">No universities in {name} yet</p></div>}
                  <Pagination page={unis.page} totalPages={unis.totalPages} onChange={unis.setPage} />
                </div>
              )}

              {tab === "Courses" && (
                <div className="mt-4 space-y-2.5">
                  {courses.data === null && !courses.failed && [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-neutral-200/70" />)}
                  {courses.failed && <p className="text-sm text-neutral-500">We couldn't load the courses right now. Please try again in a moment.</p>}
                  {courses.data?.items.map(({ university: u, course: c }) => (
                    <Link key={`${u.id}::${c.id}`} to={`${uniPath(u)}/courses/${encodeURIComponent(c.slug ?? c.id)}`} className="flex w-full items-center gap-3 rounded-2xl bg-[var(--sd-card)] p-4 text-left shadow-neu">
                      <LogoBadge name={u.name} logoUrl={u.logoUrl} className="h-12 w-12 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">{c.name}</p>
                        <p className="truncate text-xs text-neutral-400">{u.name} · {c.level} · {c.duration}</p>
                        <p className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-neutral-700"><Wallet size={11} className="text-neutral-400" /> {courseFeeText(asUniversity(u), asCourse(c)).perYear}</p>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-neutral-300" />
                    </Link>
                  ))}
                  {courses.data?.items.length === 0 && <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-neu"><p className="text-sm font-medium text-neutral-700">No courses listed in {name} yet</p></div>}
                  <Pagination page={courses.page} totalPages={courses.totalPages} onChange={courses.setPage} />
                </div>
              )}

              {tab === "Subjects" && (
                <div className="mt-4 space-y-2.5">
                  {detail.subjectCounts.map(({ subject, count }) => (
                    <div key={subject} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-[var(--sd-card)] p-4 shadow-neu">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sd-card)] text-neutral-900 shadow-neu-inset-sm"><BookOpen size={16} /></div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-900">{subject}</p>
                          <p className="text-xs text-neutral-400">{count} program{count === 1 ? "" : "s"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {detail.subjectCounts.length === 0 && <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-neu"><p className="text-sm font-medium text-neutral-700">No subjects listed yet</p></div>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
