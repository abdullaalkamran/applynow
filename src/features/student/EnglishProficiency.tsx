import { useRef, useState } from "react";
import { Plus, X, Check, AlertTriangle } from "lucide-react";
import { MobileHeader, FieldShell, inputClass, DocumentUpload, Pill, monthsUntil, type ScanStatus, type UploadedDoc } from "../../components/ui/mobile";
import { markStepComplete } from "../../data/profileCompletion";
import { loadEnglishTests, saveEnglishTests, type EnglishTestDetails } from "../../data/studentProfileDetailsStore";

const TEST_NAMES = [
  "IELTS", "TOEFL iBT", "TOEFL Essentials", "PTE Academic", "Duolingo English Test",
  "Oxford ELLT", "LanguageCert Academic",
  "Cambridge English (B2 First)", "Cambridge English (C1 Advanced)", "Cambridge English (C2 Proficiency)",
  "MOI (Medium of Instruction)", "Other",
] as const;

const IELTS_TYPES = ["Academic", "General Training (GT)", "UKVI Academic", "UKVI General Training (GT)", "Other"];

function needsTestType(testName: string) {
  return testName === "IELTS";
}
function hasNoExpiry(testName: string) {
  return testName.startsWith("Cambridge English");
}
function isMOI(testName: string) {
  return testName === "MOI (Medium of Instruction)";
}

type EditableField = "testType" | "overallScore" | "listening" | "reading" | "writing" | "speaking" | "testDate" | "expiryDate" | "reportNumber" | "issuingInstitution";

interface TestEntry {
  id: string;
  testName: string;
  testType: string;
  overallScore: string;
  listening: string;
  reading: string;
  writing: string;
  speaking: string;
  testDate: string;
  expiryDate: string;
  reportNumber: string;
  issuingInstitution: string;
  file: UploadedDoc | null;
  scanStatus: ScanStatus;
  autoFilled: Set<EditableField>;
}

const MOCK_EXTRACT: Record<string, Record<EditableField, string>> = {
  "IELTS": { testType: "UKVI Academic", overallScore: "7.5", listening: "8.0", reading: "7.5", writing: "6.5", speaking: "7.5", testDate: "2026-03-14", expiryDate: "2028-03-14", reportNumber: "24GB123456ABCD", issuingInstitution: "" },
  "TOEFL iBT": { testType: "", overallScore: "102", listening: "27", reading: "28", writing: "24", speaking: "23", testDate: "2026-02-10", expiryDate: "2028-02-10", reportNumber: "TOEFL-9988776655", issuingInstitution: "" },
  "TOEFL Essentials": { testType: "", overallScore: "10", listening: "9", reading: "10", writing: "9", speaking: "10", testDate: "2026-03-01", expiryDate: "2028-03-01", reportNumber: "TE-3344556677", issuingInstitution: "" },
  "PTE Academic": { testType: "", overallScore: "72", listening: "70", reading: "74", writing: "73", speaking: "71", testDate: "2026-01-20", expiryDate: "2028-01-20", reportNumber: "PTE-AXK2233445", issuingInstitution: "" },
  "Duolingo English Test": { testType: "", overallScore: "130", listening: "125", reading: "135", writing: "130", speaking: "125", testDate: "2026-04-05", expiryDate: "2028-04-05", reportNumber: "DET-5566778899", issuingInstitution: "" },
  "Oxford ELLT": { testType: "", overallScore: "7", listening: "7", reading: "8", writing: "6", speaking: "7", testDate: "2026-02-18", expiryDate: "2028-02-18", reportNumber: "ELLT-778899", issuingInstitution: "" },
  "LanguageCert Academic": { testType: "", overallScore: "7.0", listening: "7.5", reading: "7.0", writing: "6.5", speaking: "7.0", testDate: "2026-01-15", expiryDate: "2028-01-15", reportNumber: "LC-99887766", issuingInstitution: "" },
  "Cambridge English (B2 First)": { testType: "", overallScore: "176 (Grade B)", listening: "170", reading: "178", writing: "174", speaking: "172", testDate: "2025-09-20", expiryDate: "", reportNumber: "CAM-3344556677", issuingInstitution: "" },
  "Cambridge English (C1 Advanced)": { testType: "", overallScore: "191 (Grade B)", listening: "185", reading: "195", writing: "190", speaking: "188", testDate: "2025-11-12", expiryDate: "", reportNumber: "CAM-1122334455", issuingInstitution: "" },
  "Cambridge English (C2 Proficiency)": { testType: "", overallScore: "215 (Grade B)", listening: "210", reading: "218", writing: "212", speaking: "214", testDate: "2025-10-02", expiryDate: "", reportNumber: "CAM-6677889900", issuingInstitution: "" },
  "MOI (Medium of Instruction)": { testType: "", overallScore: "", listening: "", reading: "", writing: "", speaking: "", testDate: "2025-09-01", expiryDate: "2027-09-01", reportNumber: "MOI-DU-2025-00456", issuingInstitution: "University of Dhaka" },
  "Other": { testType: "", overallScore: "", listening: "", reading: "", writing: "", speaking: "", testDate: "", expiryDate: "", reportNumber: "", issuingInstitution: "" },
};

function emptyEntry(id: string, testName: string): TestEntry {
  return {
    id, testName, testType: "", overallScore: "", listening: "", reading: "", writing: "", speaking: "",
    testDate: "", expiryDate: "", reportNumber: "", issuingInstitution: "", file: null, scanStatus: "idle", autoFilled: new Set(),
  };
}

function fromSaved(id: string, t: EnglishTestDetails): TestEntry {
  return { id, ...t, file: null, scanStatus: "idle", autoFilled: new Set() };
}

// Real, previously-saved test results — falls back to an empty list (via loadEnglishTests' own
// ?? []) for anyone who hasn't filled this in yet, rather than a fabricated sample score.
function initialEntries(): TestEntry[] {
  return loadEnglishTests().map((t, i) => fromSaved(`t${i + 1}`, t));
}

function getExpiryWarning(expiryDate: string): string | null {
  const monthsLeft = monthsUntil(expiryDate);
  if (monthsLeft === null) return null;
  if (monthsLeft < 0) return "This result has expired — most universities require it to be valid within 2 years of your intake.";
  if (monthsLeft < 6) return "This result expires in less than 6 months — check your intake's validity requirement.";
  return null;
}

export default function EnglishProficiency() {
  const [entries, setEntries] = useState<TestEntry[]>(initialEntries);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const nextId = useRef(entries.length + 1);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const savedTimeoutRef = useRef<number | null>(null);

  function addEntry(testName: string) {
    const id = `t${nextId.current++}`;
    setEntries((prev) => [...prev, emptyEntry(id, testName)]);
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
        const mock = MOCK_EXTRACT[e.testName] ?? MOCK_EXTRACT.Other;
        const filled = (Object.keys(mock) as EditableField[]).filter((k) => mock[k]);
        return {
          ...e,
          testType: mock.testType || e.testType,
          overallScore: mock.overallScore || e.overallScore,
          listening: mock.listening || e.listening,
          reading: mock.reading || e.reading,
          writing: mock.writing || e.writing,
          speaking: mock.speaking || e.speaking,
          testDate: mock.testDate || e.testDate,
          expiryDate: mock.expiryDate || e.expiryDate,
          reportNumber: mock.reportNumber || e.reportNumber,
          issuingInstitution: mock.issuingInstitution || e.issuingInstitution,
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
    if (entries.length === 0) nextErrors.push("Add at least one English proficiency test.");
    entries.forEach((e) => {
      const missing: string[] = [];
      if (isMOI(e.testName)) {
        if (!e.issuingInstitution.trim()) missing.push("issuing institution");
        if (!e.testDate.trim()) missing.push("issue date");
        if (!e.reportNumber.trim()) missing.push("certificate number");
      } else {
        if (needsTestType(e.testName) && !e.testType) missing.push("test type");
        if (!e.overallScore.trim()) missing.push("overall score");
        if (!e.listening.trim() || !e.reading.trim() || !e.writing.trim() || !e.speaking.trim()) missing.push("band scores");
        if (!e.testDate.trim()) missing.push("test date");
        if (!hasNoExpiry(e.testName) && !e.expiryDate.trim()) missing.push("expiry date");
        if (!e.reportNumber.trim()) missing.push("test report number");
      }
      if (missing.length > 0) nextErrors.push(`${e.testName}: add ${missing.join(", ")}.`);
    });

    setErrors(nextErrors);
    if (nextErrors.length === 0) {
      markStepComplete("english-proficiency");
      saveEnglishTests(entries.map((e) => ({
        testName: e.testName, testType: e.testType, overallScore: e.overallScore,
        listening: e.listening, reading: e.reading, writing: e.writing, speaking: e.speaking,
        testDate: e.testDate, expiryDate: e.expiryDate, reportNumber: e.reportNumber, issuingInstitution: e.issuingInstitution,
      })));
      setSaved(true);
      if (savedTimeoutRef.current) window.clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = window.setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <div className="flex min-h-full flex-col pb-6">
      <MobileHeader title="English Proficiency" />

      <div className="px-5">
        <p className="mb-4 text-[13px] text-slate-500">
          Upload your test certificate or score report — we'll detect the test and fill in the rest.
        </p>

        <div className="space-y-3">
          {entries.map((entry) => (
            <TestCard
              key={entry.id}
              entry={entry}
              onUpdate={(key, value) => updateEntry(entry.id, key, value)}
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
              <p className="mb-2 text-[12px] font-medium text-slate-500">Choose a test to add</p>
              <div className="flex flex-wrap gap-2">
                {TEST_NAMES.map((t) => (
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
              <Plus size={16} /> Add Test
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
            <Check size={14} /> English proficiency updated
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

function TestCard({
  entry, onUpdate, onRemove, onPickFile, onRemoveFile,
}: {
  entry: TestEntry;
  onUpdate: (key: EditableField, value: string) => void;
  onRemove: () => void;
  onPickFile: () => void;
  onRemoveFile: () => void;
}) {
  const expiryWarning = getExpiryWarning(entry.expiryDate);

  return (
    <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
      <div className="flex items-center justify-between">
        <Pill tone="navy">{entry.testName}</Pill>
        <button onClick={onRemove} aria-label="Remove test" className="text-slate-300 hover:text-slate-500">
          <X size={16} />
        </button>
      </div>

      <div className="mt-3">
        <DocumentUpload
          file={entry.file}
          status={entry.scanStatus}
          title={isMOI(entry.testName) ? "Upload MOI Letter" : "Upload Test Certificate"}
          description={
            isMOI(entry.testName)
              ? "We'll detect it and auto-fill the issuing institution and dates below."
              : "We'll detect the test and auto-fill the score, band scores, dates and report number below."
          }
          scanningLabel={isMOI(entry.testName) ? "Detecting letter…" : "Detecting test…"}
          onPick={onPickFile}
          onRemove={onRemoveFile}
        />
      </div>

      <div className="mt-3 space-y-3">
        {isMOI(entry.testName) ? (
          <FieldShell label="Issuing Institution" autoFilled={entry.autoFilled.has("issuingInstitution")}>
            <input
              value={entry.issuingInstitution}
              onChange={(e) => onUpdate("issuingInstitution", e.target.value)}
              placeholder="e.g. University of Dhaka"
              className={inputClass}
            />
          </FieldShell>
        ) : (
          <>
            {needsTestType(entry.testName) && (
              <FieldShell label="Test Type" autoFilled={entry.autoFilled.has("testType")}>
                <select value={entry.testType} onChange={(e) => onUpdate("testType", e.target.value)} className={inputClass}>
                  <option value="">Select test type</option>
                  {IELTS_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </FieldShell>
            )}

            <FieldShell label="Overall Score" autoFilled={entry.autoFilled.has("overallScore")}>
              <input
                value={entry.overallScore}
                onChange={(e) => onUpdate("overallScore", e.target.value)}
                placeholder="e.g. 7.5, 102, 72, 130"
                className={inputClass}
              />
            </FieldShell>

            <div className="grid grid-cols-2 gap-3">
              <FieldShell label="Listening" autoFilled={entry.autoFilled.has("listening")}>
                <input value={entry.listening} onChange={(e) => onUpdate("listening", e.target.value)} className={inputClass} />
              </FieldShell>
              <FieldShell label="Reading" autoFilled={entry.autoFilled.has("reading")}>
                <input value={entry.reading} onChange={(e) => onUpdate("reading", e.target.value)} className={inputClass} />
              </FieldShell>
              <FieldShell label="Writing" autoFilled={entry.autoFilled.has("writing")}>
                <input value={entry.writing} onChange={(e) => onUpdate("writing", e.target.value)} className={inputClass} />
              </FieldShell>
              <FieldShell label="Speaking" autoFilled={entry.autoFilled.has("speaking")}>
                <input value={entry.speaking} onChange={(e) => onUpdate("speaking", e.target.value)} className={inputClass} />
              </FieldShell>
            </div>
          </>
        )}

        <FieldShell label={isMOI(entry.testName) ? "Issue Date" : "Test Date"} autoFilled={entry.autoFilled.has("testDate")}>
          <input type="date" value={entry.testDate} onChange={(e) => onUpdate("testDate", e.target.value)} className={inputClass} />
        </FieldShell>

        {!hasNoExpiry(entry.testName) && (
          <FieldShell label="Expiry Date" autoFilled={entry.autoFilled.has("expiryDate")}>
            <input type="date" value={entry.expiryDate} onChange={(e) => onUpdate("expiryDate", e.target.value)} className={inputClass} />
          </FieldShell>
        )}
        {expiryWarning && (
          <div className="flex items-start gap-2 rounded-xl bg-[#FDF0DC] p-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#B8791C]" />
            <p className="text-[12px] leading-snug text-[#8A5A14]">{expiryWarning}</p>
          </div>
        )}

        <FieldShell label={isMOI(entry.testName) ? "Certificate / Reference Number" : "Test Report Number"} autoFilled={entry.autoFilled.has("reportNumber")}>
          <input
            value={entry.reportNumber}
            onChange={(e) => onUpdate("reportNumber", e.target.value)}
            placeholder={isMOI(entry.testName) ? "e.g. registrar reference number" : "e.g. TRF / candidate ID"}
            className={inputClass}
          />
        </FieldShell>
      </div>
    </div>
  );
}
