import { STUDENTS, COUNSELLORS, AGENTS } from "../data/mockData";
import { getAllApplications, createApplication } from "../data/applicationsStore";
import { addNextStep, toggleNextStepDone, loadNextSteps } from "../data/applicationNextStepsStore";
import { addUploadedDoc } from "../data/applicationDocsStore";
import { getAllUniversities, getUniversityById } from "../data/universityCatalogStore";
import { getProfileCompletion, markStepComplete, PROFILE_STEPS } from "../data/profileCompletion";
import {
  loadPersonalInfo, savePersonalInfo,
  loadEnglishTests, saveEnglishTests,
  loadWorkExperience, saveWorkExperience,
  loadPreferences, savePreferences,
} from "../data/studentProfileDetailsStore";
import { loadAcademicLevels, saveAcademicLevels } from "../data/academicProfileStore";
import { sendMessage, type MessageParticipant } from "../data/messagesStore";
import { buildAnswer } from "./aiCounsellorEngine";
import type { ToolDefinition, AssistantUserContext } from "./assistantEngine";

// Students don't use taskAssignment.recipientsFor here — that map is one-directional for *task
// assignment* only (students can't assign tasks to anyone, by design). Messaging a student's own
// counsellor/agent is a different relationship, read straight off their own record.
function resolveCounterpart(studentId: string): MessageParticipant | null {
  const student = STUDENTS.find((s) => s.id === studentId);
  if (!student) return null;
  if (student.counsellorId) {
    const counsellor = COUNSELLORS.find((c) => c.id === student.counsellorId);
    if (counsellor) return { role: "counsellor", id: counsellor.id, name: counsellor.name };
  }
  if (student.agentId) {
    const agent = AGENTS.find((a) => a.id === student.agentId);
    if (agent) return { role: "agent", id: agent.id, name: agent.name };
  }
  return null;
}

const stringProps = (keys: string[]) =>
  Object.fromEntries(keys.map((key) => [key, { type: "string" }]));

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
        const current = loadPersonalInfo(studentId);
        const merged = { ...current, ...args } as ReturnType<typeof loadPersonalInfo>;
        if (!merged) return { error: "No personal info to update yet — provide all required fields first." };
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
        const merged = { ...(existing[0] || {}), ...args };
        const next = [merged, ...existing.slice(1)] as ReturnType<typeof loadEnglishTests>;
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
        const merged = { ...(existing[0] || {}), ...args };
        const next = [merged, ...existing.slice(1)] as ReturnType<typeof loadWorkExperience>;
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
        const current = loadPreferences(studentId);
        const merged = { ...current, ...args } as ReturnType<typeof loadPreferences>;
        if (!merged) return { error: "No preferences on file yet — provide destinations and study level to start." };
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
        description: `Mark a profile step as done. Valid stepKey values: ${PROFILE_STEPS.map((s) => s.key).join(", ")}.`,
        parameters: {
          type: "object",
          properties: { stepKey: { type: "string", enum: PROFILE_STEPS.map((s) => s.key) } },
          required: ["stepKey"],
        },
      },
      execute: (args) => {
        markStepComplete(String(args.stepKey), studentId);
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
        const country = args.country as string | undefined;
        const subject = args.subject as string | undefined;
        const studyLevel = args.studyLevel as string | undefined;
        const maxBudget = args.maxBudget as number | undefined;
        const scholarshipOnly = args.scholarshipOnly as boolean | undefined;

        const matches = getAllUniversities().filter((u) => {
          if (country && !u.country.toLowerCase().includes(country.toLowerCase())) return false;
          if (scholarshipOnly && !u.scholarshipsAvailable) return false;
          if (subject && !u.subjects.some((s) => s.toLowerCase().includes(subject.toLowerCase()))) return false;
          if (studyLevel && !u.courses.some((c) => c.level.toLowerCase().includes(studyLevel.toLowerCase()))) return false;
          if (maxBudget && !u.courses.some((c) => c.feeUSD <= maxBudget)) return false;
          return true;
        });

        return matches.slice(0, 8).map((u) => ({
          id: u.id,
          name: u.name,
          country: u.country,
          worldRank: u.worldRank,
          employability: u.employability,
          scholarshipsAvailable: u.scholarshipsAvailable,
          matchingCourses: u.courses
            .filter((c) => !studyLevel || c.level.toLowerCase().includes(studyLevel.toLowerCase()))
            .filter((c) => !maxBudget || c.feeUSD <= maxBudget)
            .slice(0, 3)
            .map((c) => ({ id: c.id, name: c.name, level: c.level, feeUSD: c.feeUSD })),
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
        const uni = getUniversityById(String(args.id));
        if (!uni) return { error: "No university found with that id." };
        return uni;
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
        description: "Start a new application for the student to a specific university and course.",
        parameters: {
          type: "object",
          properties: {
            university: { type: "string" },
            course: { type: "string" },
            intake: { type: "string" },
            country: { type: "string" },
            campus: { type: "string" },
          },
          required: ["university", "course", "intake", "country"],
        },
      },
      execute: (args) =>
        createApplication({
          studentId,
          university: String(args.university),
          course: String(args.course),
          intake: String(args.intake),
          country: String(args.country),
          campus: (args.campus as string) || "Main Campus",
          source: "student",
        }),
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
        name: "record_uploaded_document",
        description: "Record that a document has been provided for an application (checklist bookkeeping only — the actual file must still be uploaded manually in the app).",
        parameters: {
          type: "object",
          properties: { applicationId: { type: "string" }, name: { type: "string" } },
          required: ["applicationId", "name"],
        },
      },
      execute: (args) => addUploadedDoc(String(args.applicationId), String(args.name)),
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
        const message = sendMessage({
          from: { role: "student", id: studentId, name: ctx.userName },
          to,
          text: String(args.text),
        });
        return { sent: true, to: to.name, message };
      },
    },
  ];
}
