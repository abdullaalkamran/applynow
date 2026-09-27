import { getAllStudents } from "../data/allStudentsStore";
import { loadStaff } from "../data/staffStore";
import { getAllApplications, createApplication } from "../data/applicationsStore";
import { addNextStep, toggleNextStepDone, loadNextSteps } from "../data/applicationNextStepsStore";
import { getAllUniversities, getUniversityById } from "../data/universityCatalogStore";
import { SUBJECT_CURRICULUM } from "../data/subjectCurriculum";
import { getProfileCompletion, markStepComplete, PROFILE_STEPS, isProfileDataComplete, isChainComplete } from "../data/profileCompletion";
import {
  loadPersonalInfo, savePersonalInfo,
  loadEnglishTests, saveEnglishTests,
  loadWorkExperience, saveWorkExperience,
  loadPreferences, savePreferences,
  type PersonalInfoDetails, type EnglishTestDetails, type WorkExperienceDetails, type PreferencesDetails,
} from "../data/studentProfileDetailsStore";
import { loadAcademicLevels, saveAcademicLevels } from "../data/academicProfileStore";
import { sendMessage, type MessageParticipant } from "../data/messagesStore";
import { loadFinancialReadiness } from "../data/studentFinancialReadinessStore";
import { buildAnswer } from "./aiCounsellorEngine";
import { getApplicationSummary, getNextAction, getMissingDocuments, getDeadlines, getBlockers } from "./applicationJourneyTools";
import { buildCoreChecklist } from "./documentChecklist";
import type { ToolDefinition, AssistantUserContext } from "./assistantEngine";

// Students don't use taskAssignment.recipientsFor here — that map is one-directional for *task
// assignment* only (students can't assign tasks to anyone, by design). Messaging a student's own
// counsellor/agent is a different relationship, read straight off their own record.
// Mirrors PersonalInformation.tsx's emptyForm() default: only name/email/country are real (pulled
// from the account), everything else genuinely is blank rather than a fabricated guess.
function blankPersonalInfo(studentId: string): PersonalInfoDetails {
  const student = getAllStudents().find((s) => s.id === studentId);
  const [firstName, ...lastParts] = (student?.name ?? "").split(" ");
  return {
    firstName: firstName ?? "", lastName: lastParts.join(" "), email: student?.email ?? "", phone: "",
    dob: "", gender: "", nationality: "", fatherName: "", motherName: "", maritalStatus: "",
    passportNumber: "", personalNumber: "", previousPassportNumber: "", placeOfBirth: "",
    issuingAuthority: "", issueDate: "", passportExpiry: "", permanentAddress: "", presentAddress: "",
    city: "", country: student?.country ?? "", emergencyContactName: "", emergencyContactRelationship: "",
    emergencyContactAddress: "", emergencyContactPhone: "", emergencyContactEmail: "",
  };
}

// University/course browsing and applying only make sense once the school-matching profile data
// actually exists — gated here (not just by system-prompt instruction) so it holds regardless of
// what the model decides to do.
function requireCompleteProfile(studentId: string): { error: string; pendingSteps: string[] } | null {
  if (isChainComplete(studentId)) return null;
  const pendingSteps = getProfileCompletion(studentId).pendingSteps.map((s) => s.label);
  return {
    error: "The student's profile isn't complete yet — finish it before discussing or searching universities/courses, or starting an application. Ask for the next missing step's fields one at a time using get_profile_details/get_profile_status.",
    pendingSteps,
  };
}

function resolveCounterpart(studentId: string): MessageParticipant | null {
  const student = getAllStudents().find((s) => s.id === studentId);
  if (!student) return null;
  const staff = loadStaff();
  if (student.counsellorId) {
    const counsellor = staff.find((s) => s.id === student.counsellorId && s.role === "counsellor");
    if (counsellor) return { role: "counsellor", id: counsellor.id, name: counsellor.name };
  }
  if (student.agentId) {
    const agent = staff.find((s) => s.id === student.agentId && s.role === "agent");
    if (agent) return { role: "agent", id: agent.id, name: agent.name };
  }
  return null;
}

const stringProps = (keys: string[]) =>
  Object.fromEntries(keys.map((key) => [key, { type: "string" }]));

// A student's journey tools must never let them read another student's application by id — this
// scoping check is the equivalent of counsellorAssistantTools.ts's own-caseload guard.
function assertOwnApplication(studentId: string, applicationId: string): { error: string } | null {
  const application = getAllApplications().find((a) => a.id === applicationId);
  if (!application || application.studentId !== studentId) {
    return { error: `No application with id "${applicationId}" belongs to this student.` };
  }
  return null;
}

// Our catalog stores abbreviated/short country names ("UK", "United States") but a student
// speaking naturally (and the model relaying it) says the full name — a plain one-directional
// substring check meant "united kingdom" could never match stored "UK", making a real partner
// university look nonexistent. Checking both directions, plus a couple of common aliases our
// short forms don't cover on their own, fixes that without needing a full country database.
const COUNTRY_ALIASES: Record<string, string[]> = {
  uk: ["united kingdom", "britain", "great britain", "england"],
  usa: ["united states", "america", "us"],
  uae: ["united arab emirates"],
};

function countryMatches(storedCountry: string, query: string): boolean {
  const stored = storedCountry.toLowerCase();
  const q = query.toLowerCase();
  if (stored.includes(q) || q.includes(stored)) return true;
  return (COUNTRY_ALIASES[stored] ?? []).some((alias) => alias.includes(q) || q.includes(alias));
}

export function studentTools(ctx: AssistantUserContext): ToolDefinition[] {
  const studentId = ctx.userId;

  return [
    {
      spec: {
        name: "get_profile_status",
        description: "Check how complete the student's profile is and which steps are still pending.",
        parameters: { type: "object", properties: {} },
      },
      execute: () => getProfileCompletion(studentId),
    },
    {
      spec: {
        name: "get_profile_details",
        description: "Read everything currently on file for the student: personal info, English test scores, work experience, study preferences, and academic history — use this before updating anything, to know what's already filled in.",
        parameters: { type: "object", properties: {} },
      },
      execute: () => ({
        personalInfo: loadPersonalInfo(studentId),
        englishTests: loadEnglishTests(studentId),
        workExperience: loadWorkExperience(studentId),
        preferences: loadPreferences(studentId),
        academicLevels: loadAcademicLevels(studentId),
      }),
    },
    {
      spec: {
        name: "get_required_documents",
        description: "List the student's core (not application-specific) required documents still missing or rejected — passport, photo, and similar vault documents every application needs, independent of any one application's own checklist.",
        parameters: { type: "object", properties: {} },
      },
      execute: () =>
        buildCoreChecklist(studentId)
          .filter((row) => !row.own && !row.reused)
          .map((row) => ({
            type: row.type,
            status: row.rejected ? "rejected" : "missing",
            reason: row.rejected?.reason,
          })),
    },
    {
      spec: {
        name: "get_financial_readiness_status",
        description: "Check whether the student's Financial Readiness (bank balance evidence) has been confirmed — required before an offer can be finalized. One shared record per student, not tied to a specific application.",
        parameters: { type: "object", properties: {} },
      },
      execute: () => {
        const record = loadFinancialReadiness(studentId);
        if (!record) return { status: "not_started", message: "No financial readiness information has been entered yet." };
        if (record.completedAt) return { status: "confirmed", completedAt: record.completedAt };
        return { status: "in_progress", message: "Bank balance evidence has been entered but not yet confirmed." };
      },
    },
    {
      spec: {
        name: "list_my_next_steps",
        description: "List every to-do a counsellor has added across all of the student's applications, not just one — use this for a general \"what do I need to do next\" question instead of guessing a single applicationId.",
        parameters: { type: "object", properties: {} },
      },
      execute: () =>
        getAllApplications()
          .filter((a) => a.studentId === studentId)
          .flatMap((a) => loadNextSteps(a.id)
            .filter((ns) => !ns.done)
            .map((ns) => ({ applicationId: a.id, university: a.university, title: ns.title, dueDate: ns.dueDate }))),
    },
    {
      spec: {
        name: "update_personal_info",
        description: "Update one or more personal information fields for the student's profile (name, contact details, passport, address, emergency contact, etc). Only pass the fields being changed.",
        parameters: {
          type: "object",
          properties: stringProps([
            "firstName", "lastName", "email", "phone", "dob", "gender", "nationality",
            "fatherName", "motherName", "maritalStatus", "passportNumber", "personalNumber",
            "previousPassportNumber", "placeOfBirth", "issuingAuthority", "issueDate",
            "passportExpiry", "permanentAddress", "presentAddress", "city", "country",
            "emergencyContactName", "emergencyContactRelationship", "emergencyContactAddress",
            "emergencyContactPhone", "emergencyContactEmail",
          ]),
        },
      },
      execute: (args) => {
        // loadPersonalInfo returns null until the student has saved the Personal Information page
        // at least once — merging args straight onto null would leave every other required field
        // `undefined`, which crashes that page's render (it expects real strings, e.g. calls
        // .trim() on the saved phone) the next time the student opens it. Fall back to a fully
        // blank record (seeded with what's already known from the account) so a change made here
        // before the form's ever been filled in is always a complete, safe-to-render record.
        const current = loadPersonalInfo(studentId) ?? blankPersonalInfo(studentId);
        const merged = { ...current, ...args };
        savePersonalInfo(merged, studentId);
        return merged;
      },
    },
    {
      spec: {
        name: "update_english_test",
        description: "Add or update the student's English test result (IELTS/TOEFL/PTE/etc). Fills in whichever fields are provided; leaves the rest as-is.",
        parameters: {
          type: "object",
          properties: stringProps([
            "testName", "testType", "overallScore", "listening", "reading", "writing", "speaking",
            "testDate", "expiryDate", "reportNumber", "issuingInstitution",
          ]),
        },
      },
      execute: (args) => {
        const existing = loadEnglishTests(studentId);
        // existing[0] || {} leaves every unset field `undefined` on a brand-new entry — this page's
        // handleSave calls .trim() on each of these once the student hits Save, which would crash
        // the same way the personal-info page did. Blank strings keep it a valid, safe-to-render row.
        const blank: EnglishTestDetails = {
          testName: "", testType: "", overallScore: "", listening: "", reading: "", writing: "", speaking: "",
          testDate: "", expiryDate: "", reportNumber: "", issuingInstitution: "",
        };
        const merged = { ...blank, ...(existing[0] || {}), ...args };
        const next = [merged, ...existing.slice(1)];
        saveEnglishTests(next, studentId);
        return merged;
      },
    },
    {
      spec: {
        name: "update_work_experience",
        description: "Add or update the student's most recent work experience entry.",
        parameters: {
          type: "object",
          properties: {
            ...stringProps(["type", "company", "title", "industry", "startDate", "endDate", "description"]),
            currentlyWorking: { type: "boolean" },
          },
        },
      },
      execute: (args) => {
        const existing = loadWorkExperience(studentId);
        // Same reasoning as update_english_test: a brand-new entry needs every field defined before
        // it's saved, or this page's handleSave crashes calling .trim() on an undefined field.
        const blank: WorkExperienceDetails = {
          type: "", company: "", title: "", industry: "", startDate: "", endDate: "",
          currentlyWorking: false, description: "",
        };
        const merged = { ...blank, ...(existing[0] || {}), ...args };
        const next = [merged, ...existing.slice(1)];
        saveWorkExperience(next, studentId);
        return merged;
      },
    },
    {
      spec: {
        name: "update_preferences",
        description: "Update the student's study preferences — destination countries, study level, fields of interest, intake, budget, accommodation, scholarship interest, and contact preferences.",
        parameters: {
          type: "object",
          properties: {
            destinations: { type: "array", items: { type: "string" } },
            fields: { type: "array", items: { type: "string" } },
            ...stringProps(["studyLevel", "intake", "budget", "accommodation", "contactLanguage"]),
            scholarshipInterest: { type: "boolean" },
            emailUpdates: { type: "boolean" },
            smsUpdates: { type: "boolean" },
            whatsappUpdates: { type: "boolean" },
            pushUpdates: { type: "boolean" },
          },
        },
      },
      execute: (args) => {
        // loadPreferences returns null before the student has saved this page once — merging args
        // onto null would leave destinations/fields `undefined`, and Preferences.tsx calls
        // .map() directly on saved destinations while restoring its state on mount, crashing the
        // page the same way a missing phone crashed Personal Information.
        const blank: PreferencesDetails = {
          destinations: [], studyLevel: "", fields: [], intake: "", budget: "", accommodation: "",
          scholarshipInterest: false, emailUpdates: false, smsUpdates: false, whatsappUpdates: false,
          pushUpdates: false, contactLanguage: "",
        };
        const current = loadPreferences(studentId) ?? blank;
        const merged = { ...current, ...args };
        savePreferences(merged, studentId);
        return merged;
      },
    },
    {
      spec: {
        name: "add_academic_level",
        description: "Add one academic qualification (e.g. SSC, HSC, Bachelor's) to the student's education history.",
        parameters: {
          type: "object",
          properties: stringProps(["level", "institution", "board", "group", "major", "grade", "passingYear"]),
          required: ["level", "institution"],
        },
      },
      execute: (args) => {
        const entries = loadAcademicLevels(studentId);
        const entry = args as unknown as ReturnType<typeof loadAcademicLevels>[number];
        const next = [...entries, entry];
        saveAcademicLevels(next, studentId);
        return entry;
      },
    },
    {
      spec: {
        name: "mark_profile_step_complete",
        description: `Mark a profile step as done — only succeeds once every field that step needs has actually been saved (via update_personal_info/add_academic_level/update_english_test/update_work_experience) first; call this to check, don't assume it will succeed. Valid stepKey values: ${PROFILE_STEPS.map((s) => s.key).join(", ")}.`,
        parameters: {
          type: "object",
          properties: { stepKey: { type: "string", enum: PROFILE_STEPS.map((s) => s.key) } },
          required: ["stepKey"],
        },
      },
      execute: (args) => {
        const stepKey = String(args.stepKey);
        const { complete, missing } = isProfileDataComplete(stepKey, studentId);
        if (!complete) {
          return { error: "Not complete yet — ask the student for these one at a time, then try again.", missing };
        }
        markStepComplete(stepKey, studentId);
        return getProfileCompletion(studentId);
      },
    },
    {
      spec: {
        name: "explain_application_process",
        description: "Explain how applying to a university works on this platform, optionally tailored to a destination country the student is considering.",
        parameters: { type: "object", properties: { country: { type: "string" } } },
      },
      execute: (args) => {
        const base = buildAnswer("how do I apply to a university");
        const country = (args.country as string) || loadPreferences(studentId)?.destinations?.[0];
        return country
          ? `${base} For ${country} specifically, exact document and intake requirements vary by university — check that university's page for the details.`
          : base;
      },
    },
    {
      spec: {
        name: "explain_visa_process",
        description: "Explain the visa process after receiving an offer, optionally tailored to a destination country.",
        parameters: { type: "object", properties: { country: { type: "string" } } },
      },
      execute: (args) => {
        const base = buildAnswer("explain the visa process");
        const country = (args.country as string) || loadPreferences(studentId)?.destinations?.[0];
        return country
          ? `${base} Visa rules are set by ${country}'s immigration authority, so always double-check current requirements on their official site as well.`
          : base;
      },
    },
    {
      spec: {
        name: "search_universities",
        description: "Search the university catalog by destination country, subject, study level, maximum budget in USD, or scholarship availability. Returns up to 8 matches with a few matching courses each.",
        parameters: {
          type: "object",
          properties: {
            country: { type: "string" },
            subject: { type: "string" },
            studyLevel: { type: "string" },
            maxBudget: { type: "number" },
            scholarshipOnly: { type: "boolean" },
          },
        },
      },
      execute: (args) => {
        const blocked = requireCompleteProfile(studentId);
        if (blocked) return blocked;

        const country = args.country as string | undefined;
        const subject = args.subject as string | undefined;
        const studyLevel = args.studyLevel as string | undefined;
        const maxBudget = args.maxBudget as number | undefined;
        const scholarshipOnly = args.scholarshipOnly as boolean | undefined;

        const results = getAllUniversities()
          .filter((u) => {
            if (country && !countryMatches(u.country, country)) return false;
            if (scholarshipOnly && !u.scholarshipsAvailable) return false;
            if (subject && !u.subjects.some((s) => s.toLowerCase().includes(subject.toLowerCase()))) return false;
            return true;
          })
          .map((u) => ({
            u,
            // A single course must satisfy BOTH level and budget together — checking them as two
            // independent `some()` calls (the previous bug) let a university pass with an
            // expensive course covering level and an unrelated cheap course covering budget,
            // while no course actually matched both, leaving matchingCourses empty below.
            matchingCourses: u.courses
              .filter((c) => !studyLevel || c.level.toLowerCase().includes(studyLevel.toLowerCase()))
              .filter((c) => !maxBudget || c.feeUSD <= maxBudget),
          }))
          // Only require a real matching course when level/budget were actually specified —
          // a plain country/subject search shouldn't demand a course match at all.
          .filter(({ matchingCourses }) => !(studyLevel || maxBudget) || matchingCourses.length > 0);

        return results.slice(0, 8).map(({ u, matchingCourses }) => ({
          id: u.id,
          name: u.name,
          country: u.country,
          worldRank: u.worldRank,
          employability: u.employability,
          scholarshipsAvailable: u.scholarshipsAvailable,
          matchingCourses: matchingCourses.slice(0, 3).map((c) => ({ id: c.id, name: c.name, level: c.level, feeUSD: c.feeUSD })),
        }));
      },
    },
    {
      spec: {
        name: "get_university_detail",
        description: "Get full detail for one university by id (requirements, fees, English test requirements, scholarships, courses).",
        parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      },
      execute: (args) => {
        const blocked = requireCompleteProfile(studentId);
        if (blocked) return blocked;
        const uni = getUniversityById(String(args.id));
        if (!uni) return { error: "No university found with that id." };
        return uni;
      },
    },
    {
      spec: {
        name: "list_subjects",
        description: "List every field of study/subject a partner university actually offers right now — use this when the student doesn't already know what they want to study, before guessing a subject to search with.",
        parameters: { type: "object", properties: {} },
      },
      // Derived from the live catalog (what real courses actually exist), not the full picklist of
      // possible subject names Data Management can choose from — the latter includes subjects with
      // zero courses behind them, which would have the assistant confidently offering a subject the
      // student can't actually apply to anywhere.
      execute: () => requireCompleteProfile(studentId) ?? Array.from(new Set(getAllUniversities().flatMap((u) => u.subjects))).sort(),
    },
    {
      spec: {
        name: "get_subject_detail",
        description: "Get typical modules and career outcomes for a subject, plus how many partner universities currently offer it. Use an exact subject name from list_subjects.",
        parameters: { type: "object", properties: { subject: { type: "string" } }, required: ["subject"] },
      },
      execute: (args) => {
        const blocked = requireCompleteProfile(studentId);
        if (blocked) return blocked;
        const subject = String(args.subject);
        const curriculum = SUBJECT_CURRICULUM[subject];
        const universityCount = getAllUniversities().filter((u) => u.subjects.includes(subject)).length;
        if (!curriculum && universityCount === 0) {
          return { error: `"${subject}" doesn't match a subject in our network. Call list_subjects for the real options.` };
        }
        return { subject, universityCount, modules: curriculum?.modules ?? [], careers: curriculum?.careers ?? [] };
      },
    },
    {
      spec: {
        name: "list_my_applications",
        description: "List the student's own applications with current status and progress.",
        parameters: { type: "object", properties: {} },
      },
      execute: () =>
        getAllApplications()
          .filter((a) => a.studentId === studentId)
          .map((a) => ({
            id: a.id, university: a.university, course: a.course, intake: a.intake,
            status: a.status, progress: a.progress, nextAction: a.nextAction, waitingOn: a.waitingOn,
          })),
    },
    {
      spec: {
        name: "create_application",
        description: "Start a new application for the student to a specific university and course. universityId and courseId MUST come from a real result returned by search_universities or get_university_detail in this conversation — never invent or guess an id, and never accept a university/course name from the student without first confirming it exists via search_universities.",
        parameters: {
          type: "object",
          properties: {
            universityId: { type: "string" },
            courseId: { type: "string" },
            intake: { type: "string" },
            campus: { type: "string" },
          },
          required: ["universityId", "courseId", "intake"],
        },
      },
      execute: (args) => {
        const blocked = requireCompleteProfile(studentId);
        if (blocked) return blocked;
        const university = getUniversityById(String(args.universityId));
        if (!university) {
          return { error: `No university with id "${args.universityId}" exists in our partner network. Call search_universities first and use a real id from the results — never a name the student mentioned on its own.` };
        }
        const course = university.courses.find((c) => c.id === String(args.courseId));
        if (!course) {
          return { error: `No course with id "${args.courseId}" exists at ${university.name}. Call get_university_detail("${university.id}") to see its real courses and use a real course id.` };
        }
        const missingCoreDocs = buildCoreChecklist(studentId).filter((row) => !row.own);
        if (missingCoreDocs.length > 0) {
          return {
            error: `Core documents must be uploaded before submitting an application. Missing: ${missingCoreDocs.map((row) => row.type).join(", ")}.`,
          };
        }
        return createApplication({
          studentId,
          university: university.name,
          course: course.name,
          intake: String(args.intake),
          country: university.country,
          campus: (args.campus as string) || "Main Campus",
          source: "student",
        });
      },
    },
    {
      spec: {
        name: "add_application_next_step",
        description: "Add a to-do item to one of the student's applications.",
        parameters: {
          type: "object",
          properties: { applicationId: { type: "string" }, title: { type: "string" }, dueDate: { type: "string" } },
          required: ["applicationId", "title"],
        },
      },
      execute: (args) => addNextStep(String(args.applicationId), String(args.title), args.dueDate as string | undefined),
    },
    {
      spec: {
        name: "toggle_application_next_step",
        description: "Mark an application's to-do item done or not-done.",
        parameters: {
          type: "object",
          properties: { applicationId: { type: "string" }, stepId: { type: "string" } },
          required: ["applicationId", "stepId"],
        },
      },
      execute: (args) => {
        toggleNextStepDone(String(args.applicationId), String(args.stepId));
        return loadNextSteps(String(args.applicationId));
      },
    },
    {
      spec: {
        name: "send_update_message",
        description: "Send a message to the student's assigned counsellor or agent asking for an update or relaying information.",
        parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      },
      execute: (args) => {
        const to = resolveCounterpart(studentId);
        if (!to) return { error: "No counsellor or agent is assigned to this student yet." };
        const message = sendMessage(to, String(args.text), { role: "student", id: studentId, name: ctx.userName });
        return { sent: true, to: to.name, message };
      },
    },
    {
      spec: {
        name: "get_application_summary",
        description: "Get the current stage, status, progress, blockers, and next action for one of the student's own applications. Call list_my_applications first if you don't already have the applicationId.",
        parameters: { type: "object", properties: { applicationId: { type: "string" } }, required: ["applicationId"] },
      },
      execute: (args) => assertOwnApplication(studentId, String(args.applicationId)) ?? getApplicationSummary(String(args.applicationId)),
    },
    {
      spec: {
        name: "get_next_action",
        description: "Get the single next thing the student needs to do on one of their applications, and who it's actually waiting on.",
        parameters: { type: "object", properties: { applicationId: { type: "string" } }, required: ["applicationId"] },
      },
      execute: (args) => assertOwnApplication(studentId, String(args.applicationId)) ?? getNextAction(String(args.applicationId)),
    },
    {
      spec: {
        name: "get_missing_documents",
        description: "List documents still needed (requested or rejected) for one of the student's applications.",
        parameters: { type: "object", properties: { applicationId: { type: "string" } }, required: ["applicationId"] },
      },
      execute: (args) => assertOwnApplication(studentId, String(args.applicationId)) ?? getMissingDocuments(String(args.applicationId)),
    },
    {
      spec: {
        name: "get_deadlines",
        description: "Get every real known deadline date across one of the student's applications (offer expiry, deposit, visa appointment, enrolment, etc).",
        parameters: { type: "object", properties: { applicationId: { type: "string" } }, required: ["applicationId"] },
      },
      execute: (args) => assertOwnApplication(studentId, String(args.applicationId)) ?? getDeadlines(String(args.applicationId)),
    },
    {
      spec: {
        name: "get_blockers",
        description: "Get everything currently blocking one of the student's applications from progressing.",
        parameters: { type: "object", properties: { applicationId: { type: "string" } }, required: ["applicationId"] },
      },
      execute: (args) => assertOwnApplication(studentId, String(args.applicationId)) ?? getBlockers(String(args.applicationId)),
    },
  ];
}
