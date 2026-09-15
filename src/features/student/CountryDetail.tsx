// Mirrors SubjectDetail.tsx exactly — country is the fixed dimension instead of subject, and the
// "Destination" pill is dropped since it would just re-filter down to the same one country. The
// title/subtitle doubles as the country overview (universities + programs count).
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, SlidersHorizontal, Wallet, CalendarDays, GraduationCap, Building2, ChevronRight, Bookmark, ArrowUpRight } from "lucide-react";
import { LogoBadge, PillSelect } from "../../components/ui/mobile";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { scholarshipAmountUSD, FEE_BANDS, feeBandMax } from "../../utils/universityFilter";
import { ApplyModal } from "./ApplyModal";
import { isShortlisted as isProgramShortlisted, toggleShortlisted } from "../../data/shortlistStore";
import type { University } from "../../types";

export default function CountryDetail() {
  const { country: countryParam } = useParams();
  const navigate = useNavigate();
  const country = decodeURIComponent(countryParam ?? "");

  const [subject, setSubject] = useState("");
  const [intake, setIntake] = useState("");
  const [feeBand, setFeeBand] = useState("");
  const [scholarship, setScholarship] = useState("");
  const [, setShortlistTick] = useState(0);
  const [applyTarget, setApplyTarget] = useState<{ university: University; course: University["courses"][number] } | null>(null);

  function toggleShortlist(key: string) {
    toggleShortlisted(key);
    setShortlistTick((t) => t + 1);
  }

  const universities = useMemo(() => getAllUniversities().filter((u) => u.country === country), [country]);
  const allOfferings = useMemo(
    () => universities.flatMap((u) => u.courses.map((c) => ({ university: u, course: c }))),
    [universities]
  );

  const subjectOptions = useMemo(() => Array.from(new Set(allOfferings.map((o) => o.course.subject))).sort(), [allOfferings]);
  const intakeOptions = useMemo(() => Array.from(new Set(allOfferings.map((o) => o.university.openIntake))).sort(), [allOfferings]);

  const offerings = allOfferings.filter(({ university: u, course: c }) => {
    if (subject && c.subject !== subject) return false;
    if (intake && u.openIntake !== intake) return false;
    if (feeBand && c.feeUSD > feeBandMax(feeBand)) return false;
    if (scholarship === "Available" && !u.scholarshipsAvailable) return false;
    return true;
  });

  const filtersActive = !!(subject || intake || feeBand || scholarship);

  function resetFilters() {
    setSubject("");
    setIntake("");
    setFeeBand("");
    setScholarship("");
  }

  function openCourse(universityId: string, courseName: string, subjectName: string) {
    navigate(`/student/universities/${universityId}`, { state: { selectedCourseName: courseName, subject: subjectName } });
  }

  function openUniversityProfile(universityId: string) {
    navigate(`/student/universities/${universityId}`);
  }

  return (
    <div className="pb-6">
      <div className="lg:mx-auto lg:max-w-6xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h1 className="text-[15px] font-bold text-slate-900">StudyOne</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/student/search")}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-600 shadow-[0_0_8px_rgba(0,0,0,0.07)]"
            >
              <Search size={16} />
            </button>
            <button
              onClick={resetFilters}
              aria-label="Reset filters"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-600 shadow-[0_0_8px_rgba(0,0,0,0.07)]"
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
        </div>

        <div className="px-5">
          <h2 className="text-[26px] font-bold leading-tight text-slate-900">{country}</h2>
          <p className="mt-1 text-[13px] text-slate-500">
            {universities.length} {universities.length === 1 ? "university" : "universities"} · {offerings.length} {offerings.length === 1 ? "program" : "programs"}
          </p>

          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
            <PillSelect label="Subject" value={subject} options={subjectOptions} onChange={setSubject} placeholder="All subjects" />
            <PillSelect label="Intake" value={intake} options={intakeOptions} onChange={setIntake} placeholder="Any intake" />
            <PillSelect label="Fees" value={feeBand} options={FEE_BANDS} onChange={setFeeBand} placeholder="Any fee" />
            <PillSelect label="Scholarship" value={scholarship} options={["Available"]} onChange={setScholarship} placeholder="Any" />
          </div>
        </div>

        <div className="mt-4">
          {offerings.map(({ university: u, course: c }, i) => {
            const scholarshipUSD = scholarshipAmountUSD(u, c.feeUSD);
            const key = `${u.id}::${c.name}`;
            const isShortlisted = isProgramShortlisted(key);
            return (
              <div
                key={key}
                onClick={() => openCourse(u.id, c.name, c.subject)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") openCourse(u.id, c.name, c.subject); }}
                className={`flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left ${i !== offerings.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <LogoBadge name={u.name} tone={u.tone} className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-slate-400">{u.name}</p>
                  <p className="truncate text-[14.5px] font-semibold text-slate-900">{c.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Wallet size={11} className="text-slate-400" /> {u.currencySymbol}
                      {Math.round(c.feeUSD).toLocaleString()}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={11} className="text-slate-400" /> {u.openIntake}
                    </span>
                    {scholarshipUSD && (
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap size={11} className="text-slate-400" /> Up to ${scholarshipUSD.toLocaleString()}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Building2 size={11} className="text-slate-400" /> Main Campus
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span
                      onClick={(e) => { e.stopPropagation(); openUniversityProfile(u.id); }}
                      className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--sd-ink)]"
                    >
                      University Profile <ArrowUpRight size={11} />
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setApplyTarget({ university: u, course: c }); }}
                      className="shrink-0 rounded-lg bg-[image:var(--sd-gradient)] px-3.5 py-1.5 text-[11.5px] font-semibold text-white"
                    >
                      Apply Now
                    </button>
                  </div>
                </div>
                <span
                  onClick={(e) => { e.stopPropagation(); toggleShortlist(key); }}
                  aria-label={isShortlisted ? "Remove from shortlist" : "Shortlist"}
                  className={`shrink-0 ${isShortlisted ? "text-[var(--sd-ink)]" : "text-slate-300"}`}
                >
                  <Bookmark size={16} className={isShortlisted ? "fill-[var(--sd-ink)]" : ""} />
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-300" />
              </div>
            );
          })}

          {offerings.length === 0 && (
            <div className="mx-5 rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-[0_0_10px_rgba(0,0,0,0.11)]">
              <p className="text-sm font-medium text-slate-700">No programs match these filters</p>
              {filtersActive && (
                <button onClick={resetFilters} className="mt-2 text-[12.5px] font-medium text-[var(--sd-ink)]">
                  Reset filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {applyTarget && (
        <ApplyModal university={applyTarget.university} course={applyTarget.course} onClose={() => setApplyTarget(null)} />
      )}
    </div>
  );
}
