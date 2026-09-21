// Mirrors UniversityDetail.tsx (agent)'s tabbed layout — country is the fixed dimension, with a
// persistent hero (CountryHero) above three tabs: "Overview" (the rich country profile),
// "Universities" (a clean per-university directory — program/course browsing belongs on the
// "Subjects" tab instead, so this tab isn't showing the same course list twice under two different
// names), and "Subjects" (every distinct field of study offered here).
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronRight, GraduationCap, Plus, Share2, Wallet } from "lucide-react";
import { LogoBadge } from "../../components/ui/mobile";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { getCountryByName } from "../../data/countryRegistry";
import { CountryGuideDisclosure } from "../../components/CountryGuideSection";
import { CountryHero, CountryOverviewCards } from "../../components/CountryOverview";
import { loadAgentStudents } from "../../data/agentStudentsStore";
import { CreateApplicationModal } from "./CreateApplicationModal";

const TABS = ["Overview", "Universities", "Courses", "Subjects"] as const;

export default function AgentCountryDetail() {
  const navigate = useNavigate();
  const { country: countryParam } = useParams();
  const students = loadAgentStudents();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copied, setCopied] = useState(false);

  function openUniversityProfile(universityId: string) {
    navigate(`/agent/universities/${universityId}`);
  }

  function openCourse(universityId: string, courseName: string) {
    navigate(`/agent/universities/${universityId}`, { state: { selectedCourseName: courseName } });
  }

  async function shareWithStudent() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied — nothing more useful to do than leave the button unchanged
    }
  }

  const country = countryParam ? decodeURIComponent(countryParam) : "";
  const universities = getAllUniversities().filter((u) => u.country === country);
  const countryDetails = getCountryByName(country);
  const totalCourses = universities.reduce((sum, u) => sum + u.courses.length, 0);

  const subjectCounts = (() => {
    const counts = new Map<string, number>();
    universities.forEach((u) => u.courses.forEach((c) => counts.set(c.subject, (counts.get(c.subject) ?? 0) + 1)));
    return Array.from(counts.entries()).map(([subjectName, count]) => ({ subject: subjectName, count })).sort((a, b) => b.count - a.count);
  })();

  const courseOfferings = universities.flatMap((u) => u.courses.map((c) => ({ university: u, course: c })));

  function openSubject(subjectName: string) {
    navigate(`/agent/subjects/${encodeURIComponent(subjectName)}`, { state: { destination: country } });
  }

  return (
    <div>
      <button onClick={() => navigate("/agent/universities")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-blue-600">
        <ArrowLeft size={14} /> Back to Universities
      </button>

      <CountryHero
        country={country}
        countryDetails={countryDetails}
        actions={
          <>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus size={13} /> Create Application
            </button>
            <button
              onClick={shareWithStudent}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-white/90"
            >
              <Share2 size={13} /> {copied ? "Link Copied!" : "Share with Student"}
            </button>
          </>
        }
      />
      <p className="mt-3 text-xs text-slate-500">
        {universities.length} universit{universities.length === 1 ? "y" : "ies"} · {totalCourses} program{totalCourses === 1 ? "" : "s"}
      </p>

      <div className="mt-4 flex items-center gap-5 overflow-x-auto border-b border-slate-100">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative shrink-0 whitespace-nowrap py-3 text-[13px] font-medium ${tab === t ? "text-blue-700" : "text-slate-400"}`}
          >
            {t}
            {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-blue-600" />}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="mt-4">
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
      ) : tab === "Courses" ? (
        <div className="mt-4 space-y-2.5">
          {courseOfferings.map(({ university: u, course: c }) => (
            <button
              key={`${u.id}::${c.name}`}
              onClick={() => openCourse(u.id, c.name)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300"
            >
              <LogoBadge name={u.name} tone={u.tone} logoUrl={u.logoUrl} className="h-11 w-11 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{c.name}</p>
                <p className="truncate text-xs text-slate-400">{u.name} · {c.level} · {c.duration}</p>
                <p className="mt-1 flex items-center gap-1 text-[11.5px] font-semibold text-slate-700">
                  <Wallet size={11} className="text-slate-400" /> {u.currencySymbol}{Math.round(c.feeUSD).toLocaleString()}/yr
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-300" />
            </button>
          ))}
          {courseOfferings.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <p className="text-xs text-slate-400">No courses listed in {country} yet.</p>
            </div>
          )}
        </div>
      ) : tab === "Subjects" ? (
        <div className="mt-4 space-y-2.5">
          {subjectCounts.map(({ subject: subjectName, count }) => (
            <button
              key={subjectName}
              onClick={() => openSubject(subjectName)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <BookOpen size={15} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{subjectName}</p>
                  <p className="text-xs text-slate-400">{count} program{count === 1 ? "" : "s"}</p>
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-300" />
            </button>
          ))}
          {subjectCounts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <p className="text-xs text-slate-400">No subjects listed yet.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {universities.map((u) => (
            <button
              key={u.id}
              onClick={() => openUniversityProfile(u.id)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300"
            >
              <LogoBadge name={u.name} tone={u.tone} logoUrl={u.logoUrl} className="h-11 w-11 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{u.name}</p>
                <p className="truncate text-xs text-slate-400">{u.city}, {u.country}</p>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><GraduationCap size={11} /> {u.worldRank}</span>
                  <span className="inline-flex items-center gap-1"><BookOpen size={11} /> {u.courses.length} course{u.courses.length === 1 ? "" : "s"}</span>
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-300" />
            </button>
          ))}
          {universities.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <p className="text-xs text-slate-400">No universities in {country} yet.</p>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateApplicationModal
          students={students}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
