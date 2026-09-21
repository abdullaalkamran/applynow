import { useRef, useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { MobileHeader, FieldShell, inputClass, DocumentUpload, Pill, type ScanStatus, type UploadedDoc } from "../../components/ui/mobile";
import { markStepComplete } from "../../data/profileCompletion";
import { loadWorkExperience, saveWorkExperience, type WorkExperienceDetails } from "../../data/studentProfileDetailsStore";

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Internship", "Contract", "Freelance", "Volunteer"] as const;

type EditableField = "company" | "title" | "industry" | "startDate" | "endDate" | "description";

interface WorkEntry {
  id: string;
  type: string;
  company: string;
  title: string;
  industry: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  description: string;
  file: UploadedDoc | null;
  scanStatus: ScanStatus;
  autoFilled: Set<EditableField>;
}

const MOCK_EXTRACT: Record<string, Record<EditableField, string>> = {
  "Full-time": {
    company: "bKash Limited", title: "Business Analyst", industry: "Fintech",
    startDate: "2025-09-01", endDate: "",
    description: "Supporting product teams with requirements analysis and process documentation for digital payment features.",
  },
  "Part-time": {
    company: "Chaldal Ltd.", title: "Customer Support Associate", industry: "E-commerce",
    startDate: "2023-06-01", endDate: "2023-12-31",
    description: "Handled customer queries and order issue resolution across chat and phone channels.",
  },
  "Internship": {
    company: "Grameenphone Ltd.", title: "Data Analyst Intern", industry: "Telecommunications",
    startDate: "2024-12-01", endDate: "2025-03-31",
    description: "Analyzed customer usage data and built dashboards to support the marketing analytics team.",
  },
  "Contract": {
    company: "Brain Station 23", title: "Software Engineer (Contract)", industry: "Information Technology",
    startDate: "2024-01-15", endDate: "2024-08-15",
    description: "Delivered backend features for a client web platform under a fixed-term contract.",
  },
  "Freelance": {
    company: "Self-employed", title: "Freelance Web Developer", industry: "Information Technology",
    startDate: "2022-06-01", endDate: "2023-05-31",
    description: "Built websites and small web applications for local businesses on a project basis.",
  },
  "Volunteer": {
    company: "BRAC", title: "Volunteer Teaching Assistant", industry: "Education / NGO",
    startDate: "2021-06-01", endDate: "2021-12-31",
    description: "Assisted with English-language tutoring sessions for underprivileged students.",
  },
};

function emptyEntry(id: string, type: string): WorkEntry {
  return {
    id, type, company: "", title: "", industry: "", startDate: "", endDate: "",
    currentlyWorking: false, description: "", file: null, scanStatus: "idle", autoFilled: new Set(),
  };
}

function fromSaved(id: string, w: WorkExperienceDetails): WorkEntry {
  return { id, ...w, file: null, scanStatus: "idle", autoFilled: new Set() };
}

// Real, previously-saved work history — falls back to an empty list (via loadWorkExperience's own
// ?? []) for anyone who hasn't filled this in yet, rather than a fabricated sample job.
function initialEntries(): WorkEntry[] {
  return loadWorkExperience().map((w, i) => fromSaved(`w${i + 1}`, w));
}

export default function WorkExperience() {
  const [entries, setEntries] = useState<WorkEntry[]>(initialEntries);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const nextId = useRef(entries.length + 1);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const savedTimeoutRef = useRef<number | null>(null);

  function addEntry(type: string) {
    const id = `w${nextId.current++}`;
    setEntries((prev) => [...prev, emptyEntry(id, type)]);
    setAddMenuOpen(false);
    setSaved(false);
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    delete fileInputRefs.current[id];
    setSaved(false);
  }

  function updateEntry(id: string, key: EditableField, value: string) {
    setEntries((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const autoFilled = new Set(e.autoFilled);
      autoFilled.delete(key);
      return { ...e, [key]: value, autoFilled };
    }));
    setSaved(false);
  }

  function setCurrentlyWorking(id: string, value: boolean) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, currentlyWorking: value, endDate: value ? "" : e.endDate } : e)));
    setSaved(false);
  }

  function handleFile(id: string, file: File) {
    const isImage = file.type.startsWith("image/");
    setEntries((prev) => prev.map((e) => (
      e.id === id
        ? { ...e, file: { name: file.name, previewUrl: isImage ? URL.createObjectURL(file) : undefined }, scanStatus: "scanning" }
        : e
    )));
    window.setTimeout(() => {
      setEntries((prev) => prev.map((e) => {
        if (e.id !== id) return e;
        const mock = MOCK_EXTRACT[e.type] ?? MOCK_EXTRACT["Full-time"];
        const filled = (Object.keys(mock) as EditableField[]).filter((k) => mock[k]);
        return {
          ...e,
          company: mock.company || e.company,
          title: mock.title || e.title,
          industry: mock.industry || e.industry,
          startDate: mock.startDate || e.startDate,
          endDate: mock.endDate,
          currentlyWorking: !mock.endDate,
          description: mock.description || e.description,
          scanStatus: "done",
          autoFilled: new Set(filled),
        };
      }));
    }, 1400);
  }

  function removeFile(id: string) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, file: null, scanStatus: "idle" } : e)));
  }

  function handleSave() {
    const nextErrors: string[] = [];
    entries.forEach((e) => {
      const missing: string[] = [];
      if (!e.company.trim()) missing.push("company");
      if (!e.title.trim()) missing.push("job title");
      if (!e.startDate.trim()) missing.push("start date");
      if (!e.currentlyWorking && !e.endDate.trim()) missing.push("end date");
      if (missing.length > 0) nextErrors.push(`${e.company.trim() || e.type}: add ${missing.join(", ")}.`);
    });

    setErrors(nextErrors);
    if (nextErrors.length === 0) {
      markStepComplete("work-experience");
      saveWorkExperience(entries.map((e) => ({
        type: e.type, company: e.company, title: e.title, industry: e.industry,
        startDate: e.startDate, endDate: e.endDate, currentlyWorking: e.currentlyWorking, description: e.description,
      })));
      setSaved(true);
      if (savedTimeoutRef.current) window.clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = window.setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <div className="flex min-h-full flex-col pb-6">
      <MobileHeader title="Work Experience" />

      <div className="px-5">
        <p className="mb-4 text-[13px] text-slate-500">
          Add your work history. Upload an offer or experience letter and we'll fill in the rest — or leave this empty if you have none yet.
        </p>

        <div className="space-y-3">
          {entries.map((entry) => (
            <WorkCard
              key={entry.id}
              entry={entry}
              onUpdate={(key, value) => updateEntry(entry.id, key, value)}
              onToggleCurrent={(value) => setCurrentlyWorking(entry.id, value)}
              onRemove={() => removeEntry(entry.id)}
              onPickFile={() => fileInputRefs.current[entry.id]?.click()}
              onRemoveFile={() => removeFile(entry.id)}
            />
          ))}

          {entries.map((entry) => (
            <input
              key={entry.id}
              ref={(el) => { fileInputRefs.current[entry.id] = el; }}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(entry.id, e.target.files[0])}
            />
          ))}

          {addMenuOpen ? (
            <div className="rounded-2xl bg-[var(--sd-card)] p-3.5 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
              <p className="mb-2 text-[12px] font-medium text-slate-500">Choose an employment type</p>
              <div className="flex flex-wrap gap-2">
                {EMPLOYMENT_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => addEntry(t)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button onClick={() => setAddMenuOpen(false)} className="mt-2.5 text-[12px] text-slate-400">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddMenuOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-3.5 text-[13px] font-medium text-[var(--sd-ink)]"
            >
              <Plus size={16} /> Add Work Experience
            </button>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto bg-[var(--sd-bg)] px-5 pb-2 pt-4">
        {errors.length > 0 && (
          <div className="mb-2 rounded-xl bg-[#FCEAE8] p-3">
            {errors.map((e) => (
              <p key={e} className="text-[12px] font-medium text-[#B8382C]">{e}</p>
            ))}
          </div>
        )}
        {saved && (
          <p className="mb-2 flex items-center justify-center gap-1.5 text-[13px] font-medium text-[var(--sd-teal)]">
            <Check size={14} /> Work experience updated
          </p>
        )}
        <button
          onClick={handleSave}
          className="w-full rounded-xl bg-[image:var(--sd-gradient)] py-3.5 text-[13px] font-semibold text-white"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

function WorkCard({
  entry, onUpdate, onToggleCurrent, onRemove, onPickFile, onRemoveFile,
}: {
  entry: WorkEntry;
  onUpdate: (key: EditableField, value: string) => void;
  onToggleCurrent: (value: boolean) => void;
  onRemove: () => void;
  onPickFile: () => void;
  onRemoveFile: () => void;
}) {
  return (
    <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
      <div className="flex items-center justify-between">
        <Pill tone="navy">{entry.type}</Pill>
        <button onClick={onRemove} aria-label="Remove experience" className="text-slate-300 hover:text-slate-500">
          <X size={16} />
        </button>
      </div>

      <div className="mt-3">
        <DocumentUpload
          file={entry.file}
          status={entry.scanStatus}
          title="Upload Offer / Experience Letter"
          description="We'll scan it and auto-fill the company, title, dates and description below."
          scanningLabel="Scanning letter…"
          onPick={onPickFile}
          onRemove={onRemoveFile}
        />
      </div>

      <div className="mt-3 space-y-3">
        <FieldShell label="Company Name" autoFilled={entry.autoFilled.has("company")}>
          <input value={entry.company} onChange={(e) => onUpdate("company", e.target.value)} className={inputClass} />
        </FieldShell>

        <FieldShell label="Job Title" autoFilled={entry.autoFilled.has("title")}>
          <input value={entry.title} onChange={(e) => onUpdate("title", e.target.value)} className={inputClass} />
        </FieldShell>

        <FieldShell label="Industry" autoFilled={entry.autoFilled.has("industry")}>
          <input
            value={entry.industry}
            onChange={(e) => onUpdate("industry", e.target.value)}
            placeholder="e.g. Information Technology"
            className={inputClass}
          />
        </FieldShell>

        <FieldShell label="Start Date" autoFilled={entry.autoFilled.has("startDate")}>
          <input type="date" value={entry.startDate} onChange={(e) => onUpdate("startDate", e.target.value)} className={inputClass} />
        </FieldShell>

        <label className="flex items-center gap-2 text-[12px] text-slate-600">
          <input
            type="checkbox"
            checked={entry.currentlyWorking}
            onChange={(e) => onToggleCurrent(e.target.checked)}
            className="h-3.5 w-3.5 shrink-0 accent-[var(--sd-ink)]"
          />
          I currently work here
        </label>

        {!entry.currentlyWorking && (
          <FieldShell label="End Date" autoFilled={entry.autoFilled.has("endDate")}>
            <input type="date" value={entry.endDate} onChange={(e) => onUpdate("endDate", e.target.value)} className={inputClass} />
          </FieldShell>
        )}

        <FieldShell label="Responsibilities" autoFilled={entry.autoFilled.has("description")}>
          <textarea
            value={entry.description}
            onChange={(e) => onUpdate("description", e.target.value)}
            placeholder="Briefly describe what you did in this role"
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </FieldShell>
      </div>
    </div>
  );
}
