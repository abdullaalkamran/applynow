import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Bookmark, Share2, CheckCircle2, Wallet, CalendarDays, GraduationCap, Building2,
  Clock, Users, ChevronRight, ArrowUpRight, ExternalLink, Landmark, ListChecks,
} from "lucide-react";
import { SkylineArt, Pill, LogoBadge } from "../../components/ui/mobile";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { scholarshipAmountUSD, depositLabel, courseHasOpenIntake } from "../../utils/universityFilter";
import { subjectsPreview, campusesPreview, highlightsPreview, intakesPreview, scholarshipsPreview, admissionStepsPreview } from "../../utils/universityPreviews";
import { curriculumFor } from "../../data/subjectCurriculum";
import { getCountryByName } from "../../data/countryRegistry";
import { CostCalculator } from "../../components/CostCalculator";
import { VisaCostBreakdown } from "../../components/VisaCostBreakdown";
import { CountryGuideSection } from "../../components/CountryGuideSection";
import { EntryRequirementsView } from "../../components/EntryRequirementsView";
import { PaymentRequirementsBlock } from "../../components/PaymentRequirementsBlock";
import { AdmissionProcedureBlock } from "../../components/AdmissionProcedureBlock";
import { IntakesBlock } from "../../components/IntakesBlock";
import { ScholarshipsBlock } from "../../components/ScholarshipsBlock";
import { RankingCaption } from "../../components/RankingCaption";
import { ExpandableSection } from "../../components/ExpandableSection";
import { RestrictedRegionsNotice } from "../../components/RestrictedRegionsNotice";
import { EnglishTestNotices } from "../../components/EnglishTestNotices";
import { ApplyModal } from "./ApplyModal";
import type { University } from "../../types";

const UNIVERSITY_TABS = ["Overview", "Courses", "Requirements", "Fees", "Country Guide"] as const;
const COURSE_TABS = ["Overview", "Modules", "Entry Requirements", "Careers"] as const;

type Course = University["courses"][number];

export default function UniversityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { selectedCourseName?: string; subject?: string } | null;
  const originSubject = navState?.subject;
  const UNIVERSITIES = getAllUniversities();
  const university = UNIVERSITIES.find((u) => u.id === id) ?? UNIVERSITIES[0];

  // No course selected on entry (reached via the Universities tab) → show the university's overall
  // profile with a course list to choose from. A course chosen there, or arriving pre-selected from
  // a Subject listing, switches to the single-course detail view.
  const [activeCourseName, setActiveCourseName] = useState<string | null>(navState?.selectedCourseName ?? null);
  const course = university?.courses.find((c) => c.name === activeCourseName);

  const [uniTab, setUniTab] = useState<(typeof UNIVERSITY_TABS)[number]>("Overview");
  const [courseTab, setCourseTab] = useState<(typeof COURSE_TABS)[number]>("Overview");
  const [saved, setSaved] = useState(false);
  const [applying, setApplying] = useState(false);

  if (!university) {
    return (
      <div className="px-5 py-6">
        <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-blue-600">
          <ArrowLeft size={14} /> Back
        </button>
        <p className="text-xs text-slate-400">University not found.</p>
      </div>
    );
  }

  const actions = course ? (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSaved((v) => !v)}
          aria-label="Shortlist"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border py-3 text-[13px] font-semibold ${
            saved ? "border-[var(--sd-ink)] bg-[image:var(--sd-gradient)] text-white" : "border-slate-200 bg-[var(--sd-card)] text-slate-700"
          }`}
        >
          <Bookmark size={16} className={saved ? "fill-white" : ""} />
        </button>
        <button
          onClick={() => setActiveCourseName(null)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-[var(--sd-card)] py-3 text-[13px] font-semibold text-slate-700"
        >
          University <ArrowUpRight size={13} />
        </button>
        <a
          href={`https://www.${university.website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-[var(--sd-card)] py-3 text-[13px] font-semibold text-slate-700"
        >
          Website <ExternalLink size={13} />
        </a>
      </div>
      <button
        onClick={() => setApplying(true)}
        disabled={!courseHasOpenIntake(university, course)}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--sd-gradient)] py-3 text-[13px] font-semibold text-white disabled:opacity-40"
      >
        {courseHasOpenIntake(university, course) ? (
          <>Apply Now <ArrowLeft size={14} className="rotate-180" /></>
        ) : (
          "Intake Closed"
        )}
      </button>
    </div>
  ) : (
    <div className="flex w-full items-center gap-3">
      <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-[var(--sd-card)] py-3 text-[13px] font-semibold text-slate-700">
        Shortlist
      </button>
      <button
        onClick={() => setUniTab("Courses")}
        className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[image:var(--sd-gradient)] py-3 text-[13px] font-semibold text-white"
      >
        View Courses <ArrowLeft size={14} className="rotate-180" />
      </button>
    </div>
  );

  return (
    <div className="flex min-h-full flex-col">
      <div className="lg:mx-auto lg:w-full lg:max-w-3xl">
        {/* Single column at every breakpoint — the cover photo is a full-width banner, not squeezed
            into a narrow side rail, and the rest of the page just flows underneath it. */}
        <div className="relative h-[330px] shrink-0 lg:h-80 lg:overflow-hidden lg:rounded-b-3xl">
          {university.coverPhotoUrl ? (
            <img src={university.coverPhotoUrl} alt={`${university.name} cover`} className="h-full w-full object-cover" />
          ) : (
            <SkylineArt tone={university.tone} className="h-full w-full" />
          )}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 lg:px-10 lg:pt-6">
            <button
              onClick={() => (course && !navState?.selectedCourseName ? setActiveCourseName(null) : navigate(-1))}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-800 shadow"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSaved((v) => !v)}
                aria-label="Save"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-800 shadow"
              >
                <Bookmark size={16} className={saved ? "fill-[var(--sd-ink)] text-[var(--sd-ink)]" : ""} />
              </button>
              <button aria-label="Share" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-800 shadow">
                <Share2 size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 pb-4 pt-5 lg:px-10">
          {course ? (
            <CourseView
              university={university}
              course={course}
              originSubject={originSubject}
              tab={courseTab}
              setTab={setCourseTab}
            />
          ) : (
            <UniversityView university={university} tab={uniTab} setTab={setUniTab} onSelectCourse={setActiveCourseName} />
          )}
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto bg-[var(--sd-bg)] px-5 py-4 lg:mx-auto lg:w-full lg:max-w-3xl lg:px-10">
        {actions}
      </div>

      {applying && course && (
        <ApplyModal university={university} course={course} onClose={() => setApplying(false)} />
      )}
    </div>
  );
}

function CourseView({
  university, course, originSubject, tab, setTab,
}: {
  university: University; course: Course; originSubject?: string;
  tab: (typeof COURSE_TABS)[number]; setTab: (t: (typeof COURSE_TABS)[number]) => void;
}) {
  const navigate = useNavigate();
  const scholarshipUSD = scholarshipAmountUSD(university, course.feeUSD);
  const { modules, careers } = curriculumFor(course.subject);
  const description = `This ${course.level.toLowerCase()} programme gives you a strong foundation in ${course.subject}, taught by leading faculty at ${university.name}.`;

  function openCampuses() {
    navigate(`/student/universities/${university.id}/campuses`, { state: { courseName: course.name } });
  }

  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{university.name}</p>
      <h1 className="mt-1 text-[24px] font-bold leading-tight text-slate-900 lg:text-[28px]">{course.name}</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">{description}</p>

      {originSubject && (
        <button
          onClick={() => navigate(`/student/subjects/${encodeURIComponent(originSubject)}`)}
          className="mt-2 flex items-center gap-1 text-[12px] font-medium text-[var(--sd-ink)]"
        >
          View {originSubject} at other universities <ArrowUpRight size={13} />
        </button>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2">
        <StatTile icon={<Wallet size={18} />} value={`${university.currencySymbol}${Math.round(course.feeUSD).toLocaleString()}`} label="per year" />
        <StatTile icon={<CalendarDays size={18} />} value={university.openIntake} label="intake" />
        <StatTile icon={<GraduationCap size={18} />} value={scholarshipUSD ? `Up to $${scholarshipUSD.toLocaleString()}` : "—"} label="scholarship" />
      </div>

      <div className="mt-5 flex items-center gap-5 overflow-x-auto border-b border-black/5">
        {COURSE_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative shrink-0 whitespace-nowrap pb-3 text-[13px] font-medium transition ${tab === t ? "text-[var(--sd-ink)]" : "text-slate-400"}`}
          >
            {t}
            {tab === t && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[image:var(--sd-gradient)]" />}
          </button>
        ))}
      </div>

      <div className="py-4">
        {tab === "Overview" && (
          <>
            <p className="text-[13px] leading-relaxed text-slate-500">{description}</p>
            <RestrictedRegionsNotice university={university} className="mt-4" />
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <FactTile icon={<Building2 size={16} />} label="Campus" value="Main Campus" onClick={openCampuses} />
              <FactTile icon={<Clock size={16} />} label="Duration" value={course.duration} />
              <FactTile icon={<Users size={16} />} label="Study Mode" value="Full-time" />
            </div>
            <EnglishTestNotices university={university} showMoi={course.level !== "Undergraduate"} className="mt-4" />
            <div className="mt-4 rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Landmark size={15} /> Deposit & Payment</p>
              <div className="mt-3">
                <PaymentRequirementsBlock university={university} />
              </div>
            </div>
          </>
        )}

        {tab === "Modules" && (
          <ul className="space-y-2.5">
            {modules.map((m) => (
              <li key={m} className="flex items-center gap-3 rounded-2xl bg-[var(--sd-card)] p-3.5 shadow-[0_0_10px_rgba(0,0,0,0.08)]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7EEFC] text-[#2955C4]">
                  <GraduationCap size={15} />
                </div>
                <span className="text-[13px] font-medium text-slate-700">{m}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "Entry Requirements" && (
          <>
            <EnglishTestNotices university={university} showMoi={course.level !== "Undergraduate"} className="mb-3" />
            <ul className="space-y-2.5">
              {(course.level === "Undergraduate" ? university.requirements.undergraduate : university.requirements.postgraduate).map((r) => (
                <li key={r} className="flex items-start gap-2 text-[13px] text-slate-600">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--sd-teal)]" />
                  {r}
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === "Careers" && (
          <ul className="space-y-2.5">
            {careers.map((c) => (
              <li key={c} className="flex items-center justify-between rounded-2xl bg-[var(--sd-card)] p-3.5 shadow-[0_0_10px_rgba(0,0,0,0.08)]">
                <span className="text-[13px] font-medium text-slate-700">{c}</span>
                <ChevronRight size={15} className="text-slate-300" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function UniversityView({
  university, tab, setTab, onSelectCourse,
}: {
  university: University; tab: (typeof UNIVERSITY_TABS)[number]; setTab: (t: (typeof UNIVERSITY_TABS)[number]) => void;
  onSelectCourse: (name: string) => void;
}) {
  const navigate = useNavigate();
  const country = getCountryByName(university.country);
  return (
    <>
      <div className="flex items-start gap-3">
        <LogoBadge name={university.name} tone={university.tone} logoUrl={university.logoUrl} className="h-14 w-14 shrink-0 text-base" />
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight text-slate-900 lg:text-[26px]">{university.name}</h1>
          <p className="mt-1 text-xs text-slate-400">{university.city}, {university.country}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {university.tags.map((t) => <Pill key={t} tone="blue">{t}</Pill>)}
        {university.accreditations.map((a) => <Pill key={a} tone="navy">{a}</Pill>)}
      </div>
      <a
        href={`https://www.${university.website}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--sd-ink)]"
      >
        {university.website} <ExternalLink size={12} />
      </a>

      <div className="mt-5 flex items-center gap-5 overflow-x-auto border-b border-black/5">
        {UNIVERSITY_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative shrink-0 whitespace-nowrap pb-3 text-[13px] font-medium transition ${tab === t ? "text-[var(--sd-ink)]" : "text-slate-400"}`}
          >
            {t}
            {tab === t && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[image:var(--sd-gradient)]" />}
          </button>
        ))}
      </div>

      <div className="py-4">
        {tab === "Overview" && (
          <>
            <p className="text-[13px] leading-relaxed text-slate-500">{university.description}</p>

            <RestrictedRegionsNotice university={university} className="mt-4" />
            <EnglishTestNotices university={university} className="mt-4" />

            <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
              <Stat value={university.worldRank} label="in the World" />
              <Stat value={university.employability} label="Employability" />
              <Stat value={university.studentCount} label="Students" />
            </div>
            <RankingCaption university={university} className="mt-2" />

            <div className="mt-4 space-y-2.5">
              {university.subjects.length > 0 && (
                <ExpandableSection title="Subjects offered" preview={subjectsPreview(university)} className="bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.11)]">
                  <div className="flex flex-wrap gap-1.5">
                    {university.subjects.map((s) => <Pill key={s}>{s}</Pill>)}
                  </div>
                </ExpandableSection>
              )}

              {(university.campuses ?? []).length > 0 && (
                <ExpandableSection icon={<Building2 size={15} />} title="Campuses" preview={campusesPreview(university)} className="bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.11)]">
                  <div className="space-y-1.5">
                    {university.campuses!.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-[13px]">
                        <span className="text-slate-700">{c.name}</span>
                        <span className="text-slate-400">{c.city}</span>
                      </div>
                    ))}
                  </div>
                </ExpandableSection>
              )}

              <ExpandableSection title="Why study here?" preview={highlightsPreview(university)} className="bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.11)]">
                <ul className="space-y-2.5">
                  {university.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2 text-[13px] text-slate-600">
                      <CheckCircle2 size={16} className="shrink-0 text-[var(--sd-teal)]" />
                      {h}
                    </li>
                  ))}
                </ul>
              </ExpandableSection>

              <ExpandableSection icon={<CalendarDays size={15} />} title="Intakes" preview={intakesPreview(university)} className="bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.11)]">
                <IntakesBlock university={university} />
              </ExpandableSection>

              <ExpandableSection icon={<GraduationCap size={15} />} title="Scholarships" preview={scholarshipsPreview(university)} className="bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.11)]">
                <ScholarshipsBlock university={university} />
              </ExpandableSection>

              <ExpandableSection icon={<Landmark size={15} />} title="Deposit & Payment" preview={depositLabel(university) ?? undefined} defaultExpanded className="bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.11)]">
                <PaymentRequirementsBlock university={university} />
              </ExpandableSection>

              <ExpandableSection icon={<ListChecks size={15} />} title="Admission Procedure" preview={admissionStepsPreview(university)} className="bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.11)]">
                <AdmissionProcedureBlock university={university} />
              </ExpandableSection>
            </div>
          </>
        )}

        {tab === "Courses" && (
          <div className="space-y-2.5">
            {university.courses.map((c) => (
              <button
                key={c.name}
                onClick={() => onSelectCourse(c.name)}
                className="flex w-full items-center justify-between gap-2 rounded-2xl bg-[var(--sd-card)] p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.11)]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{c.level} · {c.duration}</p>
                  <p className="mt-1.5 text-[12.5px] font-semibold text-slate-700">≈${c.feeUSD.toLocaleString()}/yr</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-300" />
              </button>
            ))}
          </div>
        )}

        {tab === "Requirements" && (
          <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
            <EntryRequirementsView
              requirements={university.requirements}
              englishRequirements={university.englishRequirements}
              minIELTS={university.minIELTS}
              minGPA={university.minGPA}
              moiAccepted={university.moiAccepted}
              moiAcceptedUniversities={university.moiAcceptedUniversities}
              internalEnglishTestOffered={university.internalEnglishTestOffered}
              internalEnglishTestFree={university.internalEnglishTestFree}
              internalEnglishTestFee={university.internalEnglishTestFee}
              currencySymbol={university.currencySymbol}
            />
          </div>
        )}

        {tab === "Fees" && (
          <div className="space-y-3">
            <CostCalculator university={university} recommendedFundsUSD={country?.recommendedFundsUSD} />
            {country?.visaCostConfig && <VisaCostBreakdown university={university} config={country.visaCostConfig} />}
            <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
              {university.fees.map((f) => (
                <div key={f.label} className="flex items-center justify-between border-b border-slate-50 py-2.5 last:border-0">
                  <span className="text-[13px] text-slate-500">{f.label}</span>
                  <span className="text-[13px] font-medium text-slate-800">{university.currencySymbol}{f.amount.toLocaleString()}</span>
                </div>
              ))}
              <button
                onClick={() => navigate("/student/cost-planner")}
                className="mt-3 w-full rounded-xl bg-slate-50 py-2.5 text-center text-[13px] font-medium text-[var(--sd-ink)]"
              >
                Open full Cost Planner
              </button>
            </div>
          </div>
        )}

        {tab === "Country Guide" && <CountryGuideSection country={country} />}
      </div>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[15px] font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 py-3 text-center">
      <span className="text-[var(--sd-ink)]">{icon}</span>
      <p className="truncate px-1 text-[12.5px] font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}

function FactTile({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-2xl border border-slate-100 p-3 text-left"
    >
      <span className="text-slate-500">{icon}</span>
      <span className="text-[10.5px] text-slate-400">{label}</span>
      <span className="flex items-center gap-0.5 text-[12.5px] font-semibold text-slate-800">
        {value}
        {onClick && <ChevronRight size={12} className="text-slate-300" />}
      </span>
    </Comp>
  );
}
