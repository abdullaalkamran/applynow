// Add/Edit Subject — a field of study's "why this subject" blurb, curriculum modules, and
// recognized accrediting bodies. Mirrors CountryForm.tsx's pattern (full page, sectioned cards),
// with a repeatable chip-list editor for Modules/Accreditation instead of a comma-separated field.
import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "../../../components/ui";
import { getSubjectCatalog, createSubjectRecord, updateSubjectRecord } from "../../../data/subjectCatalogStore";

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

/** A repeatable "type it, click Add, see it as a removable chip" list — used for both Modules and
 * Accreditation, since neither is a single value and a plain comma-separated text field doesn't
 * give the same explicit add/remove interaction. */
function ChipListEditor({
  label, placeholder, items, onChange,
}: { label: string; placeholder: string; items: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value || items.some((i) => i.toLowerCase() === value.toLowerCase())) return;
    onChange([...items, value]);
    setDraft("");
  }

  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <div className="mt-1 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={`w-full ${BASE_INPUT_CLASS}`}
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--brand-600)] px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
        >
          <Plus size={13} /> Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1.5 text-[11.5px] font-medium text-slate-700">
              {item}
              <button onClick={() => onChange(items.filter((i) => i !== item))} aria-label={`Remove ${item}`} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </label>
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
  const [accreditations, setAccreditations] = useState<string[]>(existing?.accreditations ?? []);
  const [saving, setSaving] = useState(false);
  const canSubmit = name.trim().length > 0 && !saving;

  async function handleSubmit() {
    setSaving(true);
    try {
      const input = { name: name.trim(), description: description.trim() || undefined, modules, accreditations };
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
        Shown to students browsing courses in this field — the "why this subject" blurb, curriculum modules and accrediting
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

        <Section title="Modules" hint="The curriculum modules shown on a course's Modules tab for this subject.">
          <ChipListEditor label="Add a module" placeholder="e.g. Algorithms & Data Structures" items={modules} onChange={setModules} />
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
