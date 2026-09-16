// Mirrors DataUniversityDetail.tsx's tab styling — the counsellor read-only equivalent of Data
// Management's per-country page, minus edit/delete access, with a persistent hero (CountryHero,
// no actions — this page is view-only) above three tabs: Overview (the rich country profile),
// Universities (partner universities in this country), and Subjects (every distinct field of
// study offered here).
import { useState } from "react";
import { useParams } from "react-router-dom";
import { GraduationCap, Award, BookOpen } from "lucide-react";
import { BackButton } from "../../../components/ui";
import { LogoBadge } from "../../../components/ui/mobile";
import { CountryGuideDisclosure } from "../../../components/CountryGuideSection";
import { CountryHero, CountryOverviewCards } from "../../../components/CountryOverview";
import { getAllUniversities } from "../../../data/universityCatalogStore";
import { getCountryByName } from "../../../data/countryRegistry";
import { loadAssignedStudents } from "../../../data/counsellorStudentsStore";
import { activeApplicationsFor } from "../../../utils/counsellorData";

const TABS = ["Overview", "Universities", "Subjects"] as const;

export default function CounsellorCountryDetail() {
  const { country: countryParam } = useParams();
  const country = countryParam ? decodeURIComponent(countryParam) : "";
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  const universities = getAllUniversities().filter((u) => u.country === country);
  const countryDetails = getCountryByName(country);
  const assigned = loadAssignedStudents();
  const allActiveApps = assigned.flatMap((s) => activeApplicationsFor(s.id));

  const subjectCounts = (() => {
    const counts = new Map<string, number>();
    universities.forEach((u) => u.courses.forEach((c) => counts.set(c.subject, (counts.get(c.subject) ?? 0) + 1)));
    return Array.from(counts.entries()).map(([subject, count]) => ({ subject, count })).sort((a, b) => b.count - a.count);
  })();

  return (
    <div>
      <BackButton fallback="/staff/counsellor/partners" />
      <div className="mb-4">
        <CountryHero country={country} countryDetails={countryDetails} />
        <p className="mt-3 text-sm text-slate-500">
          {universities.length} partner universit{universities.length === 1 ? "y" : "ies"} in {country}.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-5 border-b border-slate-100">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative shrink-0 whitespace-nowrap pb-3 text-xs font-medium transition ${tab === t ? "text-[var(--brand-700)]" : "text-slate-400"}`}
          >
            {t}
            {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--brand-600)]" />}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div>
          <CountryOverviewCards
            country={country}
            countryDetails={countryDetails}
            universities={universities}
            subjectCounts={subjectCounts}
            onOpenUniversity={() => {}}
            onViewAllUniversities={() => setTab("Universities")}
            onViewAllSubjects={() => setTab("Subjects")}
          />
          <div className="mt-5">
            <CountryGuideDisclosure country={countryDetails} />
          </div>
        </div>
      ) : tab === "Universities" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {universities.map((u) => {
            const activeFromMyStudents = allActiveApps.filter((a) => a.university === u.name).length;
            return (
              <div key={u.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                <div className="flex items-start gap-3">
                  <LogoBadge name={u.name} tone={u.tone} logoUrl={u.logoUrl} className="h-11 w-11 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{u.name}</p>
                    <p className="truncate text-xs text-slate-400">{u.city}, {u.country}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><GraduationCap size={11} /> {u.worldRank} world rank</span>
                  <span>{u.employability} employability</span>
                  {u.scholarshipsAvailable && (
                    <span className="inline-flex items-center gap-1 text-amber-600"><Award size={11} /> Scholarships</span>
                  )}
                </div>
                <div className="mt-3 border-t border-slate-50 pt-3">
                  <p className="text-xs text-slate-500">
                    {activeFromMyStudents > 0
                      ? `${activeFromMyStudents} of your student${activeFromMyStudents === 1 ? "" : "s"} applying here`
                      : "None of your students applying here yet"}
                  </p>
                </div>
              </div>
            );
          })}
          {universities.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
              No partner universities in {country} yet.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subjectCounts.map(({ subject, count }) => (
            <div key={subject} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-50)] text-[var(--brand-700)]">
                <BookOpen size={15} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{subject}</p>
                <p className="text-xs text-slate-400">{count} program{count === 1 ? "" : "s"}</p>
              </div>
            </div>
          ))}
          {subjectCounts.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
              No subjects listed in {country} yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
