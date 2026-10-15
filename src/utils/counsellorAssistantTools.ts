// The counsellor's AI tool registry — the real gap this feature closes. Every other role config in
// roleAssistantConfigs.ts had almost nothing; a counsellor managing the Application → Enrolment
// journey needs the full 17-read/4-write set the PDF spec describes, scoped strictly to their own
// caseload (loadAssignedStudents()) so a counsellor's assistant can never see or touch another
// counsellor's students, mirroring the id-validation discipline studentAssistantTools.ts already
// enforces for create_application.
import { loadAssignedStudents } from "../data/counsellorStudentsStore";
import { loadPersonalInfo, loadEnglishTests, loadWorkExperience, loadPreferences } from "../data/studentProfileDetailsStore";
import { loadAcademicLevels } from "../data/academicProfileStore";
import { loadCoreDocs, organiseCoreDoc } from "../data/coreDocsStore";
import { buildCoreChecklist } from "./documentChecklist";
import { listPortals, listSubmissions, queueSubmission, confirmSubmission } from "../data/portalsStore";
import { getStagedFiles, readStagedDocuments, describeProposal, createStudentFromProposal } from "./profileFromDocuments";
import { getAllApplications } from "../data/applicationsStore";
import { addTask, patchTask, toggleTaskDone, type TaskPerson } from "../data/tasksStore";
import { requestDocument as requestStageDocument } from "../data/documentsStore";
import { addCustomDocRequest } from "../data/applicationDocsStore";
import { recordActivity } from "../data/applicationActivityStore";
import {
  getApplicationSummary, getApplicationStage, getApplicationTimeline, getApplicationRequirements,
  getMissingDocuments, getDocumentStatus, getNextAction, getDeadlines, getBlockers, stageStatus,
} from "./applicationJourneyTools";
import { STAGE_LABEL, type StageType } from "../types/journey";
import type { ToolDefinition, AssistantUserContext } from "./assistantEngine";

const STAGE_STATUS_TOOLS: { name: string; stageType: StageType }[] = [
  { name: "get_offer_status", stageType: "offer" },
  { name: "get_financial_status", stageType: "financial_readiness" },
  { name: "get_payment_status", stageType: "payment" },
  { name: "get_interview_status", stageType: "interview" },
  { name: "get_university_document_status", stageType: "university_document" },
  { name: "get_visa_status", stageType: "visa" },
  { name: "get_evisa_status", stageType: "evisa" },
  { name: "get_enrolment_status", stageType: "enrolment" },
];

export function counsellorTools(ctx: AssistantUserContext): ToolDefinition[] {
  const counsellorId = ctx.userId;

  function myApplicationIds(): Set<string> {
    const students = loadAssignedStudents();
    return new Set(getAllApplications().filter((a) => students.some((s) => s.id === a.studentId)).map((a) => a.id));
  }

  function assertOwnApplication(applicationId: string): { error: string } | null {
    if (!myApplicationIds().has(applicationId)) {
      return { error: `Application "${applicationId}" is not in your caseload.` };
    }
    return null;
  }

  const appIdParam = { applicationId: { type: "string" } };

  const inCaseload = (studentId: string) => loadAssignedStudents().some((s) => s.id === studentId);

  // Portal names for the approval cards (describe() is synchronous), filled whenever the portals are listed.
  const portalNames = new Map<string, string>();
  const appLabel = (applicationId: string) => {
    const a = getAllApplications().find((x) => x.id === applicationId);
    const student = a ? loadAssignedStudents().find((s) => s.id === a.studentId)?.name : undefined;
    return a ? `${student ?? "student"}'s application to ${a.university} — ${a.course}` : `application ${applicationId}`;
  };

  const readTools: ToolDefinition[] = [
    {
      spec: { name: "list_my_portals", description: "List the external university / B2B agent portals the counsellor has saved logins for (id, name, kind, whether the last login worked). Credentials are never shown. Use the id with submit_application_to_portal.", parameters: { type: "object", properties: {} } },
      execute: async () => {
        try {
          const portals = await listPortals();
          portals.forEach((p) => portalNames.set(p.id, p.name));
          return portals.map((p) => ({ portalId: p.id, name: p.name, kind: p.kind, lastLoginOk: p.lastLoginOk }));
        } catch (err) { return { error: err instanceof Error ? err.message : "Couldn't load portals." }; }
      },
    },
    {
      spec: { name: "list_portal_submissions", description: "Check where applications stand on external portals: status (queued, preparing, awaiting_confirm = filled in and waiting for the counsellor's final confirmation, submitted, needs_human, failed), the portal's own reference and last status read from the portal, and when it was last checked. Optionally for one application.", parameters: { type: "object", properties: { applicationId: { type: "string" } } } },
      execute: async (args) => {
        try {
          if (args.applicationId) { const err = assertOwnApplication(String(args.applicationId)); if (err) return err; }
          return await listSubmissions(args.applicationId ? String(args.applicationId) : undefined);
        } catch (err) { return { error: err instanceof Error ? err.message : "Couldn't load submissions." }; }
      },
    },
    {
      spec: {
        name: "list_student_documents",
        description: "Check a caseload student's document vault: every uploaded file (id, name, type, status) plus the required-document checklist showing what is missing, uploaded, verified or rejected (with the rejection reason). Use before asking for documents, organising them, or building a profile.",
        parameters: { type: "object", properties: { studentId: { type: "string" } }, required: ["studentId"] },
      },
      execute: (args) => {
        const id = String(args.studentId);
        if (!inCaseload(id)) return { error: `Student "${id}" is not in your caseload.` };
        return {
          documents: loadCoreDocs(id).map((d) => ({ id: d.id, name: d.name, type: d.type, status: d.status, uploadedAt: d.uploadedAt, rejectionReason: d.rejectionReason })),
          checklist: buildCoreChecklist(id).map((r) => ({
            type: r.type,
            state: r.rejected ? "rejected" : r.own ? r.own.status : "missing",
            documentId: r.own?.id ?? r.rejected?.id,
            rejectionReason: r.rejected?.reason,
          })),
        };
      },
    },
    {
      spec: { name: "list_my_students", description: "List the students assigned to you (id, name, home country) — use the id with get_student_profile.", parameters: { type: "object", properties: {} } },
      execute: () => loadAssignedStudents().map((s) => ({ studentId: s.id, name: s.name, country: s.country })),
    },
    {
      spec: {
        name: "get_student_profile",
        description: "Read a caseload student's profile on file: personal info, English test scores, work experience, study preferences (destination, level, budget) and academic history. Use before recommending courses, universities or scholarships for them.",
        parameters: { type: "object", properties: { studentId: { type: "string" } }, required: ["studentId"] },
      },
      execute: (args) => {
        const id = String(args.studentId);
        if (!loadAssignedStudents().some((s) => s.id === id)) return { error: `Student "${id}" is not in your caseload.` };
        return {
          personalInfo: loadPersonalInfo(id), englishTests: loadEnglishTests(id), workExperience: loadWorkExperience(id),
          preferences: loadPreferences(id), academicLevels: loadAcademicLevels(id),
        };
      },
    },
    {
      spec: { name: "get_application_summary", description: "Get the compact current-state summary for one application in your caseload: stage, status, progress, blockers, next action.", parameters: { type: "object", properties: appIdParam, required: ["applicationId"] } },
      execute: (args) => assertOwnApplication(String(args.applicationId)) ?? getApplicationSummary(String(args.applicationId)),
    },
    {
      spec: { name: "get_application_stage", description: "Get the full structured data for one specific stage of an application.", parameters: { type: "object", properties: { ...appIdParam, stageType: { type: "string", enum: ["application", "offer", "financial_readiness", "payment", "interview", "university_document", "visa", "evisa", "enrolment"] } }, required: ["applicationId", "stageType"] } },
      execute: (args) => assertOwnApplication(String(args.applicationId)) ?? getApplicationStage(String(args.applicationId), args.stageType as StageType),
    },
    {
      spec: { name: "get_application_timeline", description: "Get the recent activity/audit history for an application (status changes, notes, document requests), newest first.", parameters: { type: "object", properties: appIdParam, required: ["applicationId"] } },
      execute: (args) => assertOwnApplication(String(args.applicationId)) ?? getApplicationTimeline(String(args.applicationId)),
    },
    {
      spec: { name: "get_application_requirements", description: "Get the full data-driven requirement checklist for an application (documents and rules required for its destination country), with real status for each.", parameters: { type: "object", properties: appIdParam, required: ["applicationId"] } },
      execute: (args) => assertOwnApplication(String(args.applicationId)) ?? getApplicationRequirements(String(args.applicationId)),
    },
    {
      spec: { name: "get_missing_documents", description: "List documents that are still Requested or Rejected for an application, optionally filtered to one stage.", parameters: { type: "object", properties: { ...appIdParam, stageType: { type: "string" } }, required: ["applicationId"] } },
      execute: (args) => assertOwnApplication(String(args.applicationId)) ?? getMissingDocuments(String(args.applicationId), args.stageType as StageType | undefined),
    },
    {
      spec: { name: "get_document_status", description: "Get the status of one specific stage document by its id.", parameters: { type: "object", properties: { ...appIdParam, documentId: { type: "string" } }, required: ["applicationId", "documentId"] } },
      execute: (args) => assertOwnApplication(String(args.applicationId)) ?? getDocumentStatus(String(args.applicationId), String(args.documentId)),
    },
    {
      spec: { name: "get_next_action", description: "Get the single calculated primary next action for an application right now, and who owns it.", parameters: { type: "object", properties: appIdParam, required: ["applicationId"] } },
      execute: (args) => assertOwnApplication(String(args.applicationId)) ?? getNextAction(String(args.applicationId)),
    },
    {
      spec: { name: "get_deadlines", description: "Get every known real deadline date across an application's applicable stages.", parameters: { type: "object", properties: appIdParam, required: ["applicationId"] } },
      execute: (args) => assertOwnApplication(String(args.applicationId)) ?? getDeadlines(String(args.applicationId)),
    },
    {
      spec: { name: "get_blockers", description: "Get everything currently blocking an application from progressing.", parameters: { type: "object", properties: appIdParam, required: ["applicationId"] } },
      execute: (args) => assertOwnApplication(String(args.applicationId)) ?? getBlockers(String(args.applicationId)),
    },
    ...STAGE_STATUS_TOOLS.map(({ name, stageType }) => ({
      spec: { name, description: `Get the current ${STAGE_LABEL[stageType]} stage status and data for an application.`, parameters: { type: "object", properties: appIdParam, required: ["applicationId"] } },
      execute: (args: Record<string, unknown>) => assertOwnApplication(String(args.applicationId)) ?? stageStatus(String(args.applicationId), stageType),
    })),
  ];

  // Exactly the 4 write tools the workflow spec allows an AI to use directly — status, payment,
  // visa-approval, and enrolment changes are deliberately NOT tools; those stay human-only through
  // the counsellor UI, protected by backend validation, per the spec's human-confirmation rule.
  const writeTools: ToolDefinition[] = [
    {
      spec: {
        name: "submit_application_to_portal",
        description: "Start submitting one of the counsellor's applications to a saved external portal. The counsellor must approve first. A background worker then logs in, fills the portal from the student's profile and documents, and STOPS before the final submit — it never submits on its own. Afterwards tell the counsellor to review the filled-in preview on the Portals page and then confirm (confirm_portal_submission).",
        parameters: { type: "object", properties: { portalId: { type: "string" }, applicationId: { type: "string" } }, required: ["portalId", "applicationId"] },
      },
      requiresApproval: true,
      describe: (args) => `Prepare ${appLabel(String(args.applicationId))} for submission on the "${portalNames.get(String(args.portalId)) ?? "selected"}" portal.\n\nThe AI agent will log in with your saved credentials and fill the portal in using the student's profile and documents. It stops before the final submit — you confirm that separately.`,
      execute: async (args) => {
        const err = assertOwnApplication(String(args.applicationId));
        if (err) return err;
        try { return await queueSubmission(String(args.portalId), String(args.applicationId)); }
        catch (e) { return { error: e instanceof Error ? e.message : "Couldn't queue the submission." }; }
      },
    },
    {
      spec: {
        name: "confirm_portal_submission",
        description: "Give the final go-ahead for a submission that is awaiting_confirm (the portal is filled in and waiting). The counsellor must approve; only call this after they have said they reviewed the preview, and never on your own initiative.",
        parameters: { type: "object", properties: { submissionId: { type: "string" } }, required: ["submissionId"] },
      },
      requiresApproval: true,
      describe: () => "Send the final submit on the external portal. This applies to a real university / agent portal and can't be undone from here.",
      execute: async (args) => {
        try { return await confirmSubmission(String(args.submissionId)); }
        catch (e) { return { error: e instanceof Error ? e.message : "Couldn't confirm the submission." }; }
      },
    },
    {
      spec: {
        name: "read_attached_documents",
        description: "Read the documents the counsellor attached in this chat (passport, transcripts, certificates, English test reports, CV — images or text PDFs): classifies each and extracts a proposed profile (personal details, education, English tests, work). Nothing is saved. Call this first when the counsellor wants a student profile built from documents, then summarise what was found, flag gaps/warnings, and ask for anything missing (especially the student's email) before create_student_from_documents.",
        parameters: { type: "object", properties: {} },
      },
      execute: async () => {
        if (getStagedFiles().length === 0) return { error: "No documents are attached — ask the counsellor to attach the student's files with the paperclip button in the chat." };
        try {
          const r = await readStagedDocuments();
          if (!r.available) return { error: r.warnings[0] ?? "Document reading isn't available." };
          return { fileCount: r.fileCount, documents: r.documents.map((d) => ({ fileName: d.fileName, docType: d.docType, warnings: d.warnings })), proposedProfile: r.profile };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Couldn't read the documents." };
        }
      },
    },
    {
      spec: {
        name: "create_student_from_documents",
        description: "Create a new student assigned to the counsellor from the documents read by read_attached_documents: saves the extracted profile sections and files the documents in the student's vault. The counsellor must approve first (an approval card appears). Requires the student's email; name and country default to what the documents show. Never invent an email.",
        parameters: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, country: { type: "string" }, phone: { type: "string" } }, required: ["email"] },
      },
      requiresApproval: true,
      describe: (args) => describeProposal({ name: args.name as string | undefined, email: args.email as string | undefined, country: args.country as string | undefined }),
      execute: async (args) => {
        try {
          return await createStudentFromProposal({
            name: args.name as string | undefined, email: String(args.email), country: args.country as string | undefined, phone: args.phone as string | undefined,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Couldn't create the student." };
        }
      },
    },
    {
      spec: {
        name: "organise_document",
        description: "Re-label one of a caseload student's uploaded vault documents (new name and/or type, e.g. type \"Passport\") so it lands on the right checklist row. Only changes the label — never the file or its verification status. Use list_student_documents first to get document ids and decide the correct label.",
        parameters: { type: "object", properties: { studentId: { type: "string" }, documentId: { type: "string" }, name: { type: "string" }, type: { type: "string" } }, required: ["studentId", "documentId"] },
      },
      execute: async (args) => {
        const studentId = String(args.studentId);
        if (!inCaseload(studentId)) return { error: `Student "${studentId}" is not in your caseload.` };
        if (!loadCoreDocs(studentId).some((d) => d.id === args.documentId)) return { error: "That document isn't in this student's vault." };
        try {
          const d = await organiseCoreDoc(String(args.documentId), { name: args.name as string | undefined, type: args.type as string | undefined });
          return { id: d.id, name: d.name, type: d.type, status: d.status };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Couldn't update the document." };
        }
      },
    },
    {
      spec: {
        name: "create_task",
        description: "Create a task for a specific person (student, agent, admission officer, or yourself). Pass studentId for a task about a student in general, or applicationId for one about a specific application (optionally linked to a stage); at least one is required.",
        parameters: {
          type: "object",
          properties: {
            applicationId: { type: "string" },
            studentId: { type: "string" },
            title: { type: "string" },
            assignToRole: { type: "string", enum: ["student", "agent", "admission", "counsellor"] },
            assignToId: { type: "string" },
            assignToName: { type: "string" },
            stageType: { type: "string" },
            dueDate: { type: "string" },
            priority: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["title", "assignToRole", "assignToId", "assignToName"],
        },
      },
      execute: (args) => {
        if (!args.applicationId && !args.studentId) return { error: "Provide a studentId or an applicationId for the task." };
        let studentId: string | undefined;
        if (args.applicationId) {
          const err = assertOwnApplication(String(args.applicationId));
          if (err) return err;
          studentId = getAllApplications().find((a) => a.id === args.applicationId)?.studentId;
        } else {
          studentId = String(args.studentId);
          if (!loadAssignedStudents().some((s) => s.id === studentId)) return { error: `Student "${studentId}" is not in your caseload.` };
        }
        const assignedTo: TaskPerson = { id: String(args.assignToId), role: args.assignToRole as TaskPerson["role"], name: String(args.assignToName) };
        const assignedBy: TaskPerson = { id: counsellorId, role: "counsellor", name: ctx.userName };
        return addTask({
          title: String(args.title),
          assignedTo,
          assignedBy,
          dueDate: args.dueDate as string | undefined,
          applicationId: args.applicationId ? String(args.applicationId) : undefined,
          stageType: args.stageType as StageType | undefined,
          priority: args.priority as "low" | "medium" | "high" | undefined,
          studentId,
          studentName: loadAssignedStudents().find((s) => s.id === studentId)?.name,
        });
      },
    },
    {
      spec: {
        name: "request_document",
        description: "Request a document from the student for a specific stage of an application.",
        parameters: { type: "object", properties: { applicationId: { type: "string" }, stageType: { type: "string" }, documentType: { type: "string" } }, required: ["applicationId", "stageType", "documentType"] },
      },
      execute: (args) => {
        const err = assertOwnApplication(String(args.applicationId));
        if (err) return err;
        const doc = requestStageDocument(String(args.applicationId), args.stageType as StageType, String(args.documentType));
        addCustomDocRequest(String(args.applicationId), String(args.documentType));
        recordActivity({ applicationId: String(args.applicationId), stageType: args.stageType as StageType, action: "document_requested", newValue: args.documentType, performedBy: { id: counsellorId, role: "counsellor", name: ctx.userName } });
        return doc;
      },
    },
    {
      spec: {
        name: "add_application_note",
        description: "Post a comment on an application — visible to the student, their agent, and every other staff member on the case, and sent to each of their inboxes.",
        parameters: { type: "object", properties: { applicationId: { type: "string" }, note: { type: "string" }, stageType: { type: "string" } }, required: ["applicationId", "note"] },
      },
      execute: (args) => {
        const err = assertOwnApplication(String(args.applicationId));
        if (err) return err;
        return recordActivity({
          applicationId: String(args.applicationId),
          stageType: args.stageType as StageType | undefined,
          action: "comment_added",
          notes: String(args.note),
          performedBy: { id: counsellorId, role: "counsellor", name: ctx.userName },
        });
      },
    },
    {
      spec: {
        name: "update_task",
        description: "Toggle a task done/not-done, or update its due date or priority.",
        parameters: { type: "object", properties: { taskId: { type: "string" }, done: { type: "boolean" }, dueDate: { type: "string" }, priority: { type: "string", enum: ["low", "medium", "high"] } }, required: ["taskId"] },
      },
      execute: (args) => {
        if (typeof args.done === "boolean") toggleTaskDone(String(args.taskId));
        const patch: Record<string, unknown> = {};
        if (args.dueDate) patch.dueDate = args.dueDate;
        if (args.priority) patch.priority = args.priority;
        if (Object.keys(patch).length > 0) patchTask(String(args.taskId), patch);
        return { updated: true };
      },
    },
  ];

  return [...readTools, ...writeTools];
}
