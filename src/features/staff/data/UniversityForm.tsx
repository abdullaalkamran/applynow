import { safeHref } from "../../../utils/safeHref";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ExternalLink, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "../../../components/ui";
import { getAllSubjects, addSubject } from "../../../data/subjectsStore";
import { getAllUgcUniversitiesBD, addUgcUniversityBD } from "../../../data/bangladeshUniversities";
import { getAllCountries, getCountryByName, addCurrencyToCountry } from "../../../data/countryRegistry";
import { getUniversityById, addUniversity, updateUniversity, refreshUniversities } from "../../../data/universityCatalogStore";
import {
  approveUniversityImport, getCachedUniversityImport, listUniversityImports, type UniversityFieldKey, type UniversityImportItem,
} from "../../../data/universityImportsStore";
import { useHoldCacheSync } from "../../../utils/syncCache";
import { TEST_NAME_OPTIONS } from "../../../utils/universityFilter";
import type { University } from "../../../types";

type Fee = University["fees"][number];
type Campus = NonNullable<University["campuses"]>[number];
type EnglishReq = NonNullable<University["englishRequirements"]>["undergraduate"][number];
type Scholarship = NonNullable<University["scholarships"]>[number];
const TONES: University["tone"][] = ["violet", "amber", "teal", "rose"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Shown alongside whatever the selected country's own currencySymbols list has, so the picklist
// is never empty for a country that hasn't had its currencies configured yet.
const DEFAULT_CURRENCY_SYMBOLS = ["$", "£", "€", "A$", "C$"];
const MIN_TUITION_FEE = 18000;
const MAX_TUITION_FEE = 40000;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blankFee(): Fee {
  return { label: "Tuition Fee", amount: 0 };
}
function blankCampus(city: string): Campus {
  return { id: `cmp-custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`, name: "Main Campus", city };
}
function blankEnglishReq(): EnglishReq {
  return { testName: TEST_NAME_OPTIONS[0], minScore: "", skillScores: [] };
}
function cleanEnglishTests(tests: EnglishReq[]): EnglishReq[] {
  return tests
    .map((e) => ({ ...e, minScore: e.minScore?.trim() || undefined, skillScores: (e.skillScores ?? []).filter((s) => s.skill.trim() && s.score.trim()) }))
    .filter((e) => e.minScore || e.skillScores.length > 0);
}
function blankScholarship(): Scholarship {
  return { name: "", amount: "" };
}
const COMMON_SKILLS = ["Listening", "Reading", "Writing", "Speaking"];

/** One level's (undergraduate or postgraduate) list of accepted English tests — used twice, once
 * per level, since a university's Bachelor's and Postgraduate English requirements are rarely the
 * same (same reason Academic Requirements below is split the same way). */
function EnglishTestsEditor({ tests, onChange }: { tests: EnglishReq[]; onChange: (next: EnglishReq[]) => void }) {
  function updateReq(i: number, patch: Partial<EnglishReq>) {
    onChange(tests.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function setSkillScore(testIdx: number, skill: string, score: string) {
    onChange(
      tests.map((e, idx) => {
        if (idx !== testIdx) return e;
        const rest = (e.skillScores ?? []).filter((s) => s.skill !== skill);
        const next = score.trim() ? [...rest, { skill, score }] : rest;
        next.sort((a, b) => COMMON_SKILLS.indexOf(a.skill) - COMMON_SKILLS.indexOf(b.skill));
        return { ...e, skillScores: next };
      })
    );
  }

  return (
    <div className="space-y-3">
      {tests.length === 0 && <p className="text-xs text-slate-400">No accepted tests listed yet.</p>}
      {tests.map((e, i) => (
        <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
          <div className="flex items-center gap-2">
            <select value={e.testName} onChange={(ev) => updateReq(i, { testName: ev.target.value })} className={`${SELECT_CLASS} flex-1`}>
              {TEST_NAME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Input value={e.minScore ?? ""} onChange={(v) => updateReq(i, { minScore: v })} placeholder="Overall score" className="w-32" />
            <button onClick={() => onChange(tests.filter((_, idx) => idx !== i))} aria-label="Remove test" className="shrink-0 text-slate-300 hover:text-rose-500">
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
  );
}

// Each offered month keeps its own `year` — a university can have more than one intake open at
// once (e.g. September and January), and those don't necessarily fall in the same year, so one
// shared "intake year" field couldn't express both correctly.
type MonthState = Record<
  string,
  { offered: boolean; open: boolean; year: string; applicationDeadline: string; casRequestDeadline: string; enrollmentDate: string }
>;

function initMonthState(existing?: Partial<University>): MonthState {
  const offered = new Set(existing?.intakes ?? []);
  const openMap = existing?.intakeStatus ?? {};
  const datesMap = existing?.intakeDates ?? {};
  const openIntakeParts = (existing?.openIntake ?? "").split(" ");
  const openIntakeMonth = openIntakeParts[0];
  const openIntakeYear = openIntakeParts[1];
  const defaultYear = String(new Date().getFullYear() + 1);
  const state: MonthState = {};
  MONTHS.forEach((m) => {
    const enrollmentYear = datesMap[m]?.enrollmentDate?.slice(0, 4);
    state[m] = {
      offered: offered.has(m),
      open: openMap[m] ?? m === openIntakeMonth,
      year: enrollmentYear || (m === openIntakeMonth && openIntakeYear ? openIntakeYear : defaultYear),
      applicationDeadline: datesMap[m]?.applicationDeadline ?? "",
      casRequestDeadline: datesMap[m]?.casRequestDeadline ?? "",
      enrollmentDate: datesMap[m]?.enrollmentDate ?? "",
    };
  });
  return state;
}

/** Resolves the route (a university being edited, or an AI import row via `?importId=`) and hands
 * a fully-known starting point to UniversityEditor. Without `?importId=` this is exactly the
 * add/edit form it always was — import mode only adds a review banner, per-section flags and an
 * approve-on-save. */
export default function DataUniversityForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const importId = searchParams.get("importId");
  const existing = id ? getUniversityById(id) : undefined;

  const [importItem, setImportItem] = useState<UniversityImportItem | undefined>(() => (importId ? getCachedUniversityImport(importId) : undefined));
  const [importMissing, setImportMissing] = useState(false);
  useEffect(() => {
    if (!importId || importItem) return;
    let cancelled = false;
    listUniversityImports()
      .then((items) => {
        if (cancelled) return;
        const found = items.find((i) => i.id === importId);
        if (found) setImportItem(found);
        else setImportMissing(true);
      })
      .catch(() => { if (!cancelled) setImportMissing(true); });
    return () => { cancelled = true; };
  }, [importId, importItem]);

  if (importId && !importItem) {
    return (
      <div>
        <button onClick={() => navigate("/staff/data/universities/import")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
          <ArrowLeft size={14} /> Back to import queue
        </button>
        <p className="text-xs text-slate-400">{importMissing ? "That import row no longer exists." : "Loading the imported draft…"}</p>
      </div>
    );
  }

  return <UniversityEditor key={importId ?? id ?? "new"} existing={existing} importItem={importItem} countryParam={searchParams.get("country")} />;
}

function UniversityEditor({ existing, importItem, countryParam }: { existing?: University; importItem?: UniversityImportItem; countryParam: string | null }) {
  const navigate = useNavigate();
  const isNew = !existing;
  // Import mode: the AI draft seeds every field; its review metadata drives the flags below.
  const initial: Partial<University> | undefined = importItem?.extracted?.university;
  const base: Partial<University> | undefined = existing ?? initial;
  const attention = new Set<UniversityFieldKey>(importItem?.extracted?.needsAttention ?? []);
  const evidence = importItem?.extracted?.evidence ?? {};
  const flag = (key: UniversityFieldKey) => (importItem && attention.has(key) ? { evidence: evidence[key] } : undefined);
  // Keeps a long, half-edited form from being wiped by the shell's remount on every cache change.
  useHoldCacheSync();
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(base?.name ?? "");
  const [city, setCity] = useState(base?.city ?? "");
  const [state, setState] = useState(base?.state ?? "");
  const [country, setCountry] = useState(base?.country ?? countryParam ?? "");
  const [addingNewCountry, setAddingNewCountry] = useState(
    () => !!country && !getAllCountries().some((c) => c.name.toLowerCase() === country.toLowerCase())
  );
  const [newSubject, setNewSubject] = useState("");
  const [, forceTick] = useState(0);
  const [website, setWebsite] = useState(base?.website ?? "");
  const [tone, setTone] = useState<University["tone"]>(base?.tone ?? "violet");
  const [logoUrl, setLogoUrl] = useState(base?.logoUrl ?? "");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState(base?.coverPhotoUrl ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [qsRanking, setQsRanking] = useState(base?.qsRanking ?? "");
  const [timesHigherRanking, setTimesHigherRanking] = useState(base?.timesHigherRanking ?? "");
  const [employability, setEmployability] = useState(base?.employability ?? "85%");
  const [studentCount, setStudentCount] = useState(base?.studentCount ?? "20,000+");
  const [description, setDescription] = useState(base?.description ?? "");
  const [highlights, setHighlights] = useState((base?.highlights ?? []).join("\n"));
  const [tags, setTags] = useState((base?.tags ?? []).join(", "));
  const [monthState, setMonthState] = useState<MonthState>(() => initMonthState(base));
  const [undergraduateRequirements, setUndergraduateRequirements] = useState((base?.requirements?.undergraduate ?? []).join("\n"));
  const [postgraduateRequirements, setPostgraduateRequirements] = useState((base?.requirements?.postgraduate ?? []).join("\n"));
  const [accreditations, setAccreditations] = useState((base?.accreditations ?? []).join(", "));
  const [scholarshipsAvailable, setScholarshipsAvailable] = useState(base?.scholarshipsAvailable ?? false);
  const [scholarships, setScholarships] = useState<Scholarship[]>(base?.scholarships ?? []);
  const [minGPA, setMinGPA] = useState(String(base?.minGPA ?? 3.0));
  const [currencySymbol, setCurrencySymbol] = useState(base?.currencySymbol ?? "$");
  const [addingNewCurrency, setAddingNewCurrency] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(base?.subjects ?? []);
  const [fees, setFees] = useState<Fee[]>(base?.fees ?? [blankFee()]);
  const [depositMode, setDepositMode] = useState<"custom" | "half" | "full">(base?.depositMode ?? "custom");
  const [minimumDepositAmount, setMinimumDepositAmount] = useState(String(base?.minimumDepositAmount ?? ""));
  const [paymentDeadline, setPaymentDeadline] = useState(base?.paymentDeadline ?? "");
  const [depositRules, setDepositRules] = useState((base?.depositRules ?? []).join("\n"));
  const [admissionSteps, setAdmissionSteps] = useState((base?.admissionSteps ?? []).join("\n"));
  const [restrictedRegions, setRestrictedRegions] = useState((base?.restrictedRegions ?? []).join("\n"));
  const tuitionFeeAmount = fees.find((f) => f.label.trim().toLowerCase() === "tuition fee")?.amount ?? 0;
  const effectiveDepositAmount =
    depositMode === "half" ? Math.round(tuitionFeeAmount * 0.5)
    : depositMode === "full" ? tuitionFeeAmount
    : Number(minimumDepositAmount) || 0;
  // Courses are only ever added/edited from an already-created university's own Courses tab (see
  // the "Courses" section below) — a brand-new university has none yet, which is fine: `courses`
  // is only read here (for the derived subjects preview and the payload), never written.
  const courses = base?.courses ?? [];
  const [campuses, setCampuses] = useState<Campus[]>(base?.campuses ?? []);
  const [undergraduateEnglishTests, setUndergraduateEnglishTests] = useState<EnglishReq[]>(base?.englishRequirements?.undergraduate ?? []);
  const [postgraduateEnglishTests, setPostgraduateEnglishTests] = useState<EnglishReq[]>(base?.englishRequirements?.postgraduate ?? []);
  const [moiAccepted, setMoiAccepted] = useState(base?.moiAccepted ?? false);
  const [moiUniversities, setMoiUniversities] = useState<string[]>(base?.moiAcceptedUniversities ?? []);
  const [moiSearch, setMoiSearch] = useState("");
  const [newMoiUniversity, setNewMoiUniversity] = useState("");
  const [internalTestOffered, setInternalTestOffered] = useState(base?.internalEnglishTestOffered ?? false);
  const [internalTestFree, setInternalTestFree] = useState(base?.internalEnglishTestFree ?? true);
  const [internalTestFee, setInternalTestFee] = useState(String(base?.internalEnglishTestFee ?? ""));
  const [eslElpAvailable, setEslElpAvailable] = useState(base?.eslElpAvailable ?? false);
  const [feeWaiverAvailable, setFeeWaiverAvailable] = useState(base?.applicationFeeWaiverAvailable ?? false);
  const [feeWaiverPercent, setFeeWaiverPercent] = useState(String(base?.applicationFeeWaiverPercent ?? ""));

  const canSubmit = name.trim() && city.trim() && country.trim() && courses.every((c) => c.name.trim());
  // The selected country's own currencies first, then the generic fallbacks, deduped — so the
  // picklist always has something even for a country that hasn't had its currencies set yet, but
  // still surfaces that country's real ones first.
  const currencyOptions = Array.from(
    new Set([...(getCountryByName(country)?.currencySymbols ?? []), ...DEFAULT_CURRENCY_SYMBOLS, currencySymbol])
  );
  const backTarget = importItem
    ? "/staff/data/universities/import"
    : existing
      ? `/staff/data/universities/${existing.id}`
      : country.trim() ? `/staff/data/countries/${encodeURIComponent(country.trim())}` : "/staff/data";

  function handleAddSubject() {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    const created = addSubject(trimmed);
    setNewSubject("");
    setSelectedSubjects((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    if (created) forceTick((t) => t + 1);
  }

  function toggleMoiUniversity(name: string) {
    setMoiUniversities((prev) => (prev.includes(name) ? prev.filter((u) => u !== name) : [...prev, name]));
  }

  function handleAddMoiUniversity() {
    const trimmed = newMoiUniversity.trim();
    if (!trimmed) return;
    const created = addUgcUniversityBD(trimmed);
    setNewMoiUniversity("");
    setMoiUniversities((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    if (created) forceTick((t) => t + 1);
  }

  function toggleSubject(subject: string) {
    setSelectedSubjects((prev) => (prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]));
  }

  async function handleLogoPicked(file: File | undefined) {
    if (!file) return;
    setUploadingLogo(true);
    try {
      setLogoUrl(await readFileAsDataUrl(file));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleCoverPicked(file: File | undefined) {
    if (!file) return;
    setUploadingCover(true);
    try {
      setCoverPhotoUrl(await readFileAsDataUrl(file));
    } finally {
      setUploadingCover(false);
    }
  }

  function toggleMonthOffered(month: string) {
    setMonthState((prev) => ({
      ...prev,
      [month]: { ...prev[month], offered: !prev[month].offered, open: !prev[month].offered ? prev[month].open : false },
    }));
  }
  function toggleMonthOpen(month: string) {
    setMonthState((prev) => ({ ...prev, [month]: { ...prev[month], open: !prev[month].open } }));
  }
  function updateMonthDate(month: string, field: "applicationDeadline" | "casRequestDeadline" | "enrollmentDate", value: string) {
    setMonthState((prev) => ({ ...prev, [month]: { ...prev[month], [field]: value } }));
  }
  function updateMonthYear(month: string, value: string) {
    setMonthState((prev) => ({ ...prev, [month]: { ...prev[month], year: value } }));
  }

  function updateFee(i: number, patch: Partial<Fee>) {
    setFees((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function updateCampus(i: number, patch: Partial<Campus>) {
    setCampuses((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function updateScholarship(i: number, patch: Partial<Scholarship>) {
    setScholarships((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function handleSubmit() {
    if (addingNewCurrency) addCurrencyToCountry(country, currencySymbol);

    const offeredMonths = MONTHS.filter((m) => monthState[m].offered);
    const openMonths = offeredMonths.filter((m) => monthState[m].open);
    const intakeStatus: Record<string, boolean> = {};
    offeredMonths.forEach((m) => { intakeStatus[m] = monthState[m].open; });
    // A university can have more than one intake open at once, each in its own year (e.g.
    // "September 2026, January 2027") — falls back to the first offered-but-closed month so the
    // field isn't blank when nothing's currently open.
    const displayMonths = openMonths.length > 0 ? openMonths : offeredMonths.slice(0, 1);

    const intakeDates: NonNullable<University["intakeDates"]> = {};
    offeredMonths.forEach((m) => {
      const s = monthState[m];
      if (s.applicationDeadline || s.casRequestDeadline || s.enrollmentDate) {
        intakeDates[m] = {
          applicationDeadline: s.applicationDeadline || undefined,
          casRequestDeadline: s.casRequestDeadline || undefined,
          enrollmentDate: s.enrollmentDate || undefined,
        };
      }
    });

    const data: Omit<University, "id"> = {
      name: name.trim(),
      city: city.trim(),
      state: state.trim() || undefined,
      country: country.trim(),
      website: website.trim(),
      tone,
      logoUrl: logoUrl || undefined,
      coverPhotoUrl: coverPhotoUrl || undefined,
      worldRank: qsRanking.trim() || timesHigherRanking.trim() || existing?.worldRank || "#100",
      qsRanking: qsRanking.trim() || undefined,
      timesHigherRanking: timesHigherRanking.trim() || undefined,
      employability,
      studentCount,
      description: description.trim(),
      highlights: highlights.split("\n").map((s) => s.trim()).filter(Boolean),
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      subjects: selectedSubjects,
      intakes: offeredMonths,
      intakeStatus,
      intakeDates,
      openIntake: displayMonths.map((m) => `${m} ${monthState[m].year}`).join(", "),
      requirements: {
        undergraduate: undergraduateRequirements.split("\n").map((s) => s.trim()).filter(Boolean),
        postgraduate: postgraduateRequirements.split("\n").map((s) => s.trim()).filter(Boolean),
      },
      accreditations: accreditations.split(",").map((s) => s.trim()).filter(Boolean),
      scholarshipsAvailable: scholarshipsAvailable || scholarships.some((s) => s.name.trim()),
      scholarships: scholarships.filter((s) => s.name.trim()),
      minIELTS:
        Number(undergraduateEnglishTests.find((e) => e.testName === "IELTS")?.minScore) ||
        Number(postgraduateEnglishTests.find((e) => e.testName === "IELTS")?.minScore) ||
        existing?.minIELTS || 0,
      minGPA: Number(minGPA) || 0,
      englishRequirements: {
        undergraduate: cleanEnglishTests(undergraduateEnglishTests),
        postgraduate: cleanEnglishTests(postgraduateEnglishTests),
      },
      moiAccepted,
      moiAcceptedUniversities: moiAccepted ? moiUniversities : [],
      internalEnglishTestOffered: internalTestOffered,
      internalEnglishTestFree: internalTestOffered ? internalTestFree : undefined,
      internalEnglishTestFee: internalTestOffered && !internalTestFree ? Number(internalTestFee) || 0 : undefined,
      eslElpAvailable,
      applicationFeeWaiverAvailable: feeWaiverAvailable,
      applicationFeeWaiverPercent: feeWaiverAvailable ? Number(feeWaiverPercent) || 0 : undefined,
      currencySymbol,
      fees: fees.filter((f) => f.label.trim()),
      minimumDepositAmount: effectiveDepositAmount || undefined,
      depositMode,
      paymentDeadline: paymentDeadline || undefined,
      depositRules: depositRules.split("\n").map((s) => s.trim()).filter(Boolean),
      admissionSteps: admissionSteps.split("\n").map((s) => s.trim()).filter(Boolean),
      restrictedRegions: restrictedRegions.split("\n").map((s) => s.trim()).filter(Boolean),
      campuses: campuses.filter((c) => c.name.trim()),
      courses: courses.filter((c) => c.name.trim()).map((c) => ({ ...c, subject: c.subject || getAllSubjects()[0] })),
    };

    if (importItem) {
      setSaving(true);
      setSaveError("");
      approveUniversityImport(importItem.id, data)
        .then(async ({ university }) => {
          await refreshUniversities();
          navigate(`/staff/data/universities/${university.id}`);
        })
        .catch((err) => {
          setSaveError(err instanceof Error ? err.message : "Couldn't approve this university.");
          setSaving(false);
        });
      return;
    }
    if (existing) {
      updateUniversity(existing.id, data);
      navigate(`/staff/data/universities/${existing.id}`);
    } else {
      const created = addUniversity(data);
      navigate(`/staff/data/universities/${created.id}`);
    }
  }

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate(backTarget)} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
        <ArrowLeft size={14} /> {importItem ? "Back to import queue" : existing ? `Back to ${existing.name}` : "Back to Universities"}
      </button>

      <h1 className="mb-1 text-xl font-semibold text-slate-900">{importItem ? "Review imported university" : isNew ? "Add University" : `Edit — ${existing?.name}`}</h1>
      <p className="mb-6 text-xs text-slate-500">
        Every field here is what agents, students, and counsellors see on the university and course detail pages.
      </p>

      {importItem && <ImportReviewBanner item={importItem} />}

      <div className="space-y-5">
        <Section title="Identity">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="University name" attention={flag("name")}><Input value={name} onChange={setName} placeholder="e.g. University of Leeds" /></Field>
            <Field label="Website domain"><Input value={website} onChange={setWebsite} placeholder="e.g. leeds.ac.uk" /></Field>
            <Field label="City" attention={flag("city")}><Input value={city} onChange={setCity} placeholder="e.g. Leeds" /></Field>
            <Field label="Province / State (optional)"><Input value={state} onChange={setState} placeholder="e.g. Ontario" /></Field>
            <Field label="Country" attention={flag("country")}>
              <select
                value={addingNewCountry ? "__new__" : country}
                onChange={(e) => {
                  if (e.target.value === "__new__") { setAddingNewCountry(true); setCountry(""); }
                  else { setAddingNewCountry(false); setCountry(e.target.value); }
                }}
                className={SELECT_CLASS}
              >
                <option value="" disabled>Select a country…</option>
                {getAllCountries().map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                <option value="__new__">+ Add a new country…</option>
              </select>
              {addingNewCountry && (
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Type the new country's name"
                  className={`mt-2 ${BASE_INPUT_CLASS} w-full`}
                />
              )}
            </Field>
            <Field label="Card color">
              <select value={tone} onChange={(e) => setTone(e.target.value as University["tone"])} className={SELECT_CLASS}>
                {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Currency (used for fees & scholarship amounts)">
              <select
                value={addingNewCurrency ? "__new__" : currencySymbol}
                onChange={(e) => {
                  if (e.target.value === "__new__") setAddingNewCurrency(true);
                  else { setAddingNewCurrency(false); setCurrencySymbol(e.target.value); }
                }}
                className={SELECT_CLASS}
              >
                {currencyOptions.map((sym) => <option key={sym} value={sym}>{sym}</option>)}
                <option value="__new__">+ Add a custom currency…</option>
              </select>
              {addingNewCurrency && (
                <input
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="Type a new currency symbol, e.g. ¥, NZ$, HK$"
                  className={`mt-2 ${BASE_INPUT_CLASS} w-full`}
                />
              )}
            </Field>
          </div>

          <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Logo">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                  {logoUrl && <img src={logoUrl} alt="Logo preview" className="h-full w-full object-cover" />}
                </div>
                <div className="flex flex-col items-start gap-1.5">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-600 hover:border-slate-300">
                    <Upload size={12} />
                    {uploadingLogo ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoPicked(e.target.files?.[0])} />
                  </label>
                  {logoUrl && <button onClick={() => setLogoUrl("")} className="text-[11px] font-medium text-rose-500">Remove logo</button>}
                  {!logoUrl && <p className="text-[11px] text-slate-400">Falls back to initials on a colored badge.</p>}
                </div>
              </div>
            </Field>
            <Field label="Cover photo">
              <div className="flex items-center gap-3">
                <div className="h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {coverPhotoUrl && <img src={coverPhotoUrl} alt="Cover preview" className="h-full w-full object-cover" />}
                </div>
                <div className="flex flex-col items-start gap-1.5">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-600 hover:border-slate-300">
                    <Upload size={12} />
                    {uploadingCover ? "Uploading…" : coverPhotoUrl ? "Replace photo" : "Upload photo"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverPicked(e.target.files?.[0])} />
                  </label>
                  {coverPhotoUrl && <button onClick={() => setCoverPhotoUrl("")} className="text-[11px] font-medium text-rose-500">Remove photo</button>}
                  {!coverPhotoUrl && <p className="text-[11px] text-slate-400">Falls back to an abstract illustration.</p>}
                </div>
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Campuses" attention={flag("campuses")} action={
          <button onClick={() => setCampuses((prev) => [...prev, blankCampus(city)])} className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]">
            <Plus size={13} /> Add campus
          </button>
        }>
          {campuses.length === 0 && (
            <p className="text-xs text-slate-400">No campuses added yet — a generic "Main Campus" will be shown using the city above until you add real ones.</p>
          )}
          <div className="space-y-2">
            {campuses.map((c, i) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2">
                <Input value={c.name} onChange={(v) => updateCampus(i, { name: v })} placeholder="Campus name, e.g. City Centre Campus" className="min-w-[160px] flex-1" />
                <Input value={c.city} onChange={(v) => updateCampus(i, { city: v })} placeholder="City" className="w-32" />
                <button onClick={() => setCampuses((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove campus" className="shrink-0 text-slate-300 hover:text-rose-500">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Rankings & Stats">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="QS World Ranking"><Input value={qsRanking} onChange={setQsRanking} placeholder="#32" /></Field>
            <Field label="Times Higher Education Ranking"><Input value={timesHigherRanking} onChange={setTimesHigherRanking} placeholder="#45" /></Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Employability"><Input value={employability} onChange={setEmployability} placeholder="93%" /></Field>
            <Field label="Student count"><Input value={studentCount} onChange={setStudentCount} placeholder="40,000+" /></Field>
          </div>
        </Section>

        <Section title="Overview">
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={TEXTAREA_CLASS} placeholder="A world-class university known for…" />
          </Field>
          <Field label="Highlights (one per line)">
            <textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={4} className={TEXTAREA_CLASS} placeholder={"Global recognition\nWide range of scholarships"} />
          </Field>
          <Field label="Tags (comma separated)">
            <Input value={tags} onChange={setTags} placeholder="Top 30 Global, Research Intensive" />
          </Field>
        </Section>

        <Section title="Subjects offered">
          <p className="text-[11px] text-slate-400">
            Pick every subject genre this university offers, so it shows up when a student or agent browses by subject even before a
            specific course is added under it. Whatever subject a course below carries is always included too, automatically.
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {getAllSubjects().map((s) => (
              <label key={s} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[11.5px] text-slate-700">
                <input type="checkbox" checked={selectedSubjects.includes(s)} onChange={() => toggleSubject(s)} />
                {s}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={newSubject}
              onChange={setNewSubject}
              placeholder="Add a new subject to the picklist, e.g. Environmental Science"
              className="flex-1"
            />
            <button
              onClick={handleAddSubject}
              disabled={!newSubject.trim()}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--brand-600)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              <Plus size={13} /> Add subject
            </button>
          </div>
        </Section>

        <Section title="Intakes" attention={flag("intakes")}>
          <p className="text-xs text-slate-400">
            Toggle every month this university runs an intake, then mark which of those are currently open for applications — more than
            one can be open at once, each with its own year, e.g. "September 2026" and "January 2027" open at the same time.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MONTHS.map((m) => (
              <div key={m} className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={monthState[m].offered} onChange={() => toggleMonthOffered(m)} />
                    {m}
                  </label>
                  {monthState[m].offered && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <input
                        type="number"
                        value={monthState[m].year}
                        onChange={(e) => updateMonthYear(m, e.target.value)}
                        aria-label={`${m} intake year`}
                        className="w-16 rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-800"
                      />
                      <button
                        onClick={() => toggleMonthOpen(m)}
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          monthState[m].open ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {monthState[m].open ? "Open" : "Closed"}
                      </button>
                    </div>
                  )}
                </div>
                {monthState[m].offered && (
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <label className="block">
                      <span className="mb-0.5 block text-[10px] text-slate-400">Application last date</span>
                      <input
                        type="date"
                        value={monthState[m].applicationDeadline}
                        onChange={(e) => updateMonthDate(m, "applicationDeadline", e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-800"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-0.5 block text-[10px] text-slate-400">CAS request last date</span>
                      <input
                        type="date"
                        value={monthState[m].casRequestDeadline}
                        onChange={(e) => updateMonthDate(m, "casRequestDeadline", e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-800"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-0.5 block text-[10px] text-slate-400">Enrollment date</span>
                      <input
                        type="date"
                        value={monthState[m].enrollmentDate}
                        onChange={(e) => updateMonthDate(m, "enrollmentDate", e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-800"
                      />
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Academic Requirements" attention={flag("requirements")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Minimum GPA (out of 4.0)"><Input type="number" value={minGPA} onChange={setMinGPA} /></Field>
            <Field label="Accreditations (comma separated)"><Input value={accreditations} onChange={setAccreditations} placeholder="Russell Group" /></Field>
          </div>
          <p className="text-[11px] text-slate-400">Bachelor's and Postgraduate admissions criteria are rarely the same — enter each separately.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Bachelor's (Undergraduate) requirements — one per line">
              <textarea
                value={undergraduateRequirements}
                onChange={(e) => setUndergraduateRequirements(e.target.value)}
                rows={4}
                className={TEXTAREA_CLASS}
                placeholder={"High school diploma, 80% average\nPersonal statement\nOne academic reference"}
              />
            </Field>
            <Field label="Postgraduate requirements — one per line">
              <textarea
                value={postgraduateRequirements}
                onChange={(e) => setPostgraduateRequirements(e.target.value)}
                rows={4}
                className={TEXTAREA_CLASS}
                placeholder={"Bachelor's degree, 2:1 or equivalent\nStatement of purpose\nTwo academic references"}
              />
            </Field>
          </div>
        </Section>

        <Section title="Scholarship Amount" attention={flag("scholarships")} action={
          <button onClick={() => setScholarships((prev) => [...prev, blankScholarship()])} className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]">
            <Plus size={13} /> Add scholarship
          </button>
        }>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={scholarshipsAvailable} onChange={(e) => setScholarshipsAvailable(e.target.checked)} />
            Scholarships available
          </label>
          {scholarships.length === 0 && <p className="text-xs text-slate-400">No named scholarships added yet — the checkbox above still shows a generic "Scholarships available" badge.</p>}
          <div className="space-y-2">
            {scholarships.map((s, i) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                <div className="flex items-center gap-2">
                  <Input value={s.name} onChange={(v) => updateScholarship(i, { name: v })} placeholder="Scholarship name, e.g. Vice-Chancellor's Excellence Scholarship" className="flex-1" />
                  <Input value={s.amount} onChange={(v) => updateScholarship(i, { amount: v })} placeholder={`Amount, e.g. Up to ${currencySymbol}10,000`} className="w-48" />
                  <button onClick={() => setScholarships((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove scholarship" className="shrink-0 text-slate-300 hover:text-rose-500">
                    <Trash2 size={15} />
                  </button>
                </div>
                <input
                  value={s.description ?? ""}
                  onChange={(e) => updateScholarship(i, { description: e.target.value })}
                  placeholder="Eligibility / description (optional)"
                  className={`${BASE_INPUT_CLASS} mt-2`}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section title="English Requirements" attention={flag("englishRequirements")}>
          <p className="text-[11px] text-slate-400">Accepted tests and minimum scores, entered separately for each degree level.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">Bachelor's (Undergraduate)</p>
                <button
                  onClick={() => setUndergraduateEnglishTests((prev) => [...prev, blankEnglishReq()])}
                  className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]"
                >
                  <Plus size={13} /> Add test
                </button>
              </div>
              <EnglishTestsEditor tests={undergraduateEnglishTests} onChange={setUndergraduateEnglishTests} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">Postgraduate</p>
                <button
                  onClick={() => setPostgraduateEnglishTests((prev) => [...prev, blankEnglishReq()])}
                  className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]"
                >
                  <Plus size={13} /> Add test
                </button>
              </div>
              <EnglishTestsEditor tests={postgraduateEnglishTests} onChange={setPostgraduateEnglishTests} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={moiAccepted} onChange={(e) => setMoiAccepted(e.target.checked)} />
              Accepts MOI (Medium of Instruction) — Postgraduate only
            </label>
            <p className="mt-1 text-[11px] text-slate-400">
              Lets a postgraduate applicant submit an MOI letter instead of a formal English test, if their undergraduate degree was
              taught in English at one of the universities selected below.
            </p>
            {moiAccepted && (
              <div className="mt-3">
                <Input value={moiSearch} onChange={setMoiSearch} placeholder="Search universities…" className="mb-2 w-full" />
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-2">
                  {getAllUgcUniversitiesBD()
                    .filter((u) => u.toLowerCase().includes(moiSearch.trim().toLowerCase()))
                    .map((u) => (
                      <label key={u} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
                        <input type="checkbox" checked={moiUniversities.includes(u)} onChange={() => toggleMoiUniversity(u)} />
                        {u}
                      </label>
                    ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">{moiUniversities.length} selected</p>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    value={newMoiUniversity}
                    onChange={setNewMoiUniversity}
                    placeholder="University missing from this list? Add it here"
                    className="flex-1"
                  />
                  <button
                    onClick={handleAddMoiUniversity}
                    disabled={!newMoiUniversity.trim()}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--brand-600)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={internalTestOffered} onChange={(e) => setInternalTestOffered(e.target.checked)} />
              Offers its own internal English test — Undergraduate & Postgraduate
            </label>
            <p className="mt-1 text-[11px] text-slate-400">
              Some universities run their own English test in place of IELTS/TOEFL — free for some, a paid fee for others.
            </p>
            {internalTestOffered && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setInternalTestFree(true)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${internalTestFree ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    Free
                  </button>
                  <button
                    type="button"
                    onClick={() => setInternalTestFree(false)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${!internalTestFree ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    Paid
                  </button>
                </div>
                {!internalTestFree && (
                  <Input
                    type="number"
                    value={internalTestFee}
                    onChange={setInternalTestFee}
                    placeholder={`Fee (${currencySymbol})`}
                    className="w-36"
                  />
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={eslElpAvailable} onChange={(e) => setEslElpAvailable(e.target.checked)} />
              ESL / English Language Program available
            </label>
            <p className="mt-1 text-[11px] text-slate-400">
              A real preparatory English program the university runs — distinct from the internal test above, which is an admissions test, not a course.
            </p>
          </div>
        </Section>

        <Section title="Fees" attention={flag("fees")} action={
          <button onClick={() => setFees((prev) => [...prev, blankFee()])} className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]">
            <Plus size={13} /> Add line item
          </button>
        }>
          <div className="space-y-2">
            {fees.map((f, i) => {
              const isTuition = f.label.trim().toLowerCase() === "tuition fee";
              return (
                <div key={i} className="space-y-1.5 rounded-lg border border-slate-100 p-2">
                  <div className="flex items-center gap-2">
                    <Input value={f.label} onChange={(v) => updateFee(i, { label: v })} placeholder="Tuition Fee" className="flex-1" />
                    <span className="shrink-0 text-xs font-medium text-slate-400">{currencySymbol}</span>
                    <Input type="number" value={String(f.amount)} onChange={(v) => updateFee(i, { amount: Number(v) || 0 })} className="w-32" />
                    <button onClick={() => setFees((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove fee line" className="shrink-0 text-slate-300 hover:text-rose-500">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {isTuition && (
                    <div className="flex items-center gap-2 pl-1">
                      <input
                        type="range"
                        min={MIN_TUITION_FEE}
                        max={MAX_TUITION_FEE}
                        step={500}
                        value={Math.min(Math.max(f.amount, MIN_TUITION_FEE), MAX_TUITION_FEE)}
                        onChange={(e) => updateFee(i, { amount: Number(e.target.value) })}
                        className="flex-1 accent-[var(--brand-600)]"
                      />
                      <span className="w-32 shrink-0 text-right text-[11px] text-slate-400">
                        {currencySymbol}{MIN_TUITION_FEE.toLocaleString()} – {currencySymbol}{MAX_TUITION_FEE.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Minimum Fees Deposit & Deposit Rules" attention={flag("minimumDepositAmount")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={`Minimum deposit amount (${currencySymbol})`}>
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDepositMode("custom")}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    depositMode === "custom" ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]" : "border-slate-200 text-slate-600 hover:border-[var(--brand-300)] hover:text-[var(--brand-600)]"
                  }`}
                >
                  Custom amount
                </button>
                <button
                  type="button"
                  onClick={() => setDepositMode("half")}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    depositMode === "half" ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]" : "border-slate-200 text-slate-600 hover:border-[var(--brand-300)] hover:text-[var(--brand-600)]"
                  }`}
                >
                  50% of one year
                </button>
                <button
                  type="button"
                  onClick={() => setDepositMode("full")}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    depositMode === "full" ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]" : "border-slate-200 text-slate-600 hover:border-[var(--brand-300)] hover:text-[var(--brand-600)]"
                  }`}
                >
                  Full payment of one year
                </button>
              </div>
              {depositMode === "custom" ? (
                <Input type="number" value={minimumDepositAmount} onChange={setMinimumDepositAmount} placeholder="e.g. 2000" className="w-40" />
              ) : (
                <p className="text-sm font-semibold text-slate-800">
                  {currencySymbol}{effectiveDepositAmount.toLocaleString()}
                  <span className="ml-1.5 text-xs font-normal text-slate-400">
                    ({depositMode === "half" ? "50%" : "100%"} of tuition fee — updates automatically
                    {!tuitionFeeAmount && ", set a Tuition Fee amount above"})
                  </span>
                </p>
              )}
            </Field>
            <Field label="Last date of payment">
              <input type="date" value={paymentDeadline} onChange={(e) => setPaymentDeadline(e.target.value)} className={`${BASE_INPUT_CLASS} w-40`} />
            </Field>
          </div>
          <Field label="Deposit rules (one per line)">
            <textarea
              value={depositRules}
              onChange={(e) => setDepositRules(e.target.value)}
              rows={4}
              className={TEXTAREA_CLASS}
              placeholder={"Due within 14 days of accepting the offer\nNon-refundable if the visa application is refused\nDeducted from the first semester's tuition fee"}
            />
          </Field>
          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={feeWaiverAvailable} onChange={(e) => setFeeWaiverAvailable(e.target.checked)} />
              Application fee waiver available
            </label>
            {feeWaiverAvailable && (
              <Input
                type="number"
                value={feeWaiverPercent}
                onChange={setFeeWaiverPercent}
                placeholder="Waiver, up to % (e.g. 100)"
                className="mt-2 w-48"
              />
            )}
          </div>
        </Section>

        <Section title="Admission Procedure">
          <Field label="Application steps, in order (one per line)">
            <textarea
              value={admissionSteps}
              onChange={(e) => setAdmissionSteps(e.target.value)}
              rows={5}
              className={TEXTAREA_CLASS}
              placeholder={"Submit online application with academic transcripts\nReceive conditional offer letter\nPay the deposit to confirm your place\nReceive final offer and CAS/I-20\nApply for your student visa"}
            />
          </Field>
        </Section>

        <Section title="Restricted Regions">
          <p className="text-[11px] text-slate-400">
            Sub-national regions/divisions this university does not accept applicants from — based on the applicant's passport/permanent
            address or where they studied (education board or prior institution). Shown as a clear warning, not a required field.
          </p>
          <Field label="Restricted regions/divisions (one per line)">
            <textarea
              value={restrictedRegions}
              onChange={(e) => setRestrictedRegions(e.target.value)}
              rows={3}
              className={TEXTAREA_CLASS}
              placeholder={"Sylhet Division\nChittagong Division"}
            />
          </Field>
        </Section>

        {isNew ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">
            Courses are added from the university's own page once it's created — save this university first, then add courses from its Courses tab.
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">
            Courses are now managed from the university's own page — go to{" "}
            <button onClick={() => navigate(`/staff/data/universities/${existing!.id}`, { state: { tab: "Courses" } })} className="font-medium text-[var(--brand-600)]">
              {existing?.name}'s Courses tab
            </button>{" "}
            to add, edit, or remove courses.
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
        {saveError && <p className="mr-auto text-[11.5px] text-rose-600">{saveError}</p>}
        <Button variant="secondary" onClick={() => navigate(backTarget)}>Cancel</Button>
        <Button disabled={!canSubmit || saving} onClick={handleSubmit}>
          {importItem ? (saving ? "Approving…" : "Approve & add university") : isNew ? "Add University" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

const BASE_INPUT_CLASS = "rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800";
const SELECT_CLASS = `w-full ${BASE_INPUT_CLASS}`;
const TEXTAREA_CLASS = `w-full resize-none ${BASE_INPUT_CLASS}`;

/** `attention` (import mode only) marks a section the reviewer must verify against the source
 * page, with the page's own words when the extractor captured them. */
function Section({ title, action, children, attention }: { title: string; action?: React.ReactNode; children: React.ReactNode; attention?: { evidence?: string } }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${attention ? "border-amber-300" : "border-slate-200"}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-800">{title} {attention && <CheckPill />}</p>
        {action}
      </div>
      {attention?.evidence && <p className="mb-2 text-[11px] italic text-slate-400">Page says: “{attention.evidence}”</p>}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function CheckPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
      <AlertTriangle size={10} /> Check
    </span>
  );
}

/** Everything the reviewer should know before trusting the draft: where it came from, what the
 * extractor wasn't sure about, and whether it looks like a university already in the catalog. */
function ImportReviewBanner({ item }: { item: UniversityImportItem }) {
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
        Nothing is saved until you approve. Sections marked <CheckPill /> must be verified against the page — fees and deposits always are. Courses are
        added afterwards from the university's Courses tab (or imported from URLs there).
      </p>
      {extracted?.possibleDuplicateOf && (
        <p className="mt-2 rounded-lg bg-rose-100 px-2.5 py-1.5 text-[11.5px] font-medium text-rose-800">
          Looks like "{extracted.possibleDuplicateOf.name}" is already in the catalog.
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

function Field({ label, children, attention }: { label: string; children: React.ReactNode; attention?: { evidence?: string } }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      <span className="flex items-center gap-2">{label} {attention && <CheckPill />}</span>
      <div className="mt-1">{children}</div>
      {attention?.evidence && <p className="mt-1 text-[11px] italic text-slate-400">Page says: “{attention.evidence}”</p>}
    </label>
  );
}

function Input({
  value, onChange, placeholder, type = "text", className = "w-full",
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${BASE_INPUT_CLASS} ${className}`}
    />
  );
}
