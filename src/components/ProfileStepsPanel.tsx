import { useState } from "react";
import { Check, User, GraduationCap, Languages, Briefcase, SlidersHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { getProfileCompletion, markStepComplete } from "../data/profileCompletion";
import { loadAcademicLevels, saveAcademicLevels, type AcademicLevelEntry } from "../data/academicProfileStore";
import {
  loadPersonalInfo, savePersonalInfo, type PersonalInfoDetails,
  loadEnglishTests, saveEnglishTests, type EnglishTestDetails,
  loadWorkExperience, saveWorkExperience, type WorkExperienceDetails,
  loadPreferences, savePreferences, type PreferencesDetails,
} from "../data/studentProfileDetailsStore";
import { getAllSubjects } from "../data/subjectsStore";
import { Chip, ChipRow, Toggle } from "./ui/mobile";

const STEP_ICON: Record<string, typeof User> = {
  "personal-information": User,
  "academic-details": GraduationCap,
  "english-proficiency": Languages,
  "work-experience": Briefcase,
  "preferences": SlidersHorizontal,
};

const STUDY_LEVELS = ["Bachelor's", "Master's", "PhD", "Diploma"];
const INTAKES = ["January", "May", "September", "Any"];
const BUDGETS = ["Under £20k", "£20k – £30k", "£30k – £40k", "£40k+"];
const ACCOMMODATIONS = ["University Halls", "Private Rental", "Homestay", "No preference"];
const LANGUAGES = ["English", "Bengali"];
const DESTINATIONS = ["United Kingdom", "United States", "Canada", "Australia", "Ireland", "Germany", "UAE"];
const GENDERS = ["Female", "Male", "Other", "Prefer not to say"];
const MARITAL_STATUSES = ["Single", "Married"];
const ACADEMIC_LEVELS = ["SSC / O-Level", "HSC / A-Level", "Bachelor's", "Master's", "Other"];
const WORK_TYPES = ["Full-time", "Part-time", "Internship", "Self-employed", "Volunteer"];

const EMPTY_PERSONAL: PersonalInfoDetails = {
  firstName: "", lastName: "", email: "", phone: "", dob: "", gender: "Female", nationality: "",
  fatherName: "", motherName: "", maritalStatus: "Single", passportNumber: "", personalNumber: "",
  previousPassportNumber: "", placeOfBirth: "", issuingAuthority: "", issueDate: "", passportExpiry: "",
  permanentAddress: "", presentAddress: "", city: "", country: "", emergencyContactName: "",
  emergencyContactRelationship: "", emergencyContactAddress: "", emergencyContactPhone: "", emergencyContactEmail: "",
};

const EMPTY_ACADEMIC_ENTRY: AcademicLevelEntry = { level: "SSC / O-Level", institution: "", board: "", group: "", major: "", grade: "", passingYear: "" };

const EMPTY_ENGLISH_ENTRY: EnglishTestDetails = {
  testName: "IELTS", testType: "", overallScore: "", listening: "", reading: "", writing: "", speaking: "",
  testDate: "", expiryDate: "", reportNumber: "", issuingInstitution: "",
};

const EMPTY_WORK_ENTRY: WorkExperienceDetails = {
  type: "Full-time", company: "", title: "", industry: "", startDate: "", endDate: "", currentlyWorking: false, description: "",
};

const EMPTY_PREFERENCES: PreferencesDetails = {
  destinations: [], studyLevel: "Master's", fields: [], intake: "January", budget: "£30k – £40k",
  accommodation: "University Halls", scholarshipInterest: false, emailUpdates: true, smsUpdates: false,
  whatsappUpdates: false, pushUpdates: true, contactLanguage: "English",
};

export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 font-medium text-slate-700">{value}</p>
    </div>
  );
}

const editInputClass = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[var(--sd-ink)]";

function EditField({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={editInputClass} />
    </label>
  );
}

function EditSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={editInputClass}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

/** Small header-row button that starts editing a section — only rendered when the caller passes
 * `editable` (counsellor views of a student's profile), never on the student's own read view. */
function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
    >
      <Pencil size={11} /> Edit
    </button>
  );
}

function SaveCancelRow({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <button onClick={onSave} className="rounded-lg bg-[image:var(--sd-gradient)] px-3 py-1.5 text-xs font-semibold text-white">Save</button>
      <button onClick={onCancel} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
        <X size={12} /> Cancel
      </button>
    </div>
  );
}

/** Every field a student submitted while filling in their profile, grouped by onboarding step —
 * the same view for a counsellor's full applicant, a counsellor's lead, and an agent's student,
 * since it's driven entirely by real stored data rather than role-specific state. Pass `editable`
 * to let a counsellor fill in or correct a student's answers on their behalf — every save goes
 * through the same store functions the student's own onboarding forms use, keyed to `studentId`. */
export function ProfileStepsPanel({ studentId, editable = false }: { studentId: string; editable?: boolean }) {
  const [, forceTick] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [personalDraft, setPersonalDraft] = useState<PersonalInfoDetails | null>(null);
  const [academicDraft, setAcademicDraft] = useState<AcademicLevelEntry[] | null>(null);
  const [englishDraft, setEnglishDraft] = useState<EnglishTestDetails[] | null>(null);
  const [workDraft, setWorkDraft] = useState<WorkExperienceDetails[] | null>(null);
  const [preferencesDraft, setPreferencesDraft] = useState<PreferencesDetails | null>(null);

  const completion = getProfileCompletion(studentId);
  const personalInfo = loadPersonalInfo(studentId);
  const academicLevels = loadAcademicLevels(studentId);
  const englishTests = loadEnglishTests(studentId);
  const workExperience = loadWorkExperience(studentId);
  const preferences = loadPreferences(studentId);

  function cancelEdit() {
    setEditingKey(null);
    setPersonalDraft(null);
    setAcademicDraft(null);
    setEnglishDraft(null);
    setWorkDraft(null);
    setPreferencesDraft(null);
  }

  function savePersonal() {
    if (!personalDraft) return;
    savePersonalInfo(personalDraft, studentId);
    markStepComplete("personal-information", studentId);
    cancelEdit();
    forceTick((t) => t + 1);
  }

  function saveAcademic() {
    if (!academicDraft) return;
    saveAcademicLevels(academicDraft, studentId);
    if (academicDraft.length > 0) markStepComplete("academic-details", studentId);
    cancelEdit();
    forceTick((t) => t + 1);
  }

  function saveEnglish() {
    if (!englishDraft) return;
    saveEnglishTests(englishDraft, studentId);
    if (englishDraft.length > 0) markStepComplete("english-proficiency", studentId);
    cancelEdit();
    forceTick((t) => t + 1);
  }

  function saveWork() {
    if (!workDraft) return;
    saveWorkExperience(workDraft, studentId);
    if (workDraft.length > 0) markStepComplete("work-experience", studentId);
    cancelEdit();
    forceTick((t) => t + 1);
  }

  function savePrefs() {
    if (!preferencesDraft) return;
    savePreferences(preferencesDraft, studentId);
    markStepComplete("preferences", studentId);
    cancelEdit();
    forceTick((t) => t + 1);
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <p className="text-sm font-semibold text-slate-800">Profile</p>
        <span className="text-xs font-medium text-slate-400">{completion.percent}% complete</span>
      </div>
      <div className="divide-y divide-slate-50">
        {completion.steps.map((s) => {
          const Icon = STEP_ICON[s.key] ?? User;
          const editingThis = editingKey === s.key;
          return (
            <div key={s.key} className="px-5 py-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.complete ? "bg-[#E1F5F0] text-[#0F8A78]" : "bg-slate-100 text-slate-400"}`}>
                  <Icon size={14} />
                </div>
                <p className="flex-1 text-sm text-slate-700">{s.label}</p>
                {s.complete ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <Check size={12} /> Complete
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">{s.required ? "Required · pending" : "Not started"}</span>
                )}
                {editable && !editingThis && (
                  <EditButton
                    onClick={() => {
                      if (s.key === "personal-information") setPersonalDraft(personalInfo ?? { ...EMPTY_PERSONAL });
                      if (s.key === "academic-details") setAcademicDraft(academicLevels.length > 0 ? [...academicLevels] : [{ ...EMPTY_ACADEMIC_ENTRY }]);
                      if (s.key === "english-proficiency") setEnglishDraft(englishTests.length > 0 ? [...englishTests] : [{ ...EMPTY_ENGLISH_ENTRY }]);
                      if (s.key === "work-experience") setWorkDraft(workExperience.length > 0 ? [...workExperience] : [{ ...EMPTY_WORK_ENTRY }]);
                      if (s.key === "preferences") setPreferencesDraft(preferences ?? { ...EMPTY_PREFERENCES });
                      setEditingKey(s.key);
                    }}
                  />
                )}
              </div>

              {s.key === "personal-information" && (
                editingThis && personalDraft ? (
                  <div className="ml-11 mt-2.5 space-y-3">
                    <PersonalInfoForm draft={personalDraft} onChange={setPersonalDraft} />
                    <SaveCancelRow onSave={savePersonal} onCancel={cancelEdit} />
                  </div>
                ) : personalInfo ? (
                  <div className="ml-11 mt-2.5 space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
                      <Detail label="First name" value={personalInfo.firstName} />
                      <Detail label="Last name" value={personalInfo.lastName} />
                      <Detail label="Email" value={personalInfo.email} />
                      <Detail label="Phone" value={personalInfo.phone} />
                      <Detail label="Date of birth" value={personalInfo.dob} />
                      <Detail label="Gender" value={personalInfo.gender} />
                      <Detail label="Nationality" value={personalInfo.nationality} />
                      <Detail label="Marital status" value={personalInfo.maritalStatus} />
                      <Detail label="Place of birth" value={personalInfo.placeOfBirth} />
                      <Detail label="Father's name" value={personalInfo.fatherName} />
                      <Detail label="Mother's name" value={personalInfo.motherName} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
                      <Detail label="Passport number" value={personalInfo.passportNumber} />
                      <Detail label="Personal number" value={personalInfo.personalNumber} />
                      <Detail label="Previous passport no." value={personalInfo.previousPassportNumber || "—"} />
                      <Detail label="Issuing authority" value={personalInfo.issuingAuthority} />
                      <Detail label="Issue date" value={personalInfo.issueDate} />
                      <Detail label="Expiry date" value={personalInfo.passportExpiry} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
                      <Detail label="Permanent address" value={personalInfo.permanentAddress} />
                      <Detail label="Present address" value={personalInfo.presentAddress} />
                      <Detail label="City" value={personalInfo.city} />
                      <Detail label="Country" value={personalInfo.country} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
                      <Detail label="Emergency contact" value={personalInfo.emergencyContactName} />
                      <Detail label="Relationship" value={personalInfo.emergencyContactRelationship} />
                      <Detail label="Contact phone" value={personalInfo.emergencyContactPhone} />
                      <Detail label="Contact email" value={personalInfo.emergencyContactEmail || "—"} />
                      <Detail label="Contact address" value={personalInfo.emergencyContactAddress} />
                    </div>
                  </div>
                ) : (
                  <p className="ml-11 mt-1.5 text-xs text-slate-400">Not yet submitted.</p>
                )
              )}

              {s.key === "academic-details" && (
                editingThis && academicDraft ? (
                  <div className="ml-11 mt-2.5 space-y-2">
                    {academicDraft.map((lvl, i) => (
                      <div key={i} className="relative rounded-xl bg-slate-50 p-3">
                        {academicDraft.length > 1 && (
                          <button
                            onClick={() => setAcademicDraft(academicDraft.filter((_, idx) => idx !== i))}
                            className="absolute right-2 top-2 text-slate-300 hover:text-rose-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pr-6 text-xs sm:grid-cols-3">
                          <EditSelect label="Level" value={lvl.level} options={ACADEMIC_LEVELS} onChange={(v) => setAcademicDraft(academicDraft.map((e, idx) => idx === i ? { ...e, level: v } : e))} />
                          <EditField label="Institution" value={lvl.institution} onChange={(v) => setAcademicDraft(academicDraft.map((e, idx) => idx === i ? { ...e, institution: v } : e))} />
                          <EditField label="Board" value={lvl.board ?? ""} onChange={(v) => setAcademicDraft(academicDraft.map((e, idx) => idx === i ? { ...e, board: v } : e))} />
                          <EditField label="Group" value={lvl.group ?? ""} onChange={(v) => setAcademicDraft(academicDraft.map((e, idx) => idx === i ? { ...e, group: v } : e))} />
                          <EditField label="Major" value={lvl.major ?? ""} onChange={(v) => setAcademicDraft(academicDraft.map((e, idx) => idx === i ? { ...e, major: v } : e))} />
                          <EditField label="Grade" value={lvl.grade ?? ""} onChange={(v) => setAcademicDraft(academicDraft.map((e, idx) => idx === i ? { ...e, grade: v } : e))} />
                          <EditField label="Passing year" value={lvl.passingYear ?? ""} onChange={(v) => setAcademicDraft(academicDraft.map((e, idx) => idx === i ? { ...e, passingYear: v } : e))} />
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => setAcademicDraft([...academicDraft, { ...EMPTY_ACADEMIC_ENTRY }])}
                      className="flex items-center gap-1 text-xs font-medium text-[#2955C4]"
                    >
                      <Plus size={13} /> Add level
                    </button>
                    <SaveCancelRow onSave={saveAcademic} onCancel={cancelEdit} />
                  </div>
                ) : academicLevels.length > 0 ? (
                  <div className="ml-11 mt-2.5 space-y-1.5">
                    {academicLevels.map((lvl) => (
                      <div key={lvl.level} className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
                        <Detail label="Level" value={lvl.level} />
                        <Detail label="Institution" value={lvl.institution} />
                        <Detail label="Board" value={lvl.board || "—"} />
                        <Detail label="Group" value={lvl.group || "—"} />
                        <Detail label="Major" value={lvl.major || "—"} />
                        <Detail label="Grade" value={lvl.grade || "—"} />
                        <Detail label="Passing year" value={lvl.passingYear || "—"} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ml-11 mt-1.5 text-xs text-slate-400">No education history recorded yet.</p>
                )
              )}

              {s.key === "english-proficiency" && (
                editingThis && englishDraft ? (
                  <div className="ml-11 mt-2.5 space-y-2">
                    {englishDraft.map((t, i) => (
                      <div key={i} className="relative rounded-xl bg-slate-50 p-3">
                        {englishDraft.length > 1 && (
                          <button
                            onClick={() => setEnglishDraft(englishDraft.filter((_, idx) => idx !== i))}
                            className="absolute right-2 top-2 text-slate-300 hover:text-rose-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pr-6 text-xs sm:grid-cols-4">
                          <EditField label="Test" value={t.testName} onChange={(v) => setEnglishDraft(englishDraft.map((e, idx) => idx === i ? { ...e, testName: v } : e))} />
                          <EditField label="Test type" value={t.testType} onChange={(v) => setEnglishDraft(englishDraft.map((e, idx) => idx === i ? { ...e, testType: v } : e))} />
                          <EditField label="Overall score" value={t.overallScore} onChange={(v) => setEnglishDraft(englishDraft.map((e, idx) => idx === i ? { ...e, overallScore: v } : e))} />
                          <EditField label="Listening" value={t.listening} onChange={(v) => setEnglishDraft(englishDraft.map((e, idx) => idx === i ? { ...e, listening: v } : e))} />
                          <EditField label="Reading" value={t.reading} onChange={(v) => setEnglishDraft(englishDraft.map((e, idx) => idx === i ? { ...e, reading: v } : e))} />
                          <EditField label="Writing" value={t.writing} onChange={(v) => setEnglishDraft(englishDraft.map((e, idx) => idx === i ? { ...e, writing: v } : e))} />
                          <EditField label="Speaking" value={t.speaking} onChange={(v) => setEnglishDraft(englishDraft.map((e, idx) => idx === i ? { ...e, speaking: v } : e))} />
                          <EditField label="Test date" type="date" value={t.testDate} onChange={(v) => setEnglishDraft(englishDraft.map((e, idx) => idx === i ? { ...e, testDate: v } : e))} />
                          <EditField label="Expiry" type="date" value={t.expiryDate} onChange={(v) => setEnglishDraft(englishDraft.map((e, idx) => idx === i ? { ...e, expiryDate: v } : e))} />
                          <EditField label="Report number" value={t.reportNumber} onChange={(v) => setEnglishDraft(englishDraft.map((e, idx) => idx === i ? { ...e, reportNumber: v } : e))} />
                          <EditField label="Issuing institution" value={t.issuingInstitution} onChange={(v) => setEnglishDraft(englishDraft.map((e, idx) => idx === i ? { ...e, issuingInstitution: v } : e))} />
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => setEnglishDraft([...englishDraft, { ...EMPTY_ENGLISH_ENTRY }])}
                      className="flex items-center gap-1 text-xs font-medium text-[#2955C4]"
                    >
                      <Plus size={13} /> Add test
                    </button>
                    <SaveCancelRow onSave={saveEnglish} onCancel={cancelEdit} />
                  </div>
                ) : englishTests.length > 0 ? (
                  <div className="ml-11 mt-2.5 space-y-1.5">
                    {englishTests.map((t, i) => (
                      <div key={`${t.testName}-${i}`} className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4">
                        <Detail label="Test" value={t.testName} />
                        <Detail label="Test type" value={t.testType || "—"} />
                        <Detail label="Overall score" value={t.overallScore} />
                        <Detail label="Listening" value={t.listening || "—"} />
                        <Detail label="Reading" value={t.reading || "—"} />
                        <Detail label="Writing" value={t.writing || "—"} />
                        <Detail label="Speaking" value={t.speaking || "—"} />
                        <Detail label="Test date" value={t.testDate} />
                        <Detail label="Expiry" value={t.expiryDate || "No expiry"} />
                        <Detail label="Report number" value={t.reportNumber || "—"} />
                        <Detail label="Issuing institution" value={t.issuingInstitution || "—"} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ml-11 mt-1.5 text-xs text-slate-400">Not yet submitted.</p>
                )
              )}

              {s.key === "work-experience" && (
                editingThis && workDraft ? (
                  <div className="ml-11 mt-2.5 space-y-2">
                    {workDraft.map((w, i) => (
                      <div key={i} className="relative rounded-xl bg-slate-50 p-3">
                        {workDraft.length > 1 && (
                          <button
                            onClick={() => setWorkDraft(workDraft.filter((_, idx) => idx !== i))}
                            className="absolute right-2 top-2 text-slate-300 hover:text-rose-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pr-6 text-xs sm:grid-cols-4">
                          <EditSelect label="Type" value={w.type} options={WORK_TYPES} onChange={(v) => setWorkDraft(workDraft.map((e, idx) => idx === i ? { ...e, type: v } : e))} />
                          <EditField label="Company" value={w.company} onChange={(v) => setWorkDraft(workDraft.map((e, idx) => idx === i ? { ...e, company: v } : e))} />
                          <EditField label="Title" value={w.title} onChange={(v) => setWorkDraft(workDraft.map((e, idx) => idx === i ? { ...e, title: v } : e))} />
                          <EditField label="Industry" value={w.industry} onChange={(v) => setWorkDraft(workDraft.map((e, idx) => idx === i ? { ...e, industry: v } : e))} />
                          <EditField label="Start date" type="date" value={w.startDate} onChange={(v) => setWorkDraft(workDraft.map((e, idx) => idx === i ? { ...e, startDate: v } : e))} />
                          <EditField
                            label="End date"
                            type="date"
                            value={w.endDate}
                            placeholder={w.currentlyWorking ? "Present" : undefined}
                            onChange={(v) => setWorkDraft(workDraft.map((e, idx) => idx === i ? { ...e, endDate: v } : e))}
                          />
                        </div>
                        <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={w.currentlyWorking}
                            onChange={(e) => setWorkDraft(workDraft.map((entry, idx) => idx === i ? { ...entry, currentlyWorking: e.target.checked } : entry))}
                            className="h-3.5 w-3.5 accent-[var(--sd-ink)]"
                          />
                          Currently working here
                        </label>
                        <textarea
                          value={w.description}
                          onChange={(e) => setWorkDraft(workDraft.map((entry, idx) => idx === i ? { ...entry, description: e.target.value } : entry))}
                          placeholder="What did they do in this role?"
                          rows={2}
                          className={`${editInputClass} mt-2 resize-none`}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => setWorkDraft([...workDraft, { ...EMPTY_WORK_ENTRY }])}
                      className="flex items-center gap-1 text-xs font-medium text-[#2955C4]"
                    >
                      <Plus size={13} /> Add experience
                    </button>
                    <SaveCancelRow onSave={saveWork} onCancel={cancelEdit} />
                  </div>
                ) : workExperience.length > 0 ? (
                  <div className="ml-11 mt-2.5 space-y-1.5">
                    {workExperience.map((w, i) => (
                      <div key={`${w.company}-${i}`} className="rounded-xl bg-slate-50 p-3 text-xs">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                          <Detail label="Type" value={w.type} />
                          <Detail label="Company" value={w.company} />
                          <Detail label="Title" value={w.title} />
                          <Detail label="Industry" value={w.industry} />
                          <Detail label="Start date" value={w.startDate} />
                          <Detail label="End date" value={w.currentlyWorking ? "Present" : w.endDate || "—"} />
                        </div>
                        {w.description && <p className="mt-2 text-slate-500">{w.description}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ml-11 mt-1.5 text-xs text-slate-400">Not yet submitted.</p>
                )
              )}

              {s.key === "preferences" && (
                editingThis && preferencesDraft ? (
                  <div className="ml-11 mt-2.5 space-y-3 rounded-xl bg-slate-50 p-3">
                    <div>
                      <p className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-400">Destinations</p>
                      <ChipRow>
                        {DESTINATIONS.map((d) => (
                          <Chip
                            key={d}
                            label={d}
                            selected={preferencesDraft.destinations.includes(d)}
                            onClick={() => setPreferencesDraft({
                              ...preferencesDraft,
                              destinations: preferencesDraft.destinations.includes(d)
                                ? preferencesDraft.destinations.filter((x) => x !== d)
                                : [...preferencesDraft.destinations, d],
                            })}
                          />
                        ))}
                      </ChipRow>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-400">Fields of interest</p>
                      <ChipRow>
                        {[...getAllSubjects(), "Other"].map((f) => (
                          <Chip
                            key={f}
                            label={f}
                            selected={preferencesDraft.fields.includes(f)}
                            onClick={() => setPreferencesDraft({
                              ...preferencesDraft,
                              fields: preferencesDraft.fields.includes(f)
                                ? preferencesDraft.fields.filter((x) => x !== f)
                                : [...preferencesDraft.fields, f],
                            })}
                          />
                        ))}
                      </ChipRow>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <EditSelect label="Study level" value={preferencesDraft.studyLevel} options={STUDY_LEVELS} onChange={(v) => setPreferencesDraft({ ...preferencesDraft, studyLevel: v })} />
                      <EditSelect label="Intake" value={preferencesDraft.intake} options={INTAKES} onChange={(v) => setPreferencesDraft({ ...preferencesDraft, intake: v })} />
                      <EditSelect label="Budget" value={preferencesDraft.budget} options={BUDGETS} onChange={(v) => setPreferencesDraft({ ...preferencesDraft, budget: v })} />
                      <EditSelect label="Accommodation" value={preferencesDraft.accommodation} options={ACCOMMODATIONS} onChange={(v) => setPreferencesDraft({ ...preferencesDraft, accommodation: v })} />
                      <EditSelect label="Contact language" value={preferencesDraft.contactLanguage} options={LANGUAGES} onChange={(v) => setPreferencesDraft({ ...preferencesDraft, contactLanguage: v })} />
                    </div>
                    <div className="space-y-1 pt-1">
                      <Toggle label="Scholarship interest" checked={preferencesDraft.scholarshipInterest} onChange={(v) => setPreferencesDraft({ ...preferencesDraft, scholarshipInterest: v })} />
                      <Toggle label="Email updates" checked={preferencesDraft.emailUpdates} onChange={(v) => setPreferencesDraft({ ...preferencesDraft, emailUpdates: v })} />
                      <Toggle label="SMS updates" checked={preferencesDraft.smsUpdates} onChange={(v) => setPreferencesDraft({ ...preferencesDraft, smsUpdates: v })} />
                      <Toggle label="WhatsApp updates" checked={preferencesDraft.whatsappUpdates} onChange={(v) => setPreferencesDraft({ ...preferencesDraft, whatsappUpdates: v })} />
                      <Toggle label="Push updates" checked={preferencesDraft.pushUpdates} onChange={(v) => setPreferencesDraft({ ...preferencesDraft, pushUpdates: v })} />
                    </div>
                    <SaveCancelRow onSave={savePrefs} onCancel={cancelEdit} />
                  </div>
                ) : preferences ? (
                  <div className="ml-11 mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4">
                    <Detail label="Study level" value={preferences.studyLevel} />
                    <Detail label="Intake" value={preferences.intake} />
                    <Detail label="Budget" value={preferences.budget} />
                    <Detail label="Accommodation" value={preferences.accommodation} />
                    <Detail label="Destinations" value={preferences.destinations.join(", ")} />
                    <Detail label="Fields of interest" value={preferences.fields.join(", ")} />
                    <Detail label="Scholarship interest" value={preferences.scholarshipInterest ? "Yes" : "No"} />
                    <Detail label="Contact language" value={preferences.contactLanguage} />
                    <Detail
                      label="Notification channels"
                      value={[
                        preferences.emailUpdates && "Email",
                        preferences.smsUpdates && "SMS",
                        preferences.whatsappUpdates && "WhatsApp",
                        preferences.pushUpdates && "Push",
                      ].filter(Boolean).join(", ") || "None"}
                    />
                  </div>
                ) : (
                  <p className="ml-11 mt-1.5 text-xs text-slate-400">Not yet submitted.</p>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PersonalInfoForm({ draft, onChange }: { draft: PersonalInfoDetails; onChange: (v: PersonalInfoDetails) => void }) {
  function set<K extends keyof PersonalInfoDetails>(key: K, value: PersonalInfoDetails[K]) {
    onChange({ ...draft, [key]: value });
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
        <EditField label="First name" value={draft.firstName} onChange={(v) => set("firstName", v)} />
        <EditField label="Last name" value={draft.lastName} onChange={(v) => set("lastName", v)} />
        <EditField label="Email" type="email" value={draft.email} onChange={(v) => set("email", v)} />
        <EditField label="Phone" value={draft.phone} onChange={(v) => set("phone", v)} />
        <EditField label="Date of birth" type="date" value={draft.dob} onChange={(v) => set("dob", v)} />
        <EditSelect label="Gender" value={draft.gender} options={GENDERS} onChange={(v) => set("gender", v)} />
        <EditField label="Nationality" value={draft.nationality} onChange={(v) => set("nationality", v)} />
        <EditSelect label="Marital status" value={draft.maritalStatus} options={MARITAL_STATUSES} onChange={(v) => set("maritalStatus", v)} />
        <EditField label="Place of birth" value={draft.placeOfBirth} onChange={(v) => set("placeOfBirth", v)} />
        <EditField label="Father's name" value={draft.fatherName} onChange={(v) => set("fatherName", v)} />
        <EditField label="Mother's name" value={draft.motherName} onChange={(v) => set("motherName", v)} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
        <EditField label="Passport number" value={draft.passportNumber} onChange={(v) => set("passportNumber", v)} />
        <EditField label="Personal number" value={draft.personalNumber} onChange={(v) => set("personalNumber", v)} />
        <EditField label="Previous passport no." value={draft.previousPassportNumber} onChange={(v) => set("previousPassportNumber", v)} />
        <EditField label="Issuing authority" value={draft.issuingAuthority} onChange={(v) => set("issuingAuthority", v)} />
        <EditField label="Issue date" type="date" value={draft.issueDate} onChange={(v) => set("issueDate", v)} />
        <EditField label="Expiry date" type="date" value={draft.passportExpiry} onChange={(v) => set("passportExpiry", v)} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
        <EditField label="Permanent address" value={draft.permanentAddress} onChange={(v) => set("permanentAddress", v)} />
        <EditField label="Present address" value={draft.presentAddress} onChange={(v) => set("presentAddress", v)} />
        <EditField label="City" value={draft.city} onChange={(v) => set("city", v)} />
        <EditField label="Country" value={draft.country} onChange={(v) => set("country", v)} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
        <EditField label="Emergency contact" value={draft.emergencyContactName} onChange={(v) => set("emergencyContactName", v)} />
        <EditField label="Relationship" value={draft.emergencyContactRelationship} onChange={(v) => set("emergencyContactRelationship", v)} />
        <EditField label="Contact phone" value={draft.emergencyContactPhone} onChange={(v) => set("emergencyContactPhone", v)} />
        <EditField label="Contact email" type="email" value={draft.emergencyContactEmail} onChange={(v) => set("emergencyContactEmail", v)} />
        <EditField label="Contact address" value={draft.emergencyContactAddress} onChange={(v) => set("emergencyContactAddress", v)} />
      </div>
    </>
  );
}
