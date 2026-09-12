import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Check, Plus, X, User, GraduationCap, Languages, Briefcase,
  SlidersHorizontal, PartyPopper, Copy, Mail,
} from "lucide-react";
import { Button } from "../../components/ui";
import { DocumentUpload, type ScanStatus, type UploadedDoc } from "../../components/ui/mobile";
import { addAgentStudent } from "../../data/agentStudentsStore";
import {
  savePersonalInfo, saveEnglishTests, saveWorkExperience, savePreferences,
  type PersonalInfoDetails, type EnglishTestDetails, type WorkExperienceDetails, type PreferencesDetails,
} from "../../data/studentProfileDetailsStore";
import { saveAcademicLevels, type AcademicLevelEntry } from "../../data/academicProfileStore";
import { markStepComplete } from "../../data/profileCompletion";
import { destinationOptions, subjectOptions } from "../../utils/universityFilter";
import { scanPassport, scanAcademicCertificate, scanEnglishTestReport, scanExperienceLetter } from "../../utils/documentScanSimulator";

const STEPS = [
  { key: "personal", label: "Personal Information", icon: User },
  { key: "academic", label: "Academic Details", icon: GraduationCap },
  { key: "english", label: "English Proficiency", icon: Languages },
  { key: "work", label: "Work Experience", icon: Briefcase },
  { key: "preferences", label: "Preferences", icon: SlidersHorizontal },
] as const;

const EMPTY_PERSONAL: PersonalInfoDetails = {
  firstName: "", lastName: "", email: "", phone: "", dob: "", gender: "", nationality: "",
  fatherName: "", motherName: "", maritalStatus: "", passportNumber: "", personalNumber: "",
  previousPassportNumber: "", placeOfBirth: "", issuingAuthority: "", issueDate: "", passportExpiry: "",
  permanentAddress: "", presentAddress: "", city: "", country: "", emergencyContactName: "",
  emergencyContactRelationship: "", emergencyContactAddress: "", emergencyContactPhone: "", emergencyContactEmail: "",
};

const EMPTY_ENGLISH: EnglishTestDetails = {
  testName: "", testType: "", overallScore: "", listening: "", reading: "", writing: "", speaking: "",
  testDate: "", expiryDate: "", reportNumber: "", issuingInstitution: "",
};

const EMPTY_WORK: WorkExperienceDetails = {
  type: "", company: "", title: "", industry: "", startDate: "", endDate: "", currentlyWorking: false, description: "",
};

const EMPTY_ACADEMIC: AcademicLevelEntry = { level: "", institution: "", board: "", group: "", major: "", grade: "", passingYear: "" };

const EMPTY_PREFERENCES: PreferencesDetails = {
  destinations: [], studyLevel: "", fields: [], intake: "", budget: "", accommodation: "",
  scholarshipInterest: false, emailUpdates: true, smsUpdates: false, whatsappUpdates: false, pushUpdates: false, contactLanguage: "",
};

export default function CreateStudentProfile() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [personal, setPersonal] = useState<PersonalInfoDetails>(EMPTY_PERSONAL);
  const [academicLevels, setAcademicLevels] = useState<AcademicLevelEntry[]>([]);
  const [englishTests, setEnglishTests] = useState<EnglishTestDetails[]>([]);
  const [workExperience, setWorkExperience] = useState<WorkExperienceDetails[]>([]);
  const [preferences, setPreferences] = useState<PreferencesDetails>(EMPTY_PREFERENCES);
  const [createdStudent, setCreatedStudent] = useState<{ id: string; name: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [passportFile, setPassportFile] = useState<UploadedDoc | null>(null);
  const [passportScanStatus, setPassportScanStatus] = useState<ScanStatus>("idle");
  const [autoFilledPersonal, setAutoFilledPersonal] = useState<Set<keyof PersonalInfoDetails>>(new Set());

  const canProceedPersonal = personal.firstName.trim().length > 1 && /\S+@\S+\.\S+/.test(personal.email) && personal.country.trim().length > 1;
  const step = STEPS[stepIndex];

  function updatePersonal<K extends keyof PersonalInfoDetails>(key: K, value: PersonalInfoDetails[K]) {
    setPersonal((p) => ({ ...p, [key]: value }));
    setAutoFilledPersonal((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function handlePassportUpload(file: File) {
    const isImage = file.type.startsWith("image/");
    setPassportFile({ name: file.name, previewUrl: isImage ? URL.createObjectURL(file) : undefined });
    setPassportScanStatus("scanning");
    window.setTimeout(() => {
      setPersonal((p) => {
        const filled = scanPassport(p);
        setAutoFilledPersonal(new Set(Object.keys(filled) as (keyof PersonalInfoDetails)[]));
        return { ...p, ...filled };
      });
      setPassportScanStatus("done");
    }, 1200);
  }

  function createProfile() {
    const name = `${personal.firstName.trim()} ${personal.lastName.trim()}`.trim();
    const student = addAgentStudent(name, personal.email.trim(), personal.country.trim());

    savePersonalInfo(personal, student.id);
    markStepComplete("personal-information", student.id);

    if (academicLevels.length > 0) {
      saveAcademicLevels(academicLevels, student.id);
      markStepComplete("academic-details", student.id);
    }
    if (englishTests.length > 0) {
      saveEnglishTests(englishTests, student.id);
      markStepComplete("english-proficiency", student.id);
    }
    if (workExperience.length > 0) {
      saveWorkExperience(workExperience, student.id);
      markStepComplete("work-experience", student.id);
    }
    if (preferences.destinations.length > 0 || preferences.fields.length > 0 || preferences.studyLevel || preferences.intake) {
      savePreferences(preferences, student.id);
      markStepComplete("preferences", student.id);
    }

    setCreatedStudent({ id: student.id, name, email: personal.email.trim() });
  }

  if (createdStudent) {
    const inviteMessage = [
      "Subject: Your study abroad portal is ready",
      "",
      `Hi ${createdStudent.name.split(" ")[0]},`,
      "",
      "Your student profile has been created. Sign in to the student portal to review your details, track your applications, and upload documents:",
      `${window.location.origin}/student`,
      "",
      "Talk soon,",
    ].join("\n");

    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-[0_0_10px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <PartyPopper size={22} />
          </div>
          <h1 className="mt-3 text-base font-semibold text-slate-900">Profile created for {createdStudent.name}</h1>
          <p className="mt-1 text-xs text-slate-500">Share portal access so they can sign in and see their own profile, documents, and applications.</p>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4 text-left">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Mail size={12} /> Invite message
            </p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-slate-700">{inviteMessage}</pre>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => {
                navigator.clipboard.writeText(inviteMessage).catch(() => {});
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
              className="flex-1 justify-center"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied!" : "Copy invite message"}
            </Button>
            <button
              onClick={() => navigate(`/agent/students/${createdStudent.id}`)}
              className="flex-1 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Go to profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => navigate("/agent/students")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-blue-600">
        <ArrowLeft size={14} /> Back to Students
      </button>

      <div className="mb-5">
        <h1 className="text-base font-semibold text-slate-900">Create Student Profile</h1>
        <p className="mt-1 text-xs text-slate-500">Fill this in the same way a student would themselves — every field carries over to their own account.</p>
      </div>

      <div className="mb-5 flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => (i === 0 || canProceedPersonal) && setStepIndex(i)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
              i === stepIndex ? "bg-blue-50 text-blue-700" : i < stepIndex ? "text-emerald-600" : "text-slate-400"
            }`}
          >
            {i < stepIndex ? <Check size={13} /> : <s.icon size={13} />}
            {s.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        {step.key === "personal" && (
          <div className="space-y-4">
            <DocumentUpload
              file={passportFile}
              status={passportScanStatus}
              title="Upload passport"
              description="We'll scan it and auto-fill passport details, address, and place of birth below — name, email, and country stay exactly as you've entered them."
              scanningLabel="Scanning passport…"
              onPick={() => pickFile(handlePassportUpload)}
              onRemove={() => { setPassportFile(null); setPassportScanStatus("idle"); }}
            />

            <FieldGrid>
              <Field label="First name*"><Input value={personal.firstName} onChange={(v) => updatePersonal("firstName", v)} /></Field>
              <Field label="Last name"><Input value={personal.lastName} onChange={(v) => updatePersonal("lastName", v)} /></Field>
              <Field label="Email*"><Input value={personal.email} onChange={(v) => updatePersonal("email", v)} placeholder="name@example.com" /></Field>
              <Field label="Phone"><Input value={personal.phone} onChange={(v) => updatePersonal("phone", v)} /></Field>
              <Field label="Date of birth" autoFilled={autoFilledPersonal.has("dob")}><Input type="date" value={personal.dob} onChange={(v) => updatePersonal("dob", v)} /></Field>
              <Field label="Gender"><Input value={personal.gender} onChange={(v) => updatePersonal("gender", v)} /></Field>
              <Field label="Nationality" autoFilled={autoFilledPersonal.has("nationality")}><Input value={personal.nationality} onChange={(v) => updatePersonal("nationality", v)} /></Field>
              <Field label="Marital status"><Input value={personal.maritalStatus} onChange={(v) => updatePersonal("maritalStatus", v)} /></Field>
              <Field label="Father's name"><Input value={personal.fatherName} onChange={(v) => updatePersonal("fatherName", v)} /></Field>
              <Field label="Mother's name"><Input value={personal.motherName} onChange={(v) => updatePersonal("motherName", v)} /></Field>
            </FieldGrid>

            <SectionLabel>Passport</SectionLabel>
            <FieldGrid>
              <Field label="Passport number" autoFilled={autoFilledPersonal.has("passportNumber")}><Input value={personal.passportNumber} onChange={(v) => updatePersonal("passportNumber", v)} /></Field>
              <Field label="Personal number" autoFilled={autoFilledPersonal.has("personalNumber")}><Input value={personal.personalNumber} onChange={(v) => updatePersonal("personalNumber", v)} /></Field>
              <Field label="Previous passport no."><Input value={personal.previousPassportNumber} onChange={(v) => updatePersonal("previousPassportNumber", v)} /></Field>
              <Field label="Place of birth" autoFilled={autoFilledPersonal.has("placeOfBirth")}><Input value={personal.placeOfBirth} onChange={(v) => updatePersonal("placeOfBirth", v)} /></Field>
              <Field label="Issuing authority" autoFilled={autoFilledPersonal.has("issuingAuthority")}><Input value={personal.issuingAuthority} onChange={(v) => updatePersonal("issuingAuthority", v)} /></Field>
              <Field label="Issue date" autoFilled={autoFilledPersonal.has("issueDate")}><Input type="date" value={personal.issueDate} onChange={(v) => updatePersonal("issueDate", v)} /></Field>
              <Field label="Expiry date" autoFilled={autoFilledPersonal.has("passportExpiry")}><Input type="date" value={personal.passportExpiry} onChange={(v) => updatePersonal("passportExpiry", v)} /></Field>
            </FieldGrid>

            <SectionLabel>Address</SectionLabel>
            <FieldGrid>
              <Field label="Permanent address" autoFilled={autoFilledPersonal.has("permanentAddress")}><Input value={personal.permanentAddress} onChange={(v) => updatePersonal("permanentAddress", v)} /></Field>
              <Field label="Present address"><Input value={personal.presentAddress} onChange={(v) => updatePersonal("presentAddress", v)} /></Field>
              <Field label="City" autoFilled={autoFilledPersonal.has("city")}><Input value={personal.city} onChange={(v) => updatePersonal("city", v)} /></Field>
              <Field label="Country*"><Input value={personal.country} onChange={(v) => updatePersonal("country", v)} placeholder="e.g. Bangladesh" /></Field>
            </FieldGrid>

            <SectionLabel>Emergency contact</SectionLabel>
            <FieldGrid>
              <Field label="Name"><Input value={personal.emergencyContactName} onChange={(v) => updatePersonal("emergencyContactName", v)} /></Field>
              <Field label="Relationship"><Input value={personal.emergencyContactRelationship} onChange={(v) => updatePersonal("emergencyContactRelationship", v)} /></Field>
              <Field label="Phone"><Input value={personal.emergencyContactPhone} onChange={(v) => updatePersonal("emergencyContactPhone", v)} /></Field>
              <Field label="Email"><Input value={personal.emergencyContactEmail} onChange={(v) => updatePersonal("emergencyContactEmail", v)} /></Field>
              <Field label="Address"><Input value={personal.emergencyContactAddress} onChange={(v) => updatePersonal("emergencyContactAddress", v)} /></Field>
            </FieldGrid>
          </div>
        )}

        {step.key === "academic" && (
          <RepeatableSection
            items={academicLevels}
            empty={EMPTY_ACADEMIC}
            onChange={setAcademicLevels}
            addLabel="Add education level"
            renderUpload={(item, update) => <AcademicScanUpload item={item} update={update} />}
            renderItem={(item, update) => (
              <FieldGrid>
                <Field label="Level"><Input value={item.level} onChange={(v) => update({ ...item, level: v })} placeholder="e.g. Bachelor's" /></Field>
                <Field label="Institution"><Input value={item.institution} onChange={(v) => update({ ...item, institution: v })} /></Field>
                <Field label="Board"><Input value={item.board ?? ""} onChange={(v) => update({ ...item, board: v })} /></Field>
                <Field label="Group"><Input value={item.group ?? ""} onChange={(v) => update({ ...item, group: v })} /></Field>
                <Field label="Major"><Input value={item.major ?? ""} onChange={(v) => update({ ...item, major: v })} /></Field>
                <Field label="Grade"><Input value={item.grade ?? ""} onChange={(v) => update({ ...item, grade: v })} /></Field>
                <Field label="Passing year"><Input value={item.passingYear ?? ""} onChange={(v) => update({ ...item, passingYear: v })} /></Field>
              </FieldGrid>
            )}
          />
        )}

        {step.key === "english" && (
          <RepeatableSection
            items={englishTests}
            empty={EMPTY_ENGLISH}
            onChange={setEnglishTests}
            addLabel="Add English test"
            renderUpload={(item, update) => <EnglishScanUpload item={item} update={update} />}
            renderItem={(item, update) => (
              <FieldGrid>
                <Field label="Test"><Input value={item.testName} onChange={(v) => update({ ...item, testName: v })} placeholder="e.g. IELTS" /></Field>
                <Field label="Test type"><Input value={item.testType} onChange={(v) => update({ ...item, testType: v })} /></Field>
                <Field label="Overall score"><Input value={item.overallScore} onChange={(v) => update({ ...item, overallScore: v })} /></Field>
                <Field label="Listening"><Input value={item.listening} onChange={(v) => update({ ...item, listening: v })} /></Field>
                <Field label="Reading"><Input value={item.reading} onChange={(v) => update({ ...item, reading: v })} /></Field>
                <Field label="Writing"><Input value={item.writing} onChange={(v) => update({ ...item, writing: v })} /></Field>
                <Field label="Speaking"><Input value={item.speaking} onChange={(v) => update({ ...item, speaking: v })} /></Field>
                <Field label="Test date"><Input type="date" value={item.testDate} onChange={(v) => update({ ...item, testDate: v })} /></Field>
                <Field label="Expiry date"><Input type="date" value={item.expiryDate} onChange={(v) => update({ ...item, expiryDate: v })} /></Field>
                <Field label="Report number"><Input value={item.reportNumber} onChange={(v) => update({ ...item, reportNumber: v })} /></Field>
                <Field label="Issuing institution"><Input value={item.issuingInstitution} onChange={(v) => update({ ...item, issuingInstitution: v })} /></Field>
              </FieldGrid>
            )}
          />
        )}

        {step.key === "work" && (
          <RepeatableSection
            items={workExperience}
            empty={EMPTY_WORK}
            onChange={setWorkExperience}
            addLabel="Add work experience"
            renderUpload={(item, update) => <WorkScanUpload item={item} update={update} />}
            renderItem={(item, update) => (
              <div className="space-y-3">
                <FieldGrid>
                  <Field label="Type"><Input value={item.type} onChange={(v) => update({ ...item, type: v })} placeholder="e.g. Full-time" /></Field>
                  <Field label="Company"><Input value={item.company} onChange={(v) => update({ ...item, company: v })} /></Field>
                  <Field label="Title"><Input value={item.title} onChange={(v) => update({ ...item, title: v })} /></Field>
                  <Field label="Industry"><Input value={item.industry} onChange={(v) => update({ ...item, industry: v })} /></Field>
                  <Field label="Start date"><Input type="date" value={item.startDate} onChange={(v) => update({ ...item, startDate: v })} /></Field>
                  <Field label="End date">
                    <Input type="date" value={item.endDate} disabled={item.currentlyWorking} onChange={(v) => update({ ...item, endDate: v })} />
                  </Field>
                </FieldGrid>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={item.currentlyWorking} onChange={(e) => update({ ...item, currentlyWorking: e.target.checked })} />
                  Currently working here
                </label>
                <Field label="Description">
                  <textarea
                    value={item.description}
                    onChange={(e) => update({ ...item, description: e.target.value })}
                    rows={2}
                    className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
                  />
                </Field>
              </div>
            )}
          />
        )}

        {step.key === "preferences" && (
          <div className="space-y-4">
            <FieldGrid>
              <Field label="Study level">
                <select value={preferences.studyLevel} onChange={(e) => setPreferences((p) => ({ ...p, studyLevel: e.target.value }))} className={SELECT_CLASS}>
                  <option value="">Select…</option>
                  <option>Bachelor's</option>
                  <option>Master's</option>
                  <option>PhD</option>
                </select>
              </Field>
              <Field label="Intake"><Input value={preferences.intake} onChange={(v) => setPreferences((p) => ({ ...p, intake: v }))} placeholder="e.g. September" /></Field>
              <Field label="Budget"><Input value={preferences.budget} onChange={(v) => setPreferences((p) => ({ ...p, budget: v }))} placeholder="e.g. £20k – £30k" /></Field>
              <Field label="Accommodation"><Input value={preferences.accommodation} onChange={(v) => setPreferences((p) => ({ ...p, accommodation: v }))} placeholder="e.g. University Halls" /></Field>
              <Field label="Contact language"><Input value={preferences.contactLanguage} onChange={(v) => setPreferences((p) => ({ ...p, contactLanguage: v }))} /></Field>
            </FieldGrid>

            <div>
              <SectionLabel>Preferred destinations</SectionLabel>
              <ChipMultiSelect
                options={destinationOptions()}
                selected={preferences.destinations}
                onChange={(v) => setPreferences((p) => ({ ...p, destinations: v }))}
              />
            </div>

            <div>
              <SectionLabel>Fields of interest</SectionLabel>
              <ChipMultiSelect
                options={subjectOptions()}
                selected={preferences.fields}
                onChange={(v) => setPreferences((p) => ({ ...p, fields: v }))}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={preferences.scholarshipInterest} onChange={(e) => setPreferences((p) => ({ ...p, scholarshipInterest: e.target.checked }))} />
              Interested in scholarships
            </label>

            <div>
              <SectionLabel>Notification channels</SectionLabel>
              <div className="flex flex-wrap gap-3">
                {([
                  ["emailUpdates", "Email"], ["smsUpdates", "SMS"], ["whatsappUpdates", "WhatsApp"], ["pushUpdates", "Push"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={preferences[key]} onChange={(e) => setPreferences((p) => ({ ...p, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          disabled={stepIndex === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 disabled:opacity-40"
        >
          <ArrowLeft size={14} /> Back
        </button>
        {stepIndex < STEPS.length - 1 ? (
          <Button
            disabled={!canProceedPersonal}
            onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
          >
            Next <ArrowRight size={14} />
          </Button>
        ) : (
          <Button disabled={!canProceedPersonal} onClick={createProfile}>
            Create Profile <Check size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}

const SELECT_CLASS = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800";

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{children}</p>;
}

function Field({ label, autoFilled, children }: { label: string; autoFilled?: boolean; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      <span className="flex flex-wrap items-center gap-1.5">
        {label}
        {autoFilled && (
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-700">Auto-filled</span>
        )}
      </span>
      {children}
    </label>
  );
}

function Input({
  value, onChange, placeholder, type = "text", disabled,
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-blue-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
}

function ChipMultiSelect({
  options, selected, onChange,
}: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(active ? selected.filter((s) => s !== o) : [...selected, o])}
            className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition ${
              active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function pickFile(onFile: (file: File) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,.pdf";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onFile(file);
  };
  input.click();
}

function AcademicScanUpload({ item, update }: { item: AcademicLevelEntry; update: (next: AcademicLevelEntry) => void }) {
  const [file, setFile] = useState<UploadedDoc | null>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");

  return (
    <DocumentUpload
      file={file}
      status={status}
      title="Upload certificate or transcript"
      description="Auto-fills the grade and passing year below — level, institution, and major are what you're entering, so those stay untouched."
      scanningLabel="Scanning certificate…"
      onPick={() => pickFile((f) => {
        setFile({ name: f.name, previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined });
        setStatus("scanning");
        window.setTimeout(() => {
          update({ ...item, ...scanAcademicCertificate(item) });
          setStatus("done");
        }, 1000);
      })}
      onRemove={() => { setFile(null); setStatus("idle"); }}
    />
  );
}

function EnglishScanUpload({ item, update }: { item: EnglishTestDetails; update: (next: EnglishTestDetails) => void }) {
  const [file, setFile] = useState<UploadedDoc | null>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");

  return (
    <DocumentUpload
      file={file}
      status={status}
      title="Upload test report"
      description="Auto-fills the score breakdown, test date, and report number below based on the test name."
      scanningLabel="Scanning test report…"
      onPick={() => pickFile((f) => {
        setFile({ name: f.name, previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined });
        setStatus("scanning");
        window.setTimeout(() => {
          const testName = item.testName.trim() || "IELTS";
          update({ ...item, testName, ...scanEnglishTestReport(testName) });
          setStatus("done");
        }, 1000);
      })}
      onRemove={() => { setFile(null); setStatus("idle"); }}
    />
  );
}

function WorkScanUpload({ item, update }: { item: WorkExperienceDetails; update: (next: WorkExperienceDetails) => void }) {
  const [file, setFile] = useState<UploadedDoc | null>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");

  return (
    <DocumentUpload
      file={file}
      status={status}
      title="Upload experience letter"
      description="Auto-fills the start/end dates and a description below — company and title are what you're entering from the letterhead."
      scanningLabel="Scanning letter…"
      onPick={() => pickFile((f) => {
        setFile({ name: f.name, previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined });
        setStatus("scanning");
        window.setTimeout(() => {
          update({ ...item, ...scanExperienceLetter() });
          setStatus("done");
        }, 1000);
      })}
      onRemove={() => { setFile(null); setStatus("idle"); }}
    />
  );
}

function RepeatableSection<T>({
  items, empty, onChange, addLabel, renderItem, renderUpload,
}: {
  items: T[]; empty: T; onChange: (items: T[]) => void; addLabel: string;
  renderItem: (item: T, update: (next: T) => void) => ReactNode;
  renderUpload?: (item: T, update: (next: T) => void) => ReactNode;
}) {
  return (
    <div className="space-y-4">
      {items.map((item, i) => {
        const update = (next: T) => onChange(items.map((it, idx) => (idx === i ? next : it)));
        return (
          <div key={i} className="relative space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              aria-label="Remove entry"
              className="absolute right-3 top-3 text-slate-300 hover:text-slate-500"
            >
              <X size={14} />
            </button>
            {renderUpload && renderUpload(item, update)}
            {renderItem(item, update)}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...items, empty])}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
      >
        <Plus size={12} /> {addLabel}
      </button>
      {items.length === 0 && (
        <p className="text-center text-xs text-slate-400">Optional — skip this step if not provided yet.</p>
      )}
    </div>
  );
}
