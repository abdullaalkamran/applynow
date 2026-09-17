import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui";
import { getAllSubjects } from "../../../data/subjectsStore";
import { getUniversityById, addCourse, updateCourse, removeCourse } from "../../../data/universityCatalogStore";
import { TEST_NAME_OPTIONS } from "../../../utils/universityFilter";
import type { University } from "../../../types";

const CURRENCY_OPTIONS = ["$", "£", "€", "C$", "A$", "AED "];
const COMMON_SKILLS = ["Listening", "Reading", "Writing", "Speaking"];
type EnglishReq = NonNullable<University["courses"][number]["englishRequirements"]>[number];

function blankEnglishReq(): EnglishReq {
  return { testName: TEST_NAME_OPTIONS[0], minScore: "", skillScores: [] };
}

export default function DataCourseForm() {
  const navigate = useNavigate();
  const { id, courseId } = useParams();
  const university = id ? getUniversityById(id) : undefined;
  const existing = university?.courses.find((c) => c.id === courseId);
  const isNew = !courseId;

  const [name, setName] = useState(existing?.name ?? "");
  const [subject, setSubject] = useState(existing?.subject ?? getAllSubjects()[0]);
  const [level, setLevel] = useState(existing?.level ?? "Postgraduate");
  const [duration, setDuration] = useState(existing?.duration ?? "1 year");
  const [feeUSD, setFeeUSD] = useState(String(existing?.feeUSD ?? 20000));
  const [currencySymbol, setCurrencySymbol] = useState(existing?.currencySymbol ?? university?.currencySymbol ?? "$");
  const [campusId, setCampusId] = useState(existing?.campusId ?? "");
  const [intakes, setIntakes] = useState<Set<string>>(new Set(existing?.intakes ?? []));
  const [applicationDeadline, setApplicationDeadline] = useState(existing?.applicationDeadline ?? "");
  const [sameAcademic, setSameAcademic] = useState((existing?.requirements ?? []).length === 0);
  const [requirements, setRequirements] = useState((existing?.requirements ?? []).join("\n"));
  const [sameEnglish, setSameEnglish] = useState((existing?.englishRequirements ?? []).length === 0);
  const [englishTests, setEnglishTests] = useState<EnglishReq[]>(existing?.englishRequirements ?? []);

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

  const backTarget = `/staff/data/universities/${university.id}`;
  const canSubmit = name.trim() && duration.trim();
  const availableMonths = university.intakes.length > 0 ? university.intakes : MONTHS;

  function toggleIntake(month: string) {
    setIntakes((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month); else next.add(month);
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
      campusId: campusId || undefined,
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
    };
    if (existing) updateCourse(university!.id, existing.id, data);
    else addCourse(university!.id, data);
    navigate(backTarget, { state: { tab: "Courses" } });
  }

  function handleDelete() {
    if (!existing) return;
    if (!window.confirm(`Remove "${existing.name}" from ${university!.name}? This can't be undone.`)) return;
    removeCourse(university!.id, existing.id);
    navigate(backTarget, { state: { tab: "Courses" } });
  }

  return (
    <div className="max-w-lg">
      <button onClick={() => navigate(backTarget, { state: { tab: "Courses" } })} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
        <ArrowLeft size={14} /> Back to {university.name}
      </button>

      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{isNew ? "Add Course" : `Edit — ${existing?.name}`}</h1>
        {existing && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-slate-500">{existing.id}</span>}
      </div>
      <p className="mb-6 text-xs text-slate-500">{university.name}</p>

      <div className="space-y-5">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <Field label="Course name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MSc Data Science" className={INPUT_CLASS} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Subject">
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className={INPUT_CLASS}>
                {getAllSubjects().map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Level">
              <select value={level} onChange={(e) => setLevel(e.target.value)} className={INPUT_CLASS}>
                <option>Undergraduate</option>
                <option>Postgraduate</option>
              </select>
            </Field>
            <Field label="Duration">
              <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 1 year" className={INPUT_CLASS} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Currency">
                <select value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} className={INPUT_CLASS}>
                  {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c.trim()}</option>)}
                </select>
              </Field>
              <Field label="Annual fee">
                <input type="number" value={feeUSD} onChange={(e) => setFeeUSD(e.target.value)} className={INPUT_CLASS} />
              </Field>
            </div>
            {(university.campuses ?? []).length > 0 && (
              <Field label="Campus">
                <select value={campusId} onChange={(e) => setCampusId(e.target.value)} className={INPUT_CLASS}>
                  <option value="">Any campus</option>
                  {university.campuses!.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-800">Intakes & Deadline</p>
          <p className="text-[11px] text-slate-400">Toggle which of the university's intakes this course runs in — leave all unchecked to follow the university's general schedule.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {availableMonths.map((m) => (
              <label key={m} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
                <input type="checkbox" checked={intakes.has(m)} onChange={() => toggleIntake(m)} />
                {m}
              </label>
            ))}
          </div>
          <Field label="Application deadline for this course">
            <input type="date" value={applicationDeadline} onChange={(e) => setApplicationDeadline(e.target.value)} className={`${INPUT_CLASS} w-40`} />
          </Field>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-800">Academic Requirements</p>
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
            <p className="text-xs font-semibold text-slate-800">English Requirements</p>
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
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate(backTarget, { state: { tab: "Courses" } })}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>{isNew ? "Add Course" : "Save Changes"}</Button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
