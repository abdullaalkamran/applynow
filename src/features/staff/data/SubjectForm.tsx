// Add/Edit Subject — a field of study's "why this subject" blurb, curriculum modules, and
// recognized accrediting bodies. Mirrors CountryForm.tsx's pattern (full page, sectioned cards),
// with a repeatable chip-list editor for Modules/Accreditation instead of a comma-separated field.
import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../../components/ui";
import { getSubjectCatalog, createSubjectRecord, updateSubjectRecord } from "../../../data/subjectCatalogStore";
import { ChipListEditor } from "./ChipListEditor";

const BASE_INPUT_CLASS = "rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-800">{title}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

export default function DataSubjectForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const existing = id ? getSubjectCatalog().find((s) => s.id === id) : undefined;
  // /staff/data/subjects/new?name=… lets the subjects list's "Add details" link on a built-in,
  // not-yet-authored field of study pre-fill the name instead of starting from a blank form.
  const prefillName = new URLSearchParams(window.location.search).get("name") ?? "";
  const isNew = !existing;

  const [name, setName] = useState(existing?.name ?? prefillName);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [modules, setModules] = useState<string[]>(existing?.modules ?? []);
  const [careers, setCareers] = useState<string[]>(existing?.careers ?? []);
  const [accreditations, setAccreditations] = useState<string[]>(existing?.accreditations ?? []);
  const [saving, setSaving] = useState(false);
  const canSubmit = name.trim().length > 0 && !saving;

  async function handleSubmit() {
    setSaving(true);
    try {
      const input = { name: name.trim(), description: description.trim() || undefined, modules, careers, accreditations };
      if (existing) await updateSubjectRecord(existing.id, input);
      else await createSubjectRecord(input);
      navigate("/staff/data/subjects");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to save subject.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate("/staff/data/subjects")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
        <ArrowLeft size={14} /> Back to Subjects
      </button>

      <h1 className="mb-1 text-xl font-semibold text-slate-900">{isNew ? "Add Subject" : `Edit — ${existing?.name}`}</h1>
      <p className="mb-6 text-xs text-slate-500">
        Shown to students browsing courses in this field — the "why this subject" blurb, curriculum modules, career outcomes and accrediting
        bodies all appear on a course's detail page across the student, agent and counsellor portals.
      </p>

      <div className="space-y-5">
        <Section title="Identity">
          <label className="block text-xs font-medium text-slate-500">
            Subject name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Computer Science & IT"
              className={`mt-1 w-full ${BASE_INPUT_CLASS}`}
            />
          </label>
        </Section>

        <Section title="Why This Subject">
          <label className="block text-xs font-medium text-slate-500">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this field worth studying — outcomes, industry demand, typical roles…"
              rows={4}
              className={`mt-1 w-full resize-none ${BASE_INPUT_CLASS}`}
            />
          </label>
        </Section>

        <Section title="Modules" hint="The curriculum modules shown on a course's Modules tab for this subject — a course can override these with its own list.">
          <ChipListEditor label="Add a module" placeholder="e.g. Algorithms & Data Structures" items={modules} onChange={setModules} />
        </Section>

        <Section title="Careers" hint="Typical career outcomes shown on a course's Careers tab for this subject — a course can override these with its own list.">
          <ChipListEditor label="Add a career outcome" placeholder="e.g. Software Engineer" items={careers} onChange={setCareers} />
        </Section>

        <Section title="Accreditation" hint="Recognized bodies that accredit courses in this field.">
          <ChipListEditor label="Add an accrediting body" placeholder="e.g. ABET, ACS, BCS" items={accreditations} onChange={setAccreditations} />
        </Section>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
        <Button variant="secondary" onClick={() => navigate("/staff/data/subjects")}>Cancel</Button>
        <Button disabled={!canSubmit} onClick={handleSubmit}>{isNew ? "Add Subject" : "Save Changes"}</Button>
      </div>
    </div>
  );
}
