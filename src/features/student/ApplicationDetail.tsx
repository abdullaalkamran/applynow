import { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, MoreVertical, Heart, Calendar, MapPin, Check, FileText,
  Clock, Landmark, GraduationCap, ChevronRight, ChevronDown, MessageCircle, ExternalLink, ListChecks, AlertCircle,
} from "lucide-react";
import { LogoBadge, DocChecklistRow, SupportRow, type ScanStatus, type UploadedDoc } from "../../components/ui/mobile";
import {
  DOCUMENTS, CURRENT_STUDENT_ID,
  COUNSELLORS, AGENTS, ADMISSION_OFFICERS, COMPLIANCE_OFFICERS,
} from "../../data/mockData";
import { getAllStudents } from "../../data/allStudentsStore";
import { getAllApplications } from "../../data/applicationsStore";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { loadUploadedDocs, addUploadedDoc as addUploadedDocToStore } from "../../data/applicationDocsStore";
import { scholarshipLabel } from "../../utils/universityFilter";
import { docMatchesType, buildChecklist, buildCoreChecklist, coreDocTypes } from "../../utils/documentChecklist";
import { APPLICATION_STAGES as STEPS, applicationStageIndex as pipelineIndex } from "../../utils/applicationStatus";
import { loadNextSteps, toggleNextStepDone } from "../../data/applicationNextStepsStore";
import { ApplicationJourneyPanel, ApplicationCommentsCard } from "../../components/ApplicationJourneyPanel";

const TABS = ["Overview", "Documents", "Updates", "Comments"] as const;

const docStatusTone: Record<string, string> = {
  verified: "text-[var(--sd-teal)]",
  pending: "text-[#B8791C]",
  rejected: "text-rose-500",
  flagged: "text-rose-500",
};

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Lets a caller (the Dashboard's "Next Steps" list, a notification) deep-link straight to the
  // Documents tab of a specific application instead of always landing on Overview.
  const navState = location.state as { tab?: (typeof TABS)[number] } | null;
  const allApplications = getAllApplications();
  // Can be undefined for a moment right after a fresh page load / direct link, while
  // applicationsStore's cache is still being fetched (see warmCaches.ts) — every reference below
  // has to tolerate that, since React's Rules of Hooks mean the hooks that follow still have to run
  // on every render regardless; the actual "nothing to show yet" bail-out is after them.
  const application = allApplications.find((a) => a.id === id) ?? allApplications[0];
  const universities = getAllUniversities();
  const university = universities.find((u) => u.name === application?.university);
  const course = university?.courses.find((c) => c.name === application?.course);
  const currentIdx = pipelineIndex(application?.status ?? "Draft");
  const missingCoreDocs = buildCoreChecklist(application?.studentId ?? "").filter((row) => !row.own);
  const coreDocsBlocked = missingCoreDocs.length > 0;
  const visibleNextAction = coreDocsBlocked ? "Upload core documents" : application?.nextAction ?? "";
  const [tab, setTab] = useState<(typeof TABS)[number]>(navState?.tab ?? "Overview");
  const [saved, setSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [programInfoOpen, setProgramInfoOpen] = useState(true);
  const [, forceTick] = useState(0);
  const nextSteps = loadNextSteps(application?.id ?? "");

  const [uploadedDocs, setUploadedDocs] = useState(() => loadUploadedDocs(application?.id ?? ""));
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState<UploadedDoc | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const uploadInputRef = useRef<HTMLInputElement>(null);

  if (!application) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-slate-500">Loading this application…</p>
        <button onClick={() => navigate("/student/applications")} className="text-[13px] font-semibold text-[var(--sd-ink)]">
          Back to Applications
        </button>
      </div>
    );
  }

  function addUploadedDoc(name: string, file: File) {
    setUploadedDocs(addUploadedDocToStore(application.id, name, file));
  }

  // "Upload bank statement" -> "Bank statement" — the specific document this application's current
  // stage is actually blocked on, used to highlight the matching checklist row.
  const stageDocMatch = /^upload (.+)/i.exec(visibleNextAction);
  const stageDocName = stageDocMatch ? stageDocMatch[1].replace(/^./, (c) => c.toUpperCase()) : null;

  function startUpload(type: string) {
    setUploadingType(type);
    setUploadingFile(null);
    setScanStatus("idle");
    window.setTimeout(() => uploadInputRef.current?.click(), 0);
  }

  function handleUploadedFile(file: File) {
    if (!uploadingType) return;
    const isImage = file.type.startsWith("image/");
    setUploadingFile({ name: file.name, previewUrl: isImage ? URL.createObjectURL(file) : undefined });
    setScanStatus("scanning");
    const type = uploadingType;
    window.setTimeout(() => {
      setScanStatus("done");
      // The store itself uploads the real file bytes to the server (see applicationDocsStore.ts) —
      // it no longer needs (or accepts) a pre-built blob: URL here.
      addUploadedDoc(type, file);
      window.setTimeout(() => { setUploadingType(null); setUploadingFile(null); setScanStatus("idle"); }, 600);
    }, 1200);
  }

  const ringNumerator = Math.min(currentIdx + 1, STEPS.length - 1);
  const ringDenominator = STEPS.length - 1;
  const ringPct = ringDenominator > 0 ? ringNumerator / ringDenominator : 1;

  const stepDates = STEPS.map((_, i) => {
    if (i >= currentIdx) return null;
    const daysAgo = (currentIdx - i) * 3;
    const d = new Date(application.updatedAt);
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  });
  // "12 Sep" — fits under a ~45px-wide step column on a phone, where the full date wouldn't.
  const stepDatesShort = stepDates.map((full) => full?.replace(/\s\d{4}$/, "") ?? null);

  const linkedDocs = DOCUMENTS.filter((d) => d.studentId === CURRENT_STUDENT_ID && d.applicationId === application.id);
  const docs = [...linkedDocs, ...uploadedDocs];

  // Checklist auto-derived from this university's own stated requirements (plus universal
  // baseline docs like Passport). Anything already provided for one of the student's other
  // applications is recognised here automatically instead of asking them to upload it again.
  // buildChecklist tolerates `university` being undefined — a counsellor-requested item still
  // needs to show up even when the university name doesn't resolve to a catalog entry.
  const checklistRows = buildChecklist(university, application.studentId, application.id, docs).map((row) => ({
    ...row,
    isStageBlocker: stageDocName ? docMatchesType(stageDocName, row.type) : false,
  }));
  const coreTypes = coreDocTypes();
  const extraDocs = docs.filter(
    (d) => !checklistRows.some((row) => docMatchesType(d.name, row.type)) && !coreTypes.some((t) => docMatchesType(d.name, t))
  );
  // Surfaced on Overview so a counsellor's ad-hoc request (or any other unmet university-specific
  // requirement) isn't something the student only discovers by clicking into the Documents tab.
  const missingAppDocs = checklistRows.filter((row) => !row.own && !row.reused);

  const scholarship = course ? scholarshipLabel(university!) : null;

  const student = getAllStudents().find((s) => s.id === application.studentId);
  const reviewTeam = [
    student && COUNSELLORS.find((c) => c.id === student.counsellorId),
    student && AGENTS.find((a) => a.id === student.agentId),
    ADMISSION_OFFICERS[0],
    COMPLIANCE_OFFICERS[0],
  ].filter((c): c is NonNullable<typeof c> => !!c);

  return (
    <div className="min-h-full pb-8">
      <div className="lg:mx-auto lg:max-w-3xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <button onClick={() => navigate(-1)} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-800 shadow-[0_0_8px_rgba(0,0,0,0.07)]">
            <ArrowLeft size={17} />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-800 shadow-[0_0_8px_rgba(0,0,0,0.07)]"
            >
              <MoreVertical size={17} />
            </button>
            {menuOpen && (
              <>
                <button aria-hidden className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} tabIndex={-1} />
                <div className="absolute right-0 z-20 mt-1.5 w-48 overflow-hidden rounded-xl bg-[var(--sd-card)] py-1 shadow-[0_0_20px_rgba(0,0,0,0.15)]">
                  {university && (
                    <button
                      onClick={() => navigate(`/student/universities/${university.id}`)}
                      className="block w-full px-3.5 py-2.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                    >
                      View University Profile
                    </button>
                  )}
                  <button
                    onClick={() => navigate("/student/messages")}
                    className="block w-full px-3.5 py-2.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                  >
                    Message Counsellor
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <LogoBadge name={application.university} tone={university?.tone ?? "violet"} logoUrl={university?.logoUrl} className="h-12 w-12 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-slate-900">{application.university}</p>
                <p className="truncate text-xs text-slate-400">{university ? `${university.city}, ${university.country}` : application.country}</p>
              </div>
            </div>
            <button
              onClick={() => setSaved((v) => !v)}
              aria-label="Save"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600"
            >
              <Heart size={16} className={saved ? "fill-rose-500 text-rose-500" : ""} />
            </button>
          </div>

          <h1 className="mt-4 text-[22px] font-bold leading-tight text-slate-900">{application.course}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Calendar size={13} className="text-slate-400" /> {application.intake}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} className="text-slate-400" /> {application.campus ?? "Main Campus"}
            </span>
          </div>

          <div className="mt-5 flex items-center gap-5 overflow-x-auto border-b border-black/5">
            {TABS.map((t) => (
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
                {nextSteps.length > 0 && (
                  <div className="mb-5 rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                    <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
                      <ListChecks size={15} className="text-slate-400" /> Next Steps
                    </p>
                    <div className="space-y-2">
                      {nextSteps.map((ns) => (
                        <div
                          key={ns.id}
                          className={`flex items-center gap-2.5 rounded-xl p-2.5 ${ns.done ? "" : "border border-rose-200 bg-rose-50/60"}`}
                        >
                          <button
                            onClick={() => { if (!ns.done) { toggleNextStepDone(application.id, ns.id); forceTick((t) => t + 1); } }}
                            disabled={ns.done}
                            aria-label={ns.done ? `"${ns.title}" completed — locked` : `Mark "${ns.title}" done`}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              ns.done ? "border-[var(--sd-teal)] bg-[var(--sd-teal)] text-white" : "border-rose-300"
                            }`}
                          >
                            {ns.done && <Check size={11} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[13px] ${ns.done ? "text-slate-400 line-through" : "font-medium text-rose-700"}`}>{ns.title}</p>
                            {ns.done
                              ? ns.completedAt && (
                                  <p className="text-[11px] text-slate-400">
                                    Completed {new Date(`${ns.completedAt}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                                  </p>
                                )
                              : ns.dueDate && (
                                  <p className="text-[11px] text-rose-500">
                                    Due {new Date(`${ns.dueDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                                  </p>
                                )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {coreDocsBlocked && (
                  <button
                    onClick={() => navigate("/student/documents")}
                    className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <AlertCircle size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-amber-950">Upload core documents</p>
                      <p className="truncate text-[11.5px] text-amber-800">
                        Missing {missingCoreDocs.slice(0, 2).map((row) => row.type).join(", ")}
                        {missingCoreDocs.length > 2 ? ` and ${missingCoreDocs.length - 2} more` : ""}
                      </p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-amber-700" />
                  </button>
                )}

                {missingAppDocs.length > 0 && (
                  <button
                    onClick={() => setTab("Documents")}
                    className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                      <AlertCircle size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-rose-950">
                        {missingAppDocs.length} document{missingAppDocs.length === 1 ? "" : "s"} required for this application
                      </p>
                      <p className="truncate text-[11.5px] text-rose-800">
                        {missingAppDocs.slice(0, 2).map((row) => row.type).join(", ")}
                        {missingAppDocs.length > 2 ? ` and ${missingAppDocs.length - 2} more` : ""}
                      </p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-rose-700" />
                  </button>
                )}

                <div className="flex items-center gap-4 rounded-2xl bg-[#E7EEFC] p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#1B2C57]">Application Status</p>
                    <p className="mt-1 text-[19px] font-bold text-[#1B2C57]">{application.status}</p>
                  </div>
                  <ProgressRing pct={ringPct} label={`${ringNumerator} / ${ringDenominator}`} />
                </div>

                {/* Compact horizontal stepper — all 7 steps always fit the card width (each step is
                    an equal flex column that shrinks, labels wrap), so nothing scrolls or overflows
                    on a phone; capped at a modest max width on desktop so the connectors don't
                    stretch into long bars. The connector between step i and i+1 reads as done
                    exactly when step i is done. */}
                <div className="mx-auto mt-4 w-full max-w-md">
                  <div className="flex items-start">
                    {STEPS.map((label, i) => {
                      const done = i < currentIdx;
                      const current = i === currentIdx;
                      return (
                        <div key={label} className="flex min-w-0 flex-1 flex-col items-center">
                          <div className="flex w-full items-center">
                            <div className={`h-px flex-1 ${i === 0 ? "bg-transparent" : done || current ? "bg-[var(--sd-teal)]" : "bg-slate-200"}`} />
                            <div
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${
                                done ? "bg-[var(--sd-teal)] text-white" : current ? "bg-[image:var(--sd-gradient)] text-white" : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              {done ? <Check size={11} /> : i + 1}
                            </div>
                            <div className={`h-px flex-1 ${i === STEPS.length - 1 ? "bg-transparent" : done ? "bg-[var(--sd-teal)]" : "bg-slate-200"}`} />
                          </div>
                          {/* Labels wrap word-by-word and hyphenate ("Appli-cation") where a word is
                              wider than its ~45px phone column, so 7 of them sit side by side
                              without spilling into each other. */}
                          <p
                            lang="en"
                            className={`mt-1 w-full break-words px-0.5 text-center text-[8.5px] font-medium leading-[1.15] hyphens-auto sm:text-[10px] ${
                              current ? "text-[var(--sd-ink)]" : done ? "text-slate-700" : "text-slate-400"
                            }`}
                          >
                            {label}
                          </p>
                          {stepDates[i] && (
                            <p className="mt-0.5 w-full text-center text-[8px] leading-tight text-slate-400 sm:text-[9px]">
                              <span className="sm:hidden">{stepDatesShort[i]}</span>
                              <span className="hidden sm:inline">{stepDates[i]}</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-5">
                  <ApplicationJourneyPanel applicationId={application.id} mode="student" />
                </div>

                {course && university && (
                  <div className="rounded-2xl border border-slate-100 bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                    <button
                      onClick={() => setProgramInfoOpen((v) => !v)}
                      className="flex w-full items-center justify-between p-4 text-left"
                    >
                      <span className="text-[14px] font-semibold text-slate-900">Program Information</span>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${programInfoOpen ? "rotate-180" : ""}`} />
                    </button>
                    {programInfoOpen && (
                      <div className="px-4 pb-4">
                        <InfoRow icon={<Landmark size={15} />} label="Tuition Fee" value={`${university.currencySymbol}${course.feeUSD.toLocaleString()} per year`} />
                        <InfoRow icon={<Calendar size={15} />} label="Intake" value={application.intake} />
                        <InfoRow icon={<MapPin size={15} />} label="Campus" value={application.campus ?? "Main Campus"} />
                        <InfoRow icon={<GraduationCap size={15} />} label="Scholarship" value={scholarship ?? "Not available"} last />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {tab === "Documents" && (
              <div className="space-y-2.5">
                <button
                  onClick={() => navigate("/student/documents")}
                  className="flex w-full items-center justify-between gap-2 rounded-2xl border border-[#B9D4FA] bg-[#EEF4FE] p-3.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-[#1B2C57]">Core documents</p>
                    <p className="text-[11px] text-[#3A4B76]">Passport, transcript, CV, English & more — uploaded once, shared across every application</p>
                  </div>
                  <ChevronRight size={15} className="shrink-0 text-[#3A4B76]" />
                </button>

                <div>
                  <p className="text-[13px] font-semibold text-slate-900">University-Specific Checklist</p>
                  <p className="text-xs text-slate-400">What {university?.name ?? "this university"} needs beyond your core documents.</p>
                </div>

                {checklistRows.length === 0 && (
                  <p className="rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-3.5 text-[12.5px] text-slate-500 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                    This university doesn't need anything beyond your core documents.
                  </p>
                )}

                {checklistRows.map(({ type, own, reused, rejected, requested, isStageBlocker }) => (
                  <DocChecklistRow
                    key={type}
                    type={type}
                    own={own}
                    reused={reused}
                    rejected={rejected}
                    requested={requested}
                    highlighted={isStageBlocker}
                    highlightLabel={`Needed for the "${STEPS[currentIdx]}" stage`}
                    isUploading={uploadingType === type}
                    uploadingFile={uploadingFile}
                    scanStatus={scanStatus}
                    onStartUpload={() => startUpload(type)}
                    onCancelUpload={() => { setUploadingType(null); setUploadingFile(null); setScanStatus("idle"); }}
                  />
                ))}
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleUploadedFile(e.target.files[0]); e.target.value = ""; }}
                />

                {extraDocs.length > 0 && (
                  <div className="pt-1">
                    <p className="mb-2 text-xs font-medium text-slate-500">Other documents on file</p>
                    <div className="space-y-2">
                      {extraDocs.map((d) => (
                        <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-3.5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E7EEFC] text-[#2955C4]">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-slate-800">{d.name}</p>
                            <p className="text-xs text-slate-400">{d.type}</p>
                          </div>
                          <span className={`shrink-0 text-xs font-medium capitalize ${docStatusTone[d.status]}`}>{d.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => navigate("/student/documents")}
                  className="flex w-full items-center justify-center gap-1.5 py-2 text-[12.5px] font-medium text-slate-400"
                >
                  Manage all documents <ChevronRight size={13} />
                </button>

                {reviewTeam.length > 0 && (
                  <div className="pt-2">
                    <p className="mb-2 text-[13px] font-semibold text-slate-900">Your Application Team</p>
                    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                      {reviewTeam.map((contact, i) => (
                        <div key={contact.id}>
                          {i > 0 && <div className="border-t border-slate-50" />}
                          <SupportRow contact={contact} onChat={() => navigate("/student/messages")} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "Updates" && (
              <div className="space-y-2.5">
                {STEPS.map((label, i) => {
                  if (i > currentIdx) return null;
                  const isCurrent = i === currentIdx;
                  return (
                    <div key={label} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-3.5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7EEFC] text-[#2955C4]">
                        <Clock size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-800">{label}</p>
                        <p className="text-xs text-slate-400">{stepDates[i] ?? "Today"}</p>
                        {isCurrent && <p className="mt-0.5 text-xs text-slate-500">{visibleNextAction}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "Comments" && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-slate-600">
                  <MessageCircle size={15} className="text-slate-400" /> Comments on this application
                </div>
                <p className="mb-3 text-xs text-slate-400">
                  Visible to your counsellor, admission officer and agent — they'll be notified when you post.
                </p>
                <ApplicationCommentsCard applicationId={application.id} />
              </div>
            )}
          </div>
        </div>
      </div>

      {tab === "Overview" && (
        <div className="sticky bottom-0 mt-2 flex items-center gap-3 bg-[var(--sd-bg)] px-5 py-4 lg:mx-auto lg:max-w-3xl">
          <button
            onClick={() => navigate("/student/messages")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-[var(--sd-card)] py-3 text-[13px] font-semibold text-slate-700"
          >
            Contact University <MessageCircle size={14} />
          </button>
          {university && (
            <button
              onClick={() => navigate(`/student/universities/${university.id}`, { state: { selectedCourseName: application.course } })}
              className="flex flex-[1.3] items-center justify-center gap-1.5 rounded-full bg-[image:var(--sd-gradient)] py-3 text-[13px] font-semibold text-white"
            >
              View Program <ExternalLink size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressRing({ pct, label }: { pct: number; label: string }) {
  const size = 56;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(1, Math.max(0, pct)));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#C9D6F2" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--sd-teal)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#1B2C57]">{label}</span>
    </div>
  );
}

function InfoRow({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 ${last ? "" : "border-b border-slate-50"}`}>
      <span className="text-slate-400">{icon}</span>
      <span className="flex-1 text-[13px] text-slate-500">{label}</span>
      <span className="text-[13px] font-medium text-slate-800">{value}</span>
    </div>
  );
}
