// Read-only equivalent of the student/agent University Detail page — every field Data Management
// has entered, laid out the same way, minus any apply/shortlist actions since a counsellor doesn't
// apply on a student's behalf from here (mirrors CountryDetail.tsx's view-only convention).
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, MapPin, Trophy, Briefcase, Users, CheckCircle2, Wallet, CalendarDays, GraduationCap,
  Building2, Clock3, ExternalLink, ChevronRight, Landmark, ListChecks, Briefcase as BriefcaseIcon, BookOpen,
} from "lucide-react";
import { SkylineArt, Pill, LogoBadge } from "../../../components/ui/mobile";
import { getAllUniversities } from "../../../data/universityCatalogStore";
import { curriculumForCourse } from "../../../data/subjectCurriculum";
import { getCountryByName } from "../../../data/countryRegistry";
import { CostCalculator } from "../../../components/CostCalculator";
import { VisaCostBreakdown } from "../../../components/VisaCostBreakdown";
import { CountryGuideSection } from "../../../components/CountryGuideSection";
import { EntryRequirementsView } from "../../../components/EntryRequirementsView";
import { PaymentRequirementsBlock } from "../../../components/PaymentRequirementsBlock";
import { AdmissionProcedureBlock } from "../../../components/AdmissionProcedureBlock";
import { IntakesBlock } from "../../../components/IntakesBlock";
import { ScholarshipsBlock } from "../../../components/ScholarshipsBlock";
import { RankingCaption } from "../../../components/RankingCaption";
import { ExpandableSection } from "../../../components/ExpandableSection";
import { RestrictedRegionsNotice } from "../../../components/RestrictedRegionsNotice";
import { EnglishTestNotices } from "../../../components/EnglishTestNotices";
import { CourseAccreditations } from "../../../components/CourseAccreditations";
import { depositLabel, campusLabelFor } from "../../../utils/universityFilter";
import { subjectsPreview, campusesPreview, coursesPreview, highlightsPreview, intakesPreview, scholarshipsPreview, admissionStepsPreview } from "../../../utils/universityPreviews";

const UNI_TABS = ["Overview", "Courses", "Requirements", "Fees", "Country Guide"] as const;
const COURSE_TABS = ["Overview", "Modules", "Entry Requirements", "Careers"] as const;

export default function CounsellorUniversityDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const navState = location.state as { selectedCourseName?: string } | null;
  const UNIVERSITIES = getAllUniversities();
  const university = UNIVERSITIES.find((u) => u.id === id);

  const [activeCourseName, setActiveCourseName] = useState<string | null>(navState?.selectedCourseName ?? null);
  const [uniTab, setUniTab] = useState<(typeof UNI_TABS)[number]>("Overview");
  const [courseTab, setCourseTab] = useState<(typeof COURSE_TABS)[number]>("Overview");

  if (!university) {
    return (
      <div className="max-w-4xl">
        <button onClick={() => navigate("/staff/counsellor/partners")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
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
      <button onClick={() => navigate("/staff/counsellor/partners")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
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
            </>
          ) : (
            <div className="-mt-8 flex items-start gap-3">
              <LogoBadge name={university.name} tone={university.tone} logoUrl={university.logoUrl} className="h-12 w-12 shrink-0 text-sm" />
              <div className="pt-8">
                <h1 className="text-lg font-semibold text-slate-900">{university.name}</h1>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {university.city}, {university.country}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {university.tags.map((t) => <Pill key={t} tone={university.tone}>{t}</Pill>)}
                  {university.accreditations.map((a) => <Pill key={a} tone="gray">{a}</Pill>)}
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
                  className={`relative shrink-0 whitespace-nowrap py-3 text-[13px] font-medium ${courseTab === t ? "text-[var(--brand-700)]" : "text-slate-400"}`}
                >
                  {t}
                  {courseTab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--brand-600)]" />}
                </button>
              ))}
            </div>
            <div className="p-5">
              {courseTab === "Overview" && (
                <div className="space-y-4">
                  <RestrictedRegionsNotice university={university} />
                  <div className="grid grid-cols-3 gap-3">
                    <StatTile icon={<Wallet size={14} />} label="Fee / year" value={`${university.currencySymbol}${course.feeUSD.toLocaleString()}`} />
                    <StatTile icon={<CalendarDays size={14} />} label="Intake" value={university.openIntake} />
                    <StatTile icon={<GraduationCap size={14} />} label="Level" value={course.level} />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FactTile icon={<Building2 size={14} />} label="Campus" value={campusLabelFor(university, course)} />
                    <FactTile icon={<Clock3 size={14} />} label="Duration" value={course.duration} />
                  </div>
                  <CourseAccreditations accreditations={course.accreditations} />
                  <EnglishTestNotices university={university} showMoi={course.level !== "Undergraduate"} />
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <Landmark size={13} /> Deposit & Payment
                    </p>
                    <PaymentRequirementsBlock university={university} />
                  </div>
                </div>
              )}
              {courseTab === "Modules" && (
                <ul className="space-y-2">
                  {curriculumForCourse(course).modules.map((m) => (
                    <li key={m} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <CheckCircle2 size={13} className="shrink-0 text-[var(--brand-500)]" /> {m}
                    </li>
                  ))}
                </ul>
              )}
              {courseTab === "Entry Requirements" && (
                <>
                  <EnglishTestNotices university={university} showMoi={course.level !== "Undergraduate"} className="mb-3" />
                  <ul className="space-y-2">
                    {(course.level === "Undergraduate" ? university.requirements.undergraduate : university.requirements.postgraduate).map((r) => (
                      <li key={r} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <CheckCircle2 size={13} className="shrink-0 text-emerald-500" /> {r}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {courseTab === "Careers" && (
                <ul className="space-y-2">
                  {curriculumForCourse(course).careers.map((c) => (
                    <li key={c} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <BriefcaseIcon size={13} className="shrink-0 text-violet-500" /> {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-4">
              <button onClick={() => setActiveCourseName(null)} className="text-xs font-medium text-slate-500">← University profile</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-5 overflow-x-auto border-t border-slate-100 px-5">
              {UNI_TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setUniTab(t)}
                  className={`relative shrink-0 whitespace-nowrap py-3 text-[13px] font-medium ${uniTab === t ? "text-[var(--brand-700)]" : "text-slate-400"}`}
                >
                  {t}
                  {uniTab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--brand-600)]" />}
                </button>
              ))}
            </div>
            <div className="p-5">
              {uniTab === "Overview" && (
                <div className="space-y-4">
                  <p className="text-xs leading-relaxed text-slate-600">{university.description}</p>
                  <RestrictedRegionsNotice university={university} />
                  <EnglishTestNotices university={university} />
                  <div className="grid grid-cols-3 gap-3">
                    <StatTile icon={<Trophy size={14} />} label="World rank" value={university.worldRank} />
                    <StatTile icon={<Briefcase size={14} />} label="Employability" value={university.employability} />
                    <StatTile icon={<Users size={14} />} label="Students" value={university.studentCount} />
                  </div>
                  <RankingCaption university={university} />
                  <div className="space-y-2">
                    {university.courses.length > 0 && (
                      <ExpandableSection icon={<BookOpen size={13} />} title="Courses" preview={coursesPreview(university)} defaultExpanded className="bg-slate-50">
                        <div className="space-y-1.5">
                          {university.courses.map((c) => (
                            <button
                              key={c.name}
                              onClick={() => { setActiveCourseName(c.name); setCourseTab("Overview"); }}
                              className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white p-2.5 text-left hover:bg-slate-50"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-slate-800">{c.name}</p>
                                <p className="truncate text-[11px] text-slate-400">{c.level} · {c.duration}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
                                {university.currencySymbol}{c.feeUSD.toLocaleString()}/yr <ChevronRight size={14} className="text-slate-300" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </ExpandableSection>
                    )}
                    {university.subjects.length > 0 && (
                      <ExpandableSection title="Subjects offered" preview={subjectsPreview(university)} className="bg-slate-50">
                        <div className="flex flex-wrap gap-1.5">
                          {university.subjects.map((s) => <Pill key={s} tone="gray">{s}</Pill>)}
                        </div>
                      </ExpandableSection>
                    )}
                    {(university.campuses ?? []).length > 0 && (
                      <ExpandableSection icon={<Building2 size={13} />} title="Campuses" preview={campusesPreview(university)} className="bg-slate-50">
                        <div className="space-y-1.5">
                          {university.campuses!.map((c) => (
                            <div key={c.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs">
                              <span className="text-slate-700">{c.name}</span>
                              <span className="text-slate-400">{c.city}</span>
                            </div>
                          ))}
                        </div>
                      </ExpandableSection>
                    )}
                    <ExpandableSection title="Why study here?" preview={highlightsPreview(university)} className="bg-slate-50">
                      <ul className="space-y-1.5">
                        {university.highlights.map((h) => (
                          <li key={h} className="flex items-start gap-2 text-xs text-slate-600">
                            <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" /> {h}
                          </li>
                        ))}
                      </ul>
                    </ExpandableSection>
                    <ExpandableSection icon={<CalendarDays size={13} />} title="Intakes" preview={intakesPreview(university)} className="bg-slate-50">
                      <IntakesBlock university={university} />
                    </ExpandableSection>
                    <ExpandableSection icon={<GraduationCap size={13} />} title="Scholarships" preview={scholarshipsPreview(university)} className="bg-slate-50">
                      <ScholarshipsBlock university={university} />
                    </ExpandableSection>
                    <ExpandableSection icon={<Landmark size={13} />} title="Deposit & Payment" preview={depositLabel(university) ?? undefined} defaultExpanded className="bg-slate-50">
                      <PaymentRequirementsBlock university={university} />
                    </ExpandableSection>
                    <ExpandableSection icon={<ListChecks size={13} />} title="Admission Procedure" preview={admissionStepsPreview(university)} className="bg-slate-50">
                      <AdmissionProcedureBlock university={university} />
                    </ExpandableSection>
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
                        {university.currencySymbol}{c.feeUSD.toLocaleString()}/yr <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    </button>
                  ))}
                  {university.courses.length === 0 && <p className="text-xs text-slate-400">No courses added yet.</p>}
                </div>
              )}
              {uniTab === "Requirements" && (
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
                    {university.fees.length === 0 && <p className="text-xs text-slate-400">No fee line items added yet.</p>}
                  </div>
                </div>
              )}
              {uniTab === "Country Guide" && <CountryGuideSection country={country} />}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 p-4">
              <a href={`https://www.${university.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-slate-500">
                Website <ExternalLink size={12} />
              </a>
              <button onClick={() => setUniTab("Courses")} className="rounded-full bg-[var(--brand-600)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-700)]">
                View Courses →
              </button>
            </div>
          </>
        )}
      </div>
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
