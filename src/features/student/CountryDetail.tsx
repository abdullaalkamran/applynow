// Mirrors UniversityDetail.tsx's tabbed layout — country is the fixed dimension, with a persistent
// hero (CountryHero) above three tabs: "Overview" (the rich country profile), "Universities" (a
// clean per-university directory — every course/program browse belongs on the "Subjects" tab
// instead, so this tab isn't showing the same course list twice under two different names), and
// "Subjects" (every distinct field of study offered here).
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, GraduationCap, BookOpen, ChevronRight, Wallet } from "lucide-react";
import { LogoBadge, Pagination } from "../../components/ui/mobile";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { getCountryByName } from "../../data/countryRegistry";
import { CountryGuideDisclosure } from "../../components/CountryGuideSection";
import { CountryHero, CountryOverviewCards } from "../../components/CountryOverview";
import { NeuTabs } from "../../components/ui/NeuTabs";
import { courseFeeText } from "../../utils/courseFee";
import { usePagedList } from "../../utils/usePagedList";

const TABS = ["Overview", "Universities", "Courses", "Subjects"] as const;

export default function CountryDetail() {
  const { country: countryParam } = useParams();
  const navigate = useNavigate();
  const country = decodeURIComponent(countryParam ?? "");

  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  const universities = useMemo(() => getAllUniversities().filter((u) => u.country === country), [country]);
  const countryDetails = useMemo(() => getCountryByName(country), [country]);
  const totalCourses = useMemo(() => universities.reduce((sum, u) => sum + u.courses.length, 0), [universities]);

  const subjectCounts = useMemo(() => {
    const counts = new Map<string, number>();
    universities.forEach((u) => u.courses.forEach((c) => counts.set(c.subject, (counts.get(c.subject) ?? 0) + 1)));
    return Array.from(counts.entries()).map(([subjectName, count]) => ({ subject: subjectName, count })).sort((a, b) => b.count - a.count);
  }, [universities]);

  const courseOfferings = useMemo(
    () => universities.flatMap((u) => u.courses.map((c) => ({ university: u, course: c }))),
    [universities]
  );
  // 30 courses per page — a country can hold thousands, too many to render at once.
  const { page: coursePage, setPage: setCoursePage, totalPages: courseTotalPages, pageItems: pagedCourses } = usePagedList(courseOfferings, 30, country);

  function openUniversityProfile(universityId: string) {
    navigate(`/student/universities/${universityId}`);
  }

  function openCourse(universityId: string, courseName: string) {
    navigate(`/student/universities/${universityId}`, { state: { selectedCourseName: courseName } });
  }

  function openSubject(subjectName: string) {
    navigate(`/student/subjects/${encodeURIComponent(subjectName)}`, { state: { destination: country } });
  }

  return (
    <div className="pb-6">
      <div className="lg:mx-auto lg:max-w-6xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h1 className="text-[15px] font-bold text-neutral-900">UnifinderAi</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/student/search")}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-neutral-600 shadow-neu-sm"
            >
              <Search size={16} />
            </button>
          </div>
        </div>

        <div className="px-5">
          <CountryHero
            country={country}
            countryDetails={countryDetails}
            actions={
              <button
                onClick={() => setTab("Universities")}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-white/90"
              >
                Explore Universities
              </button>
            }
          />
          <p className="mt-3 text-[13px] text-neutral-500">
            {universities.length} {universities.length === 1 ? "university" : "universities"} · {totalCourses} {totalCourses === 1 ? "program" : "programs"}
          </p>

          <NeuTabs tabs={TABS} value={tab} onChange={setTab} ariaLabel="Sections" className="mt-4" />
        </div>

        {tab === "Overview" && (
          <div className="mt-4 px-5">
            <CountryOverviewCards
              country={country}
              countryDetails={countryDetails}
              universities={universities}
              subjectCounts={subjectCounts}
              onOpenUniversity={openUniversityProfile}
              onViewAllUniversities={() => setTab("Universities")}
              onViewAllSubjects={() => setTab("Subjects")}
            />
            <div className="mt-5">
              <CountryGuideDisclosure country={countryDetails} />
            </div>
          </div>
        )}

        {tab === "Courses" && (
          <div className="mt-4 space-y-2.5 px-5">
            {pagedCourses.map(({ university: u, course: c }) => (
              <button
                key={`${u.id}::${c.name}`}
                onClick={() => openCourse(u.id, c.name)}
                className="flex w-full items-center gap-3 rounded-2xl bg-[var(--sd-card)] p-4 text-left shadow-neu"
              >
                <LogoBadge name={u.name} tone={u.tone} logoUrl={u.logoUrl} className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{c.name}</p>
                  <p className="truncate text-xs text-neutral-400">{u.name} · {c.level} · {c.duration}</p>
                  <p className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-neutral-700">
                    <Wallet size={11} className="text-neutral-400" /> {courseFeeText(u, c).perYear}
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-neutral-300" />
              </button>
            ))}
            {courseOfferings.length === 0 && (
              <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-neu">
                <p className="text-sm font-medium text-neutral-700">No courses listed in {country} yet</p>
              </div>
            )}
            <Pagination page={coursePage} totalPages={courseTotalPages} onChange={setCoursePage} />
          </div>
        )}

        {tab === "Subjects" && (
          <div className="mt-4 space-y-2.5 px-5">
            {subjectCounts.map(({ subject: subjectName, count }) => (
              <button
                key={subjectName}
                onClick={() => openSubject(subjectName)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-[var(--sd-card)] p-4 text-left shadow-neu"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sd-card)] shadow-neu-inset-sm text-neutral-900">
                    <BookOpen size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{subjectName}</p>
                    <p className="text-xs text-neutral-400">{count} program{count === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-neutral-300" />
              </button>
            ))}
            {subjectCounts.length === 0 && (
              <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-neu">
                <p className="text-sm font-medium text-neutral-700">No subjects listed yet</p>
              </div>
            )}
          </div>
        )}

        {tab === "Universities" && (
          <div className="mt-4 space-y-2.5 px-5">
            {universities.map((u) => (
              <button
                key={u.id}
                onClick={() => openUniversityProfile(u.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-[var(--sd-card)] p-4 text-left shadow-neu"
              >
                <LogoBadge name={u.name} tone={u.tone} logoUrl={u.logoUrl} className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{u.name}</p>
                  <p className="truncate text-xs text-neutral-400">{u.city}, {u.country}</p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-neutral-500">
                    <span className="inline-flex items-center gap-1"><GraduationCap size={11} /> {u.worldRank} world rank</span>
                    <span className="inline-flex items-center gap-1"><BookOpen size={11} /> {u.courses.length} course{u.courses.length === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-neutral-300" />
              </button>
            ))}
            {universities.length === 0 && (
              <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-neu">
                <p className="text-sm font-medium text-neutral-700">No universities in {country} yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
