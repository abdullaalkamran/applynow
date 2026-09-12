import { Check, User, GraduationCap, Languages, Briefcase, SlidersHorizontal } from "lucide-react";
import { getProfileCompletion } from "../data/profileCompletion";
import { loadAcademicLevels } from "../data/academicProfileStore";
import { loadPersonalInfo, loadEnglishTests, loadWorkExperience, loadPreferences } from "../data/studentProfileDetailsStore";

const STEP_ICON: Record<string, typeof User> = {
  "personal-information": User,
  "academic-details": GraduationCap,
  "english-proficiency": Languages,
  "work-experience": Briefcase,
  "preferences": SlidersHorizontal,
};

export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 font-medium text-slate-700">{value}</p>
    </div>
  );
}

/** Every field a student submitted while filling in their profile, grouped by onboarding step —
 * the same view for a counsellor's full applicant, a counsellor's lead, and an agent's student,
 * since it's driven entirely by real stored data rather than role-specific state. */
export function ProfileStepsPanel({ studentId }: { studentId: string }) {
  const completion = getProfileCompletion(studentId);
  const personalInfo = loadPersonalInfo(studentId);
  const academicLevels = loadAcademicLevels(studentId);
  const englishTests = loadEnglishTests(studentId);
  const workExperience = loadWorkExperience(studentId);
  const preferences = loadPreferences(studentId);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <p className="text-sm font-semibold text-slate-800">Profile</p>
        <span className="text-xs font-medium text-slate-400">{completion.percent}% complete</span>
      </div>
      <div className="divide-y divide-slate-50">
        {completion.steps.map((s) => {
          const Icon = STEP_ICON[s.key] ?? User;
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
              </div>

              {s.key === "personal-information" && (
                personalInfo ? (
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
                academicLevels.length > 0 ? (
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
                englishTests.length > 0 ? (
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
                workExperience.length > 0 ? (
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
                preferences ? (
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
