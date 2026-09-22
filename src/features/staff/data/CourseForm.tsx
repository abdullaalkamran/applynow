import { safeHref } from "../../../utils/safeHref";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ExternalLink, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "../../../components/ui";
import { getAllSubjects } from "../../../data/subjectsStore";
import { getUniversityById, addCourse, updateCourse, removeCourse, refreshUniversities } from "../../../data/universityCatalogStore";
import {
  approveCourseImport, getCachedCourseImport, listCourseImports, type CourseDraft, type CourseImportItem, type DraftFieldKey,
} from "../../../data/courseImportsStore";
import { useHoldCacheSync } from "../../../utils/syncCache";
import { ChipListEditor } from "./ChipListEditor";
import { TEST_NAME_OPTIONS, PROGRAM_LEVEL_OPTIONS, STANDARDIZED_TEST_OPTIONS } from "../../../utils/universityFilter";
import type { University, CourseAccreditation } from "../../../types";

const CURRENCY_OPTIONS = ["$", "£", "€", "C$", "A$", "AED "];
const STUDY_MODE_OPTIONS = ["Full-time", "Part-time", "Online", "Blended"];
const COMMON_SKILLS = ["Listening", "Reading", "Writing", "Speaking"];
type EnglishReq = NonNullable<University["courses"][number]["englishRequirements"]>[number];

function blankEnglishReq(): EnglishReq {
  return { testName: TEST_NAME_OPTIONS[0], minScore: "", skillScores: [] };
}

// Duration is stored as a plain string ("18 months", "1 year", "1.5 years") so every existing display
// site keeps working; the form edits it as a number + unit and formats it on save.
type DurationUnit = "months" | "years";
function parseDuration(text: string | undefined): { amount: string; unit: DurationUnit } {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(month|year)/i.exec(text ?? "");
  if (!m) return { amount: "1", unit: "years" };
  return { amount: m[1], unit: m[2].toLowerCase() === "month" ? "months" : "years" };
}
function formatDuration(amount: string, unit: DurationUnit): string {
  const n = Number(amount);
  if (!n || n <= 0) return "";
  const singular = unit === "months" ? "month" : "year";
  return `${n} ${n === 1 ? singular : unit}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type Course = University["courses"][number];

/** Resolves the route (university, course being edited, or an AI import row via `?importId=`) and
 * hands a fully-known starting point to CourseEditor. Without `?importId=` this is exactly the
 * add/edit form it always was — the import mode only adds a review banner and per-field flags. */
export default function DataCourseForm() {
  const navigate = useNavigate();
  const { id, courseId } = useParams();
  const [searchParams] = useSearchParams();
  const importId = searchParams.get("importId");
  const university = id ? getUniversityById(id) : undefined;
  const existing = university?.courses.find((c) => c.id === courseId);

  // An import row is usually already in the store's memory (we came from the queue); on a cold
  // reload it's fetched by listing the university's queue.
  const [importItem, setImportItem] = useState<CourseImportItem | undefined>(() => (importId ? getCachedCourseImport(importId) : undefined));
  const [importMissing, setImportMissing] = useState(false);
  useEffect(() => {
    if (!importId || importItem || !id) return;
    let cancelled = false;
    listCourseImports(id)
      .then((items) => {
        if (cancelled) return;
        const found = items.find((i) => i.id === importId);
        if (found) setImportItem(found);
        else setImportMissing(true);
      })
      .catch(() => { if (!cancelled) setImportMissing(true); });
    return () => { cancelled = true; };
  }, [importId, importItem, id]);

  if (!university) {
    return (
      <div>
        <button onClick={() => navigate("/staff/data")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
          <ArrowLeft size={14} /> Back to Countries
        </button>
        <p className="text-xs text-slate-400">University not found.</p>
      </div>
    );
  }

  if (importId && !importItem) {
    const importBack = `/staff/data/universities/${university.id}/courses/import`;
    return (
      <div>
        <button onClick={() => navigate(importBack)} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
          <ArrowLeft size={14} /> Back to import queue
        </button>
        <p className="text-xs text-slate-400">{importMissing ? "That import row no longer exists." : "Loading the imported draft…"}</p>
      </div>
    );
  }

  return (
    <CourseEditor
      key={importId ?? courseId ?? "new"}
      university={university}
      existing={existing}
      importItem={importItem}
    />
  );
}

function CourseEditor({ university, existing, importItem }: { university: University; existing?: Course; importItem?: CourseImportItem }) {
  const navigate = useNavigate();
  const isNew = !existing;
  // Import mode: the AI draft seeds every field, and the review metadata drives the flags below.
  const initial: CourseDraft | undefined = importItem?.extracted?.course;
  const base = existing ?? initial;
  const attention = new Set<DraftFieldKey>(importItem?.extracted?.needsAttention ?? []);
  const evidence = importItem?.extracted?.evidence ?? {};
  const flag = (key: DraftFieldKey) => (importItem && attention.has(key) ? { evidence: evidence[key] } : undefined);
  // Keeps a half-edited course from being wiped by the shell's remount on every cache change.
  useHoldCacheSync();
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(base?.name ?? "");
  // Only the subjects this university offers (ticked on its own form, plus any its existing courses
  // already use) — a course can't be in a field the university doesn't teach. An existing course
  // whose subject was since removed from the university still shows its own value so editing it
  // doesn't silently reassign it. Falls back to the full list only while the university has no
  // subjects at all, so the form isn't a dead end.
  const universitySubjects = university.subjects?.length ? university.subjects : getAllSubjects();
  const subjectOptions = existing?.subject && !universitySubjects.includes(existing.subject)
    ? [existing.subject, ...universitySubjects]
    : universitySubjects;
  // An imported draft whose subject the AI couldn't match starts on an explicit "choose" entry
  // (and can't be approved until one is picked) instead of silently defaulting to the first.
  const [subject, setSubject] = useState(base?.subject ?? (importItem ? "" : subjectOptions[0] ?? ""));
  const [level, setLevel] = useState(base?.level ?? "Postgraduate");
  // An imported draft with no duration starts blank (the reviewer must fill it) instead of the
  // form's usual 1-year default, which would look like something the page said.
  const [durationAmount, setDurationAmount] = useState(importItem && !base?.duration ? "" : parseDuration(base?.duration).amount);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(parseDuration(base?.duration).unit);
  const duration = formatDuration(durationAmount, durationUnit);
  const [feeUSD, setFeeUSD] = useState(String(base?.feeUSD ?? 20000));
  const [currencySymbol, setCurrencySymbol] = useState(base?.currencySymbol ?? university.currencySymbol ?? "$");
  const [campusIds, setCampusIds] = useState<Set<string>>(new Set(base?.campusIds ?? []));
  const [description, setDescription] = useState(base?.description ?? "");
  const [studyMode, setStudyMode] = useState(base?.studyMode ?? "Full-time");
  const [modules, setModules] = useState<string[]>(base?.modules ?? []);
  const [careers, setCareers] = useState<string[]>(base?.careers ?? []);
  const [accreditations, setAccreditations] = useState<CourseAccreditation[]>(base?.accreditations ?? []);
  const [intakes, setIntakes] = useState<Set<string>>(new Set(base?.intakes ?? []));
  const [applicationDeadline, setApplicationDeadline] = useState(base?.applicationDeadline ?? "");
  const [sameAcademic, setSameAcademic] = useState((base?.requirements ?? []).length === 0);
  const [requirements, setRequirements] = useState((base?.requirements ?? []).join("\n"));
  const [sameEnglish, setSameEnglish] = useState((base?.englishRequirements ?? []).length === 0);
  const [englishTests, setEnglishTests] = useState<EnglishReq[]>(base?.englishRequirements ?? []);
  const [programLevel, setProgramLevel] = useState<Set<string>>(new Set(base?.programLevel ?? []));
  const [standardizedTests, setStandardizedTests] = useState<Set<string>>(new Set(base?.standardizedTests ?? []));
  const [mathsRequired, setMathsRequired] = useState(base?.mathsRequired ?? true);
  const [isStemProgram, setIsStemProgram] = useState(base?.isStemProgram ?? false);
  const [accepts15YearsEducation, setAccepts15YearsEducation] = useState(base?.accepts15YearsEducation ?? false);

  const backTarget = `/staff/data/universities/${university.id}`;
  const importBack = `/staff/data/universities/${university.id}/courses/import`;
  const canSubmit = !!name.trim() && !!duration.trim() && (!importItem || !!subject) && !saving;
  const availableMonths = university.intakes.length > 0 ? university.intakes : MONTHS;

  function toggleCampus(id: string) {
    setCampusIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function updateAccreditation(i: number, patch: Partial<CourseAccreditation>) {
    setAccreditations((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  async function handleAccreditationLogo(i: number, file: File | undefined) {
    if (!file) return;
    updateAccreditation(i, { logoUrl: await readFileAsDataUrl(file) });
  }

  function toggleIntake(month: string) {
    setIntakes((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month); else next.add(month);
      return next;
    });
  }

  function toggleInSet(setter: Dispatch<SetStateAction<Set<string>>>, value: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  }

  function updateEnglishReq(i: number, patch: Partial<EnglishReq>) {
    setEnglishTests((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function setSkillScore(testIdx: number, skill: string, score: string) {
    setEnglishTests((prev) =>
      prev.map((e, idx) => {
        if (idx !== testIdx) return e;
        const rest = (e.skillScores ?? []).filter((s) => s.skill !== skill);
        const next = score.trim() ? [...rest, { skill, score }] : rest;
        next.sort((a, b) => COMMON_SKILLS.indexOf(a.skill) - COMMON_SKILLS.indexOf(b.skill));
        return { ...e, skillScores: next };
      })
    );
  }

  function handleSubmit() {
    const data = {
      name: name.trim(),
      subject,
      level,
      duration: duration.trim(),
      feeUSD: Number(feeUSD) || 0,
      currencySymbol,
      campusIds: [...campusIds],
      description: description.trim() || undefined,
      studyMode,
      modules,
      careers,
      accreditations: accreditations.map((a) => ({ ...a, name: a.name.trim() })).filter((a) => a.name),
      intakes: [...intakes],
      applicationDeadline: applicationDeadline || undefined,
      requirements: sameAcademic ? [] : requirements.split("\n").map((s) => s.trim()).filter(Boolean),
      englishRequirements: sameEnglish
        ? []
        : englishTests
            .map((e) => ({
              ...e,
              minScore: e.minScore?.trim() || undefined,
              skillScores: (e.skillScores ?? []).filter((s) => s.skill.trim() && s.score.trim()),
            }))
            .filter((e) => e.minScore || e.skillScores.length > 0),
      programLevel: [...programLevel],
      standardizedTests: [...standardizedTests],
      mathsRequired,
      isStemProgram,
      accepts15YearsEducation,
    };
    if (importItem) {
      setSaving(true);
      setSaveError("");
      approveCourseImport(importItem.id, data)
        .then(async () => {
          await refreshUniversities();
          navigate(importBack);
        })
        .catch((err) => {
          setSaveError(err instanceof Error ? err.message : "Couldn't approve this course.");
          setSaving(false);
        });
      return;
    }
    if (existing) updateCourse(university.id, existing.id, data);
    else addCourse(university.id, data);
    navigate(backTarget, { state: { tab: "Courses" } });
  }

  function handleDelete() {
    if (!existing) return;
    if (!window.confirm(`Remove "${existing.name}" from ${university.name}? This can't be undone.`)) return;
    removeCourse(university.id, existing.id);
    navigate(backTarget, { state: { tab: "Courses" } });
  }

  return (
    <div className="max-w-lg">
      <button
        onClick={() => (importItem ? navigate(importBack) : navigate(backTarget, { state: { tab: "Courses" } }))}
        className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]"
      >
        <ArrowLeft size={14} /> {importItem ? "Back to import queue" : `Back to ${university.name}`}
      </button>

      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{importItem ? "Review imported course" : isNew ? "Add Course" : `Edit — ${existing?.name}`}</h1>
        {existing && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-slate-500">{existing.id}</span>}
      </div>
      <p className="mb-6 text-xs text-slate-500">{university.name}</p>

      {importItem && <ImportReviewBanner item={importItem} />}

      <div className="space-y-5">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <Field label="Course name" attention={flag("name")}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MSc Data Science" className={INPUT_CLASS} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Subject" attention={flag("subject")}>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className={INPUT_CLASS}>
                {importItem && !subject && <option value="">— choose a subject —</option>}
                {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {importItem?.extracted?.subjectGuess && !subject && (
                <p className="mt-1 text-[11px] text-amber-700">
                  The page suggests "{importItem.extracted.subjectGuess}", which isn't in {university.name}'s subject list — pick the closest, or add it on Edit Details first.
                </p>
              )}
              {!university.subjects?.length && (
                <p className="mt-1 text-[11px] text-amber-700">{university.name} has no subjects selected yet — showing every subject. Pick its subjects on Edit Details.</p>
              )}
            </Field>
            <Field label="Level" attention={flag("level")}>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className={INPUT_CLASS}>
                <option>Undergraduate</option>
                <option>Postgraduate</option>
              </select>
            </Field>
            <Field label="Duration" attention={flag("duration")}>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={durationAmount}
                  onChange={(e) => setDurationAmount(e.target.value)}
                  placeholder="e.g. 18"
                  aria-label="Duration amount"
                  className={`${INPUT_CLASS} w-24`}
                />
                <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as DurationUnit)} aria-label="Duration unit" className={INPUT_CLASS}>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
              {duration && <p className="mt-1 text-[11px] text-slate-400">Shown as "{duration}"</p>}
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Currency">
                <select value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} className={INPUT_CLASS}>
                  {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c.trim()}</option>)}
                </select>
              </Field>
              <Field label="Annual fee" attention={flag("feeUSD")}>
                <input type="number" value={feeUSD} onChange={(e) => setFeeUSD(e.target.value)} className={INPUT_CLASS} />
              </Field>
            </div>
            <Field label="Study mode" attention={flag("studyMode")}>
              <select value={studyMode} onChange={(e) => setStudyMode(e.target.value)} className={INPUT_CLASS}>
                {STUDY_MODE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description (shown at the top of the course page)" attention={flag("description")}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${INPUT_CLASS} resize-y`}
              placeholder={`Leave blank for an automatic one-liner: "This ${level.toLowerCase()} programme gives you a strong foundation in ${subject}…"`}
            />
          </Field>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-800">Campuses</p>
          {(university.campuses ?? []).length === 0 ? (
            <p className="text-[11px] text-slate-400">
              {university.name} has no campuses entered yet — add them from Edit Details on the university, then tick the ones this course runs at.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-slate-400">Tick every campus this course runs at — leave all unticked if it's offered at every campus.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {university.campuses!.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
                    <input type="checkbox" checked={campusIds.has(c.id)} onChange={() => toggleCampus(c.id)} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="shrink-0 text-[10.5px] text-slate-400">{c.city}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-800">Program Level</p>
          <p className="text-[11px] text-slate-400">Tick every category this program falls under — powers the Advanced Search "Program Level" filter, separate from the Level dropdown above.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PROGRAM_LEVEL_OPTIONS.map((p) => (
              <label key={p} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
                <input type="checkbox" checked={programLevel.has(p)} onChange={() => toggleInSet(setProgramLevel, p)} />
                {p}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-800">Standardized Tests & Eligibility</p>
          <p className="text-[11px] text-slate-400">Standardized admission tests this course requires or accepts — distinct from the English Requirements below.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STANDARDIZED_TEST_OPTIONS.map((t) => (
              <label key={t} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
                <input type="checkbox" checked={standardizedTests.has(t)} onChange={() => toggleInSet(setStandardizedTests, t)} />
                {t}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
              <input type="checkbox" checked={mathsRequired} onChange={(e) => setMathsRequired(e.target.checked)} />
              Maths required
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
              <input type="checkbox" checked={isStemProgram} onChange={(e) => setIsStemProgram(e.target.checked)} />
              STEM program
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
              <input type="checkbox" checked={accepts15YearsEducation} onChange={(e) => setAccepts15YearsEducation(e.target.checked)} />
              Accepts 15 years of education
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-800">Intakes & Deadline {flag("intakes") && <CheckPill />}</p>
          {flag("intakes")?.evidence && <Evidence text={flag("intakes")!.evidence!} />}
          <p className="text-[11px] text-slate-400">Toggle which of the university's intakes this course runs in — leave all unchecked to follow the university's general schedule.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {availableMonths.map((m) => (
              <label key={m} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
                <input type="checkbox" checked={intakes.has(m)} onChange={() => toggleIntake(m)} />
                {m}
              </label>
            ))}
          </div>
          <Field label="Application deadline for this course" attention={flag("applicationDeadline")}>
            <input type="date" value={applicationDeadline} onChange={(e) => setApplicationDeadline(e.target.value)} className={`${INPUT_CLASS} w-40`} />
          </Field>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-800">Academic Requirements {flag("requirements") && <CheckPill />}</p>
            <SameToggle same={sameAcademic} onChange={setSameAcademic} />
          </div>
          {sameAcademic ? (
            <p className="text-[11px] text-slate-400">This course follows {university.name}'s general {level.toLowerCase()} academic requirements.</p>
          ) : (
            <Field label="Requirements specific to this course (one per line)">
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                rows={3}
                className={`${INPUT_CLASS} resize-y`}
                placeholder={"Relevant bachelor's degree in a related field\nPortfolio submission required"}
              />
            </Field>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-800">English Requirements {flag("englishRequirements") && <CheckPill />}</p>
            <SameToggle same={sameEnglish} onChange={setSameEnglish} />
          </div>
          {sameEnglish ? (
            <p className="text-[11px] text-slate-400">This course follows {university.name}'s general {level.toLowerCase()} English requirements.</p>
          ) : (
            <>
              <div className="flex justify-end">
                <button onClick={() => setEnglishTests((prev) => [...prev, blankEnglishReq()])} className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]">
                  <Plus size={13} /> Add test
                </button>
              </div>
              {englishTests.length === 0 && <p className="text-xs text-slate-400">No course-specific tests added yet.</p>}
              <div className="space-y-3">
                {englishTests.map((e, i) => (
                  <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                    <div className="flex items-center gap-2">
                      <select value={e.testName} onChange={(ev) => updateEnglishReq(i, { testName: ev.target.value })} className={`${INPUT_CLASS} flex-1`}>
                        {TEST_NAME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        value={e.minScore ?? ""}
                        onChange={(ev) => updateEnglishReq(i, { minScore: ev.target.value })}
                        placeholder="Overall score"
                        className={`${INPUT_CLASS} w-32`}
                      />
                      <button onClick={() => setEnglishTests((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove test" className="shrink-0 text-slate-300 hover:text-rose-500">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                      {COMMON_SKILLS.map((skill) => (
                        <label key={skill} className="block">
                          <span className="mb-0.5 block text-[10px] text-slate-400">{skill}</span>
                          <input
                            value={(e.skillScores ?? []).find((s) => s.skill === skill)?.score ?? ""}
                            onChange={(ev) => setSkillScore(i, skill, ev.target.value)}
                            placeholder="—"
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-800"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-800">Modules {flag("modules") && <CheckPill />}</p>
          <p className="text-[11px] text-slate-400">This course's own curriculum — shown on its Modules tab.</p>
          <ChipListEditor label="Add a module" placeholder="e.g. Algorithms & Data Structures" items={modules} onChange={setModules} />
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-800">Careers {flag("careers") && <CheckPill />}</p>
          <p className="text-[11px] text-slate-400">Career outcomes for graduates of this course — shown on its Careers tab.</p>
          <ChipListEditor label="Add a career outcome" placeholder="e.g. Software Engineer" items={careers} onChange={setCareers} />
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-800">Accreditation</p>
              <p className="text-[11px] text-slate-400">Bodies that accredit this course — name and logo, shown on the course page.</p>
            </div>
            <button onClick={() => setAccreditations((prev) => [...prev, { name: "" }])} className="flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--brand-600)]">
              <Plus size={13} /> Add body
            </button>
          </div>
          {accreditations.length === 0 && <p className="text-xs text-slate-400">No accrediting bodies added yet.</p>}
          <div className="space-y-2">
            {accreditations.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {a.logoUrl ? (
                    <img src={a.logoUrl} alt={`${a.name || "Accrediting body"} logo`} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-300">Logo</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    value={a.name}
                    onChange={(e) => updateAccreditation(i, { name: e.target.value })}
                    placeholder="Accrediting body, e.g. ABET"
                    className={INPUT_CLASS}
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-[var(--brand-600)]">
                      <Upload size={12} /> {a.logoUrl ? "Replace logo" : "Upload logo"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAccreditationLogo(i, e.target.files?.[0])} />
                    </label>
                    {a.logoUrl && (
                      <button onClick={() => updateAccreditation(i, { logoUrl: undefined })} className="text-[11px] font-medium text-slate-400 hover:text-rose-500">
                        Remove logo
                      </button>
                    )}
                  </div>
                </div>
                <button onClick={() => setAccreditations((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove accrediting body" className="shrink-0 text-slate-300 hover:text-rose-500">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">
          Scholarships are managed on the university's own Scholarship Amount section, since a university's scholarship offers are rarely
          tied to just one course.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
        {existing ? (
          <button onClick={handleDelete} className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700">
            <Trash2 size={14} /> Delete course
          </button>
        ) : <span />}
        <div className="flex items-center gap-3">
          {saveError && <p className="text-[11.5px] text-rose-600">{saveError}</p>}
          <Button variant="secondary" onClick={() => (importItem ? navigate(importBack) : navigate(backTarget, { state: { tab: "Courses" } }))}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            {importItem ? (saving ? "Approving…" : "Approve & add course") : isNew ? "Add Course" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SameToggle({ same, onChange }: { same: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className={same ? "font-medium text-slate-700" : "text-slate-400"}>Same as university</span>
      <button
        type="button"
        role="switch"
        aria-checked={!same}
        onClick={() => onChange(!same)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${same ? "bg-slate-200" : "bg-[var(--brand-600)]"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${same ? "left-0.5" : "left-4.5"}`} />
      </button>
      <span className={!same ? "font-medium text-slate-700" : "text-slate-400"}>Different</span>
    </div>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const INPUT_CLASS = "w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800";

/** `attention` (import mode only) marks a field the reviewer must verify against the source page,
 * with the page's own words underneath when the extractor captured them. */
function Field({ label, children, attention }: { label: string; children: React.ReactNode; attention?: { evidence?: string } }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      <span className="flex items-center gap-2">{label} {attention && <CheckPill />}</span>
      <div className="mt-1">{children}</div>
      {attention?.evidence && <Evidence text={attention.evidence} />}
    </label>
  );
}

function CheckPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
      <AlertTriangle size={10} /> Check
    </span>
  );
}

function Evidence({ text }: { text: string }) {
  return <p className="mt-1 text-[11px] italic text-slate-400">Page says: “{text}”</p>;
}

/** Everything the reviewer should know before trusting the draft: where it came from, what the
 * extractor wasn't sure about, and whether it looks like a course the university already lists. */
function ImportReviewBanner({ item }: { item: CourseImportItem }) {
  const extracted = item.extracted;
  const host = (() => { try { return new URL(item.sourceUrl).hostname; } catch { return item.sourceUrl; } })();
  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
        <Sparkles size={13} /> AI-drafted from{" "}
        <a href={safeHref(item.sourceUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-2">
          {host} <ExternalLink size={11} />
        </a>
        {extracted?.meta?.model && <span className="font-normal text-amber-700">· {extracted.meta.model}</span>}
      </p>
      <p className="mt-1 text-[11.5px] text-amber-800">
        Nothing is saved until you approve. Fields marked <CheckPill /> must be verified against the page — fees, deadlines and English scores always are.
      </p>
      {extracted?.possibleDuplicateOf && (
        <p className="mt-2 rounded-lg bg-rose-100 px-2.5 py-1.5 text-[11.5px] font-medium text-rose-800">
          Looks like a duplicate of the existing course "{extracted.possibleDuplicateOf.name}".
        </p>
      )}
      {!!extracted?.warnings?.length && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11.5px] text-amber-800">
          {extracted.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}
