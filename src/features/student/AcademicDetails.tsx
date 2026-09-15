import { useRef, useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { MobileHeader, FieldShell, inputClass, DocumentUpload, Pill, type ScanStatus, type UploadedDoc } from "../../components/ui/mobile";
import { markStepComplete } from "../../data/profileCompletion";
import { saveAcademicLevels } from "../../data/academicProfileStore";

const LEVELS = ["SSC / O-Level", "HSC / A-Level", "Diploma", "Bachelor's", "Master's", "PhD", "Other"] as const;
const GROUPS = ["Science", "Arts", "Commerce"];
const BOARDS = ["Dhaka", "Chittagong", "Rajshahi", "Comilla", "Jessore", "Barisal", "Sylhet", "Dinajpur", "Mymensingh", "Madrasah (Dakhil/Alim)", "Technical", "Other"];
const DOC_TYPES = ["certificate", "transcript"] as const;
type DocType = (typeof DOC_TYPES)[number];

function needsGroup(level: string) {
  return level === "SSC / O-Level" || level === "HSC / A-Level";
}
function needsMajor(level: string) {
  return level === "Diploma" || level === "Bachelor's" || level === "Master's" || level === "PhD";
}

type EditableField = "institution" | "board" | "group" | "major" | "grade" | "passingYear";

interface EducationEntry {
  id: string;
  level: string;
  institution: string;
  board: string;
  group: string;
  major: string;
  grade: string;
  passingYear: string;
  certificateFile: UploadedDoc | null;
  certificateStatus: ScanStatus;
  transcriptFile: UploadedDoc | null;
  transcriptStatus: ScanStatus;
  autoFilled: Set<EditableField>;
}

const MOCK_EXTRACT: Record<string, Record<EditableField, string>> = {
  "SSC / O-Level": { institution: "Dhaka Residential Model College", board: "Dhaka", group: "Science", major: "", grade: "5.00", passingYear: "2019" },
  "HSC / A-Level": { institution: "Notre Dame College, Dhaka", board: "Dhaka", group: "Science", major: "", grade: "5.00", passingYear: "2021" },
  "Diploma": { institution: "Dhaka Polytechnic Institute", board: "Technical", major: "Computer Technology", group: "", grade: "3.60 / 4.00", passingYear: "2021" },
  "Bachelor's": { institution: "University of Dhaka", board: "", group: "", major: "Computer Science and Engineering", grade: "3.85 / 4.00", passingYear: "2025" },
  "Master's": { institution: "University of Dhaka", board: "", group: "", major: "Data Science", grade: "3.90 / 4.00", passingYear: "2026" },
  "PhD": { institution: "University of Dhaka", board: "", group: "", major: "Computer Science", grade: "Distinction", passingYear: "2026" },
  "Other": { institution: "", board: "", group: "", major: "", grade: "", passingYear: "" },
};

function emptyEntry(id: string, level: string): EducationEntry {
  return {
    id, level, institution: "", board: "", group: "", major: "", grade: "", passingYear: "",
    certificateFile: null, certificateStatus: "idle",
    transcriptFile: null, transcriptStatus: "idle",
    autoFilled: new Set(),
  };
}

const INITIAL_ENTRIES: EducationEntry[] = [
  { id: "e1", level: "SSC / O-Level", institution: "Dhaka Residential Model College", board: "Dhaka", group: "Science", major: "", grade: "5.00", passingYear: "2019", certificateFile: null, certificateStatus: "idle", transcriptFile: null, transcriptStatus: "idle", autoFilled: new Set() },
  { id: "e2", level: "HSC / A-Level", institution: "Notre Dame College, Dhaka", board: "Dhaka", group: "Science", major: "", grade: "5.00", passingYear: "2021", certificateFile: null, certificateStatus: "idle", transcriptFile: null, transcriptStatus: "idle", autoFilled: new Set() },
  { id: "e3", level: "Bachelor's", institution: "University of Dhaka", board: "", group: "", major: "Computer Science and Engineering", grade: "3.85 / 4.00", passingYear: "2025", certificateFile: null, certificateStatus: "idle", transcriptFile: null, transcriptStatus: "idle", autoFilled: new Set() },
];

export default function AcademicDetails() {
  const [entries, setEntries] = useState<EducationEntry[]>(INITIAL_ENTRIES);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const nextId = useRef(INITIAL_ENTRIES.length + 1);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const savedTimeoutRef = useRef<number | null>(null);

  function addEntry(level: string) {
    const id = `e${nextId.current++}`;
    setEntries((prev) => [...prev, emptyEntry(id, level)]);
    setAddMenuOpen(false);
    setSaved(false);
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    for (const docType of DOC_TYPES) delete fileInputRefs.current[`${id}:${docType}`];
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

  function handleFile(id: string, docType: DocType, file: File) {
    const isImage = file.type.startsWith("image/");
    const doc: UploadedDoc = { name: file.name, previewUrl: isImage ? URL.createObjectURL(file) : undefined };

    setEntries((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      return docType === "certificate"
        ? { ...e, certificateFile: doc, certificateStatus: "scanning" }
        : { ...e, transcriptFile: doc, transcriptStatus: "scanning" };
    }));

    window.setTimeout(() => {
      setEntries((prev) => prev.map((e) => {
        if (e.id !== id) return e;
        const mock = MOCK_EXTRACT[e.level] ?? MOCK_EXTRACT.Other;
        const filled = (Object.keys(mock) as EditableField[]).filter((k) => mock[k]);
        return {
          ...e,
          ...(docType === "certificate" ? { certificateStatus: "done" as ScanStatus } : { transcriptStatus: "done" as ScanStatus }),
          institution: mock.institution || e.institution,
          board: mock.board || e.board,
          group: mock.group || e.group,
          major: mock.major || e.major,
          grade: mock.grade || e.grade,
          passingYear: mock.passingYear || e.passingYear,
          autoFilled: new Set([...e.autoFilled, ...filled]),
        };
      }));
    }, 1400);
  }

  function removeFile(id: string, docType: DocType) {
    setEntries((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      return docType === "certificate"
        ? { ...e, certificateFile: null, certificateStatus: "idle" }
        : { ...e, transcriptFile: null, transcriptStatus: "idle" };
    }));
  }

  function handleSave() {
    const nextErrors: string[] = [];
    if (entries.length === 0) nextErrors.push("Add at least one education entry.");
    entries.forEach((e) => {
      const missing: string[] = [];
      if (!e.institution.trim()) missing.push("institution");
      if (!e.grade.trim()) missing.push("grade");
      if (!e.passingYear.trim()) missing.push("passing year");
      if (needsGroup(e.level) && !e.board) missing.push("education board");
      if (needsGroup(e.level) && !e.group) missing.push("section");
      if (needsMajor(e.level) && !e.major.trim()) missing.push("major");
      if (missing.length > 0) nextErrors.push(`${e.level}: add ${missing.join(", ")}.`);
    });

    setErrors(nextErrors);
    if (nextErrors.length === 0) {
      markStepComplete("academic-details");
      saveAcademicLevels(entries.map((e) => ({
        level: e.level, institution: e.institution, board: e.board, group: e.group, major: e.major, grade: e.grade, passingYear: e.passingYear,
      })));
      setSaved(true);
      if (savedTimeoutRef.current) window.clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = window.setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <div className="flex min-h-full flex-col pb-6">
      <MobileHeader title="Academic Details" />

      <div className="px-5">
        <p className="mb-4 text-[13px] text-slate-500">
          Add every level of your education. Upload the certificate and transcript for each and we'll fill in the rest.
        </p>

        <div className="space-y-3">
          {entries.map((entry) => (
            <EducationCard
              key={entry.id}
              entry={entry}
              onUpdate={(key, value) => updateEntry(entry.id, key, value)}
              onRemove={() => removeEntry(entry.id)}
              onPickFile={(docType) => fileInputRefs.current[`${entry.id}:${docType}`]?.click()}
              onRemoveFile={(docType) => removeFile(entry.id, docType)}
            />
          ))}

          {entries.flatMap((entry) => DOC_TYPES.map((docType) => (
            <input
              key={`${entry.id}:${docType}`}
              ref={(el) => { fileInputRefs.current[`${entry.id}:${docType}`] = el; }}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(entry.id, docType, e.target.files[0])}
            />
          )))}

          {addMenuOpen ? (
            <div className="rounded-2xl bg-[var(--sd-card)] p-3.5 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
              <p className="mb-2 text-[12px] font-medium text-slate-500">Choose a level to add</p>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    onClick={() => addEntry(l)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {l}
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
              <Plus size={16} /> Add Education
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
            <Check size={14} /> Academic details updated
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

function EducationCard({
  entry, onUpdate, onRemove, onPickFile, onRemoveFile,
}: {
  entry: EducationEntry;
  onUpdate: (key: EditableField, value: string) => void;
  onRemove: () => void;
  onPickFile: (docType: DocType) => void;
  onRemoveFile: (docType: DocType) => void;
}) {
  return (
    <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
      <div className="flex items-center justify-between">
        <Pill tone="navy">{entry.level}</Pill>
        <button onClick={onRemove} aria-label="Remove entry" className="text-slate-300 hover:text-slate-500">
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 space-y-2.5">
        <DocumentUpload
          file={entry.certificateFile}
          status={entry.certificateStatus}
          title="Upload Certificate"
          description="Auto-fills institution, board, grade and passing year below."
          scanningLabel="Scanning certificate…"
          onPick={() => onPickFile("certificate")}
          onRemove={() => onRemoveFile("certificate")}
        />
        <DocumentUpload
          file={entry.transcriptFile}
          status={entry.transcriptStatus}
          title="Upload Transcript"
          description="Auto-fills the institution, board, section or major, and detailed grade below."
          scanningLabel="Scanning transcript…"
          onPick={() => onPickFile("transcript")}
          onRemove={() => onRemoveFile("transcript")}
        />
      </div>

      <div className="mt-3 space-y-3">
        <FieldShell label="Institution Name" autoFilled={entry.autoFilled.has("institution")}>
          <input value={entry.institution} onChange={(e) => onUpdate("institution", e.target.value)} className={inputClass} />
        </FieldShell>

        {needsGroup(entry.level) && (
          <FieldShell label="Education Board" autoFilled={entry.autoFilled.has("board")}>
            <select value={entry.board} onChange={(e) => onUpdate("board", e.target.value)} className={inputClass}>
              <option value="">Select board</option>
              {BOARDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </FieldShell>
        )}

        {needsGroup(entry.level) && (
          <FieldShell label="Section" autoFilled={entry.autoFilled.has("group")}>
            <select value={entry.group} onChange={(e) => onUpdate("group", e.target.value)} className={inputClass}>
              <option value="">Select section</option>
              {GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </FieldShell>
        )}

        {needsMajor(entry.level) && (
          <FieldShell label="Major / Subject" autoFilled={entry.autoFilled.has("major")}>
            <input
              value={entry.major}
              onChange={(e) => onUpdate("major", e.target.value)}
              placeholder="e.g. Computer Science"
              className={inputClass}
            />
          </FieldShell>
        )}

        <FieldShell label="GPA / CGPA / Grade" autoFilled={entry.autoFilled.has("grade")}>
          <input
            value={entry.grade}
            onChange={(e) => onUpdate("grade", e.target.value)}
            placeholder="e.g. 5.00, 3.75/4.00, A+"
            className={inputClass}
          />
        </FieldShell>
        <FieldShell label="Passing Year" autoFilled={entry.autoFilled.has("passingYear")}>
          <input
            value={entry.passingYear}
            onChange={(e) => onUpdate("passingYear", e.target.value)}
            placeholder="e.g. 2025"
            className={inputClass}
          />
        </FieldShell>
      </div>
    </div>
  );
}
