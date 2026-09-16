import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, MapPin, Trophy, Briefcase, Users, CheckCircle2, Wallet, CalendarDays, GraduationCap,
  Building2, Clock3, ExternalLink, ChevronRight,
} from "lucide-react";
import { SkylineArt, Pill, LogoBadge } from "../../components/ui/mobile";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { loadAgentStudents } from "../../data/agentStudentsStore";
import { scholarshipAmountUSD } from "../../utils/universityFilter";
import { curriculumFor } from "../../data/subjectCurriculum";
import { getCountryByName } from "../../data/countryRegistry";
import { CostCalculator } from "../../components/CostCalculator";
import { VisaCostBreakdown } from "../../components/VisaCostBreakdown";
import { CountryGuideSection } from "../../components/CountryGuideSection";
import { EntryRequirementsView } from "../../components/EntryRequirementsView";
import { ShortlistButton } from "./ShortlistButton";
import { CreateApplicationModal } from "./CreateApplicationModal";

const UNI_TABS = ["Overview", "Courses", "Requirements", "Fees", "Country Guide"] as const;
const COURSE_TABS = ["Overview", "Modules", "Entry Requirements", "Careers"] as const;

export default function AgentUniversityDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const navState = location.state as { selectedCourseName?: string; subject?: string } | null;
  const students = loadAgentStudents();
  const UNIVERSITIES = getAllUniversities();

  const university = UNIVERSITIES.find((u) => u.id === id) ?? UNIVERSITIES[0];
  const [activeCourseName, setActiveCourseName] = useState<string | null>(navState?.selectedCourseName ?? null);
  const [uniTab, setUniTab] = useState<(typeof UNI_TABS)[number]>("Overview");
  const [courseTab, setCourseTab] = useState<(typeof COURSE_TABS)[number]>("Overview");
  const [applyOpen, setApplyOpen] = useState(false);

  if (!university) {
    return (
      <div className="max-w-4xl">
        <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-blue-600">
          <ArrowLeft size={14} /> Back
        </button>
        <p className="text-xs text-slate-400">University not found.</p>
      </div>
    );
  }

  const course = university.courses.find((c) => c.name === activeCourseName) ?? null;
  const country = getCountryByName(university.country);

  return (
    <div className="max-w-4xl">
      <button onClick={() => navigate("/agent/universities")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-blue-600">
        <ArrowLeft size={14} /> Back to Universities
      </button>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        {university.coverPhotoUrl ? (
          <img src={university.coverPhotoUrl} alt={`${university.name} cover`} className="h-36 w-full object-cover" />
        ) : (
          <SkylineArt tone={university.tone} className="h-36 w-full" />
        )}
        <div className="p-5">
          {course ? (
            <>
              <p className="text-xs text-slate-400">{university.name}</p>
              <h1 className="mt-0.5 text-lg font-semibold text-slate-900">{course.name}</h1>
              {navState?.subject && (
                <button onClick={() => navigate(`/agent/subjects/${encodeURIComponent(navState.subject!)}`)} className="mt-1 text-[11px] font-medium text-blue-600">
                  View {navState.subject} at other universities →
                </button>
              )}
            </>
          ) : (
            <div className="-mt-8 flex items-start gap-3">
              <LogoBadge name={university.name} tone={university.tone} logoUrl={university.logoUrl} className="h-12 w-12 shrink-0 text-sm" />
              <div className="pt-8">
                <h1 className="text-lg font-semibold text-slate-900">{university.name}</h1>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {university.city}, {university.country}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill tone={university.tone}>{university.tags[0]}</Pill>
                  {university.accreditations[0] && <Pill tone="gray">{university.accreditations[0]}</Pill>}
                  {university.tags[1] && <Pill tone="gray">{university.tags[1]}</Pill>}
                </div>
              </div>
            </div>
          )}
        </div>

        {course ? (
          <>
            <div className="flex items-center gap-5 overflow-x-auto border-t border-slate-100 px-5">
              {COURSE_TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setCourseTab(t)}
                  className={`relative shrink-0 whitespace-nowrap py-3 text-[13px] font-medium ${courseTab === t ? "text-blue-700" : "text-slate-400"}`}
                >
                  {t}
                  {courseTab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-blue-600" />}
                </button>
              ))}
            </div>
            <div className="p-5">
              {courseTab === "Overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <StatTile icon={<Wallet size={14} />} label="Fee / year" value={`$${course.feeUSD.toLocaleString()}`} />
                    <StatTile icon={<CalendarDays size={14} />} label="Intake" value={university.openIntake} />
                    <StatTile icon={<GraduationCap size={14} />} label="Scholarship" value={scholarshipAmountUSD(university, course.feeUSD) ? `Up to $${scholarshipAmountUSD(university, course.feeUSD)!.toLocaleString()}` : "—"} />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FactTile
                      icon={<Building2 size={14} />} label="Campus" value="Main Campus"
                      onClick={() => navigate(`/agent/universities/${university.id}/campuses`, { state: { courseName: course.name } })}
                    />
                    <FactTile icon={<Clock3 size={14} />} label="Duration" value={course.duration} />
                    <FactTile icon={<GraduationCap size={14} />} label="Level" value={course.level} />
                  </div>
                </div>
              )}
              {courseTab === "Modules" && (
                <ul className="space-y-2">
                  {curriculumFor(course.subject).modules.map((m) => (
                    <li key={m} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <CheckCircle2 size={13} className="shrink-0 text-blue-500" /> {m}
                    </li>
                  ))}
                </ul>
              )}
              {courseTab === "Entry Requirements" && (
                <ul className="space-y-2">
                  {(course.level === "Undergraduate" ? university.requirements.undergraduate : university.requirements.postgraduate).map((r) => (
                    <li key={r} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-500" /> {r}
                    </li>
                  ))}
                </ul>
              )}
              {courseTab === "Careers" && (
                <ul className="space-y-2">
                  {curriculumFor(course.subject).careers.map((c) => (
                    <li key={c} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <Briefcase size={13} className="shrink-0 text-violet-500" /> {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 p-4">
              <button onClick={() => setActiveCourseName(null)} className="text-xs font-medium text-slate-500">← University profile</button>
              <div className="flex items-center gap-1.5">
                <ShortlistButton students={students} universityId={university.id} universityName={university.name} courseName={course.name} />
                <button onClick={() => setApplyOpen(true)} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                  Apply Now
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-5 overflow-x-auto border-t border-slate-100 px-5">
              {UNI_TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setUniTab(t)}
                  className={`relative shrink-0 whitespace-nowrap py-3 text-[13px] font-medium ${uniTab === t ? "text-blue-700" : "text-slate-400"}`}
                >
                  {t}
                  {uniTab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-blue-600" />}
                </button>
              ))}
            </div>
            <div className="p-5">
              {uniTab === "Overview" && (
                <div className="space-y-4">
                  <p className="text-xs leading-relaxed text-slate-600">{university.description}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <StatTile icon={<Trophy size={14} />} label="World rank" value={university.worldRank} />
                    <StatTile icon={<Briefcase size={14} />} label="Employability" value={university.employability} />
                    <StatTile icon={<Users size={14} />} label="Students" value={university.studentCount} />
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="mb-2 text-xs font-semibold text-slate-700">Why study here?</p>
                    <ul className="space-y-1.5">
                      {university.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2 text-xs text-slate-600">
                          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" /> {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {uniTab === "Courses" && (
                <div className="space-y-2">
                  {university.courses.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => { setActiveCourseName(c.name); setCourseTab("Overview"); }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-left hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{c.name}</p>
                        <p className="truncate text-[11px] text-slate-400">{c.level} · {c.duration}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
                        ${c.feeUSD.toLocaleString()}/yr <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {uniTab === "Requirements" && (
                <EntryRequirementsView
                  requirements={university.requirements}
                  englishRequirements={university.englishRequirements}
                  minIELTS={university.minIELTS}
                  courses={university.courses}
                  currencySymbol={university.currencySymbol}
                  onSelectCourse={(courseId) => {
                    const c = university.courses.find((x) => x.id === courseId);
                    if (c) { setActiveCourseName(c.name); setCourseTab("Overview"); }
                  }}
                />
              )}
              {uniTab === "Fees" && (
                <div className="space-y-3">
                  <CostCalculator university={university} recommendedFundsUSD={country?.recommendedFundsUSD} />
                  {country?.visaCostConfig && <VisaCostBreakdown university={university} config={country.visaCostConfig} />}
                  <div className="space-y-2">
                    {university.fees.map((f) => (
                      <div key={f.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <span className="text-slate-600">{f.label}</span>
                        <span className="font-semibold text-slate-800">{university.currencySymbol}{f.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {uniTab === "Country Guide" && <CountryGuideSection country={country} />}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 p-4">
              <a href={`https://www.${university.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-slate-500">
                Website <ExternalLink size={12} />
              </a>
              <button onClick={() => setUniTab("Courses")} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                View Courses →
              </button>
            </div>
          </>
        )}
      </div>

      {applyOpen && course && (
        <CreateApplicationModal
          students={students}
          initialUniversityId={university.id}
          initialCourseName={course.name}
          onClose={() => setApplyOpen(false)}
          onCreated={() => setApplyOpen(false)}
        />
      )}
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">{icon}</div>
      <p className="mt-1.5 text-xs font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function FactTile({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={`flex items-center gap-2.5 rounded-xl border border-slate-100 p-3 text-left ${onClick ? "hover:bg-slate-50" : ""}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className="truncate text-xs font-medium text-slate-800">{value}</p>
      </div>
      {onClick && <ChevronRight size={14} className="shrink-0 text-slate-300" />}
    </Comp>
  );
}
