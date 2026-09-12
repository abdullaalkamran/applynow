import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui";
import { getAllSubjects } from "../../../data/subjectsStore";
import { getUniversityById, addCourse, updateCourse, removeCourse } from "../../../data/universityCatalogStore";

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

  function handleSubmit() {
    const data = { name: name.trim(), subject, level, duration: duration.trim(), feeUSD: Number(feeUSD) || 0 };
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
          <Field label="Annual fee (USD)">
            <input type="number" value={feeUSD} onChange={(e) => setFeeUSD(e.target.value)} className={INPUT_CLASS} />
          </Field>
        </div>
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

const INPUT_CLASS = "w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
