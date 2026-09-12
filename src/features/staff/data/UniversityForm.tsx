import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, X, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui";
import { getAllSubjects, addSubject } from "../../../data/subjectsStore";
import { getAllCountries } from "../../../data/countryRegistry";
import { getUniversityById, addUniversity, updateUniversity } from "../../../data/universityCatalogStore";
import { TEST_NAME_OPTIONS } from "../../../utils/universityFilter";
import type { University } from "../../../types";

type Course = University["courses"][number];
type Fee = University["fees"][number];
type Campus = NonNullable<University["campuses"]>[number];
type EnglishReq = NonNullable<University["englishRequirements"]>[number];
const TONES: University["tone"][] = ["violet", "amber", "teal", "rose"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function blankCourse(): Course {
  return { id: `crs-custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`, name: "", level: "Postgraduate", duration: "1 year", subject: getAllSubjects()[0], feeUSD: 20000 };
}
function blankFee(): Fee {
  return { label: "Tuition Fee", amount: 0 };
}
function blankCampus(city: string): Campus {
  return { id: `cmp-custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`, name: "Main Campus", city };
}
function blankEnglishReq(): EnglishReq {
  return { testName: TEST_NAME_OPTIONS[0], minScore: "", minBand: "", skillScores: [] };
}
const COMMON_SKILLS = ["Listening", "Reading", "Writing", "Speaking"];

type MonthState = Record<string, { offered: boolean; open: boolean }>;

function initMonthState(existing?: University): MonthState {
  const offered = new Set(existing?.intakes ?? []);
  const openMap = existing?.intakeStatus ?? {};
  const openIntakeMonth = existing?.openIntake?.split(" ")[0];
  const state: MonthState = {};
  MONTHS.forEach((m) => {
    state[m] = { offered: offered.has(m), open: openMap[m] ?? m === openIntakeMonth };
  });
  return state;
}

export default function DataUniversityForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const existing = id ? getUniversityById(id) : undefined;
  const isNew = !id;

  const [name, setName] = useState(existing?.name ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [country, setCountry] = useState(existing?.country ?? searchParams.get("country") ?? "");
  const [addingNewCountry, setAddingNewCountry] = useState(
    () => !!country && !getAllCountries().some((c) => c.name.toLowerCase() === country.toLowerCase())
  );
  const [newSubject, setNewSubject] = useState("");
  const [, forceTick] = useState(0);
  const [website, setWebsite] = useState(existing?.website ?? "");
  const [tone, setTone] = useState<University["tone"]>(existing?.tone ?? "violet");
  const [worldRank, setWorldRank] = useState(existing?.worldRank ?? "#100");
  const [employability, setEmployability] = useState(existing?.employability ?? "85%");
  const [studentCount, setStudentCount] = useState(existing?.studentCount ?? "20,000+");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [highlights, setHighlights] = useState((existing?.highlights ?? []).join("\n"));
  const [tags, setTags] = useState((existing?.tags ?? []).join(", "));
  const [subjects, setSubjects] = useState<Set<string>>(new Set(existing?.subjects ?? []));
  const [monthState, setMonthState] = useState<MonthState>(() => initMonthState(existing));
  const [intakeYear, setIntakeYear] = useState(() => existing?.openIntake?.split(" ")[1] ?? String(new Date().getFullYear() + 1));
  const [requirements, setRequirements] = useState((existing?.requirements ?? []).join("\n"));
  const [accreditations, setAccreditations] = useState((existing?.accreditations ?? []).join(", "));
  const [scholarshipsAvailable, setScholarshipsAvailable] = useState(existing?.scholarshipsAvailable ?? false);
  const [minIELTS, setMinIELTS] = useState(String(existing?.minIELTS ?? 6.0));
  const [minGPA, setMinGPA] = useState(String(existing?.minGPA ?? 3.0));
  const [currencySymbol, setCurrencySymbol] = useState(existing?.currencySymbol ?? "$");
  const [fees, setFees] = useState<Fee[]>(existing?.fees ?? [blankFee()]);
  const [courses, setCourses] = useState<Course[]>(existing?.courses ?? [blankCourse()]);
  const [campuses, setCampuses] = useState<Campus[]>(existing?.campuses ?? []);
  const [englishTests, setEnglishTests] = useState<EnglishReq[]>(existing?.englishRequirements ?? []);

  const canSubmit = name.trim() && city.trim() && country.trim() && courses.every((c) => c.name.trim());
  const backTarget = existing
    ? `/staff/data/universities/${existing.id}`
    : country.trim() ? `/staff/data/countries/${encodeURIComponent(country.trim())}` : "/staff/data";

  function toggleSubject(s: string) {
    setSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  function handleAddSubject() {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    const created = addSubject(trimmed);
    setSubjects((prev) => new Set(prev).add(trimmed));
    setNewSubject("");
    if (created) forceTick((t) => t + 1);
  }

  function toggleMonthOffered(month: string) {
    setMonthState((prev) => ({
      ...prev,
      [month]: { offered: !prev[month].offered, open: !prev[month].offered ? prev[month].open : false },
    }));
  }
  function toggleMonthOpen(month: string) {
    setMonthState((prev) => ({ ...prev, [month]: { ...prev[month], open: !prev[month].open } }));
  }

  function updateCourse(i: number, patch: Partial<Course>) {
    setCourses((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function updateFee(i: number, patch: Partial<Fee>) {
    setFees((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function updateCampus(i: number, patch: Partial<Campus>) {
    setCampuses((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function updateEnglishReq(i: number, patch: Partial<EnglishReq>) {
    setEnglishTests((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function addSkillScore(testIdx: number) {
    setEnglishTests((prev) =>
      prev.map((e, idx) => {
        if (idx !== testIdx) return e;
        const used = new Set((e.skillScores ?? []).map((s) => s.skill));
        const nextSkill = COMMON_SKILLS.find((s) => !used.has(s)) ?? "";
        return { ...e, skillScores: [...(e.skillScores ?? []), { skill: nextSkill, score: "" }] };
      })
    );
  }
  function updateSkillScore(testIdx: number, skillIdx: number, patch: Partial<{ skill: string; score: string }>) {
    setEnglishTests((prev) =>
      prev.map((e, idx) =>
        idx !== testIdx
          ? e
          : { ...e, skillScores: (e.skillScores ?? []).map((s, si) => (si === skillIdx ? { ...s, ...patch } : s)) }
      )
    );
  }
  function removeSkillScore(testIdx: number, skillIdx: number) {
    setEnglishTests((prev) =>
      prev.map((e, idx) =>
        idx !== testIdx ? e : { ...e, skillScores: (e.skillScores ?? []).filter((_, si) => si !== skillIdx) }
      )
    );
  }

  function handleSubmit() {
    const offeredMonths = MONTHS.filter((m) => monthState[m].offered);
    const openMonths = offeredMonths.filter((m) => monthState[m].open);
    const intakeStatus: Record<string, boolean> = {};
    offeredMonths.forEach((m) => { intakeStatus[m] = monthState[m].open; });
    const firstOpen = openMonths[0] ?? offeredMonths[0];

    const data: Omit<University, "id"> = {
      name: name.trim(),
      city: city.trim(),
      country: country.trim(),
      website: website.trim(),
      tone,
      worldRank,
      employability,
      studentCount,
      description: description.trim(),
      highlights: highlights.split("\n").map((s) => s.trim()).filter(Boolean),
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      subjects: [...subjects],
      intakes: offeredMonths,
      intakeStatus,
      openIntake: firstOpen ? `${firstOpen} ${intakeYear}` : "",
      requirements: requirements.split("\n").map((s) => s.trim()).filter(Boolean),
      accreditations: accreditations.split(",").map((s) => s.trim()).filter(Boolean),
      scholarshipsAvailable,
      minIELTS: Number(minIELTS) || 0,
      minGPA: Number(minGPA) || 0,
      englishRequirements: englishTests
        .filter((e) => e.minScore.trim())
        .map((e) => ({
          ...e,
          minBand: e.minBand?.trim() || undefined,
          skillScores: (e.skillScores ?? []).filter((s) => s.skill.trim() && s.score.trim()),
        })),
      currencySymbol,
      fees: fees.filter((f) => f.label.trim()),
      campuses: campuses.filter((c) => c.name.trim()),
      courses: courses.filter((c) => c.name.trim()).map((c) => ({ ...c, subject: c.subject || getAllSubjects()[0] })),
    };

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
        <ArrowLeft size={14} /> {existing ? `Back to ${existing.name}` : "Back to Universities"}
      </button>

      <h1 className="mb-1 text-xl font-semibold text-slate-900">{isNew ? "Add University" : `Edit — ${existing?.name}`}</h1>
      <p className="mb-6 text-xs text-slate-500">
        Every field here is what agents, students, and counsellors see on the university and course detail pages.
      </p>

      <div className="space-y-5">
        <Section title="Identity">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="University name"><Input value={name} onChange={setName} placeholder="e.g. University of Leeds" /></Field>
            <Field label="Website domain"><Input value={website} onChange={setWebsite} placeholder="e.g. leeds.ac.uk" /></Field>
            <Field label="City"><Input value={city} onChange={setCity} placeholder="e.g. Leeds" /></Field>
            <Field label="Country">
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
            <Field label="Currency symbol"><Input value={currencySymbol} onChange={setCurrencySymbol} placeholder="e.g. £, $, €, A$, C$" /></Field>
          </div>
        </Section>

        <Section title="Campuses" action={
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
                <Input
                  type="number"
                  value={c.feeUSD !== undefined ? String(c.feeUSD) : ""}
                  onChange={(v) => updateCampus(i, { feeUSD: v ? Number(v) || 0 : undefined })}
                  placeholder="Fee override (optional)"
                  className="w-40"
                />
                <button onClick={() => setCampuses((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove campus" className="shrink-0 text-slate-300 hover:text-rose-500">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Rankings & Stats">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="World rank"><Input value={worldRank} onChange={setWorldRank} placeholder="#32" /></Field>
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {getAllSubjects().map((s) => (
              <label key={s} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
                <input type="checkbox" checked={subjects.has(s)} onChange={() => toggleSubject(s)} />
                {s}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={newSubject}
              onChange={setNewSubject}
              placeholder="Add a new subject, e.g. Environmental Science"
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

        <Section title="Intakes">
          <p className="text-xs text-slate-400">Toggle every month this university runs an intake, then mark which of those are currently open for applications.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MONTHS.map((m) => (
              <div key={m} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={monthState[m].offered} onChange={() => toggleMonthOffered(m)} />
                  {m}
                </label>
                {monthState[m].offered && (
                  <button
                    onClick={() => toggleMonthOpen(m)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      monthState[m].open ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {monthState[m].open ? "Open" : "Closed"}
                  </button>
                )}
              </div>
            ))}
          </div>
          <Field label="Year shown for the currently-open intake">
            <input type="number" value={intakeYear} onChange={(e) => setIntakeYear(e.target.value)} className={`${BASE_INPUT_CLASS} w-32`} />
          </Field>
        </Section>

        <Section title="Requirements">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Minimum IELTS (used for search filtering)"><Input type="number" value={minIELTS} onChange={setMinIELTS} /></Field>
            <Field label="Minimum GPA (out of 4.0)"><Input type="number" value={minGPA} onChange={setMinGPA} /></Field>
          </div>
          <Field label="Requirements (one per line)">
            <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={4} className={TEXTAREA_CLASS} placeholder={"IELTS 6.5 overall\nBachelor's degree, 3.0 GPA minimum"} />
          </Field>
          <Field label="Accreditations (comma separated)"><Input value={accreditations} onChange={setAccreditations} placeholder="Russell Group" /></Field>
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={scholarshipsAvailable} onChange={(e) => setScholarshipsAvailable(e.target.checked)} />
            Scholarships available
          </label>
        </Section>

        <Section title="English Tests Accepted" action={
          <button onClick={() => setEnglishTests((prev) => [...prev, blankEnglishReq()])} className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]">
            <Plus size={13} /> Add test
          </button>
        }>
          {englishTests.length === 0 && <p className="text-xs text-slate-400">No accepted tests listed yet beyond the minimum IELTS above.</p>}
          <div className="space-y-3">
            {englishTests.map((e, i) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                <div className="flex items-center gap-2">
                  <select value={e.testName} onChange={(ev) => updateEnglishReq(i, { testName: ev.target.value })} className={`${SELECT_CLASS} flex-1`}>
                    {TEST_NAME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Input value={e.minScore} onChange={(v) => updateEnglishReq(i, { minScore: v })} placeholder="Min score, e.g. 6.5 or Pass" className="w-36" />
                  <Input value={e.minBand ?? ""} onChange={(v) => updateEnglishReq(i, { minBand: v })} placeholder="No band below (optional)" className="w-40" />
                  <button onClick={() => setEnglishTests((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove test" className="shrink-0 text-slate-300 hover:text-rose-500">
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="mt-2 pl-1">
                  {(e.skillScores ?? []).length > 0 && (
                    <div className="mb-1.5 space-y-1.5">
                      {e.skillScores!.map((s, si) => (
                        <div key={si} className="flex items-center gap-2">
                          <Input value={s.skill} onChange={(v) => updateSkillScore(i, si, { skill: v })} placeholder="Skill, e.g. Speaking" className="w-40 !py-1.5 text-xs" />
                          <Input value={s.score} onChange={(v) => updateSkillScore(i, si, { score: v })} placeholder="Min score" className="w-28 !py-1.5 text-xs" />
                          <button onClick={() => removeSkillScore(i, si)} aria-label="Remove skill score" className="shrink-0 text-slate-300 hover:text-rose-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => addSkillScore(i)} className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]">
                    <Plus size={12} /> Add individual skill score
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Fees" action={
          <button onClick={() => setFees((prev) => [...prev, blankFee()])} className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]">
            <Plus size={13} /> Add line item
          </button>
        }>
          <div className="space-y-2">
            {fees.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={f.label} onChange={(v) => updateFee(i, { label: v })} placeholder="Tuition Fee" className="flex-1" />
                <Input type="number" value={String(f.amount)} onChange={(v) => updateFee(i, { amount: Number(v) || 0 })} className="w-32" />
                <button onClick={() => setFees((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove fee line" className="shrink-0 text-slate-300 hover:text-rose-500">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </Section>

        {isNew ? (
          <Section title="Courses" action={
            <button onClick={() => setCourses((prev) => [...prev, blankCourse()])} className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]">
              <Plus size={13} /> Add course
            </button>
          }>
            <div className="space-y-3">
              {courses.map((c, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Course {i + 1}</p>
                    <button onClick={() => setCourses((prev) => prev.filter((_, idx) => idx !== i))} aria-label={`Remove course ${i + 1}`} className="text-slate-300 hover:text-rose-500">
                      <X size={15} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input value={c.name} onChange={(v) => updateCourse(i, { name: v })} placeholder="Course name, e.g. MSc Data Science" className="w-full sm:col-span-2" />
                    <select value={c.subject} onChange={(e) => updateCourse(i, { subject: e.target.value })} className={SELECT_CLASS}>
                      {getAllSubjects().map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={c.level} onChange={(e) => updateCourse(i, { level: e.target.value })} className={SELECT_CLASS}>
                      <option>Undergraduate</option>
                      <option>Postgraduate</option>
                    </select>
                    <Input value={c.duration} onChange={(v) => updateCourse(i, { duration: v })} placeholder="Duration, e.g. 1 year" />
                    <Input type="number" value={String(c.feeUSD)} onChange={(v) => updateCourse(i, { feeUSD: Number(v) || 0 })} placeholder="Annual fee (USD)" />
                  </div>
                </div>
              ))}
            </div>
          </Section>
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

      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
        <Button variant="secondary" onClick={() => navigate(backTarget)}>Cancel</Button>
        <Button disabled={!canSubmit} onClick={handleSubmit}>{isNew ? "Add University" : "Save Changes"}</Button>
      </div>
    </div>
  );
}

const BASE_INPUT_CLASS = "rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800";
const SELECT_CLASS = `w-full ${BASE_INPUT_CLASS}`;
const TEXTAREA_CLASS = `w-full resize-none ${BASE_INPUT_CLASS}`;

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-800">{title}</p>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <div className="mt-1">{children}</div>
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
