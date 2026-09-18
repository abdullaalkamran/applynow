// The counsellor's AI tool registry — the real gap this feature closes. Every other role config in
// roleAssistantConfigs.ts had almost nothing; a counsellor managing the Application → Enrolment
// journey needs the full 17-read/4-write set the PDF spec describes, scoped strictly to their own
// caseload (loadAssignedStudents()) so a counsellor's assistant can never see or touch another
// counsellor's students, mirroring the id-validation discipline studentAssistantTools.ts already
// enforces for create_application.
import { loadAssignedStudents } from "../data/counsellorStudentsStore";
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

  const readTools: ToolDefinition[] = [
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
        name: "create_task",
        description: "Create a task for a specific person (student, agent, admission officer, or yourself) about an application, optionally linked to a stage.",
        parameters: {
          type: "object",
          properties: {
            applicationId: { type: "string" },
            title: { type: "string" },
            assignToRole: { type: "string", enum: ["student", "agent", "admission", "counsellor"] },
            assignToId: { type: "string" },
            assignToName: { type: "string" },
            stageType: { type: "string" },
            dueDate: { type: "string" },
            priority: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["applicationId", "title", "assignToRole", "assignToId", "assignToName"],
        },
      },
      execute: (args) => {
        const err = assertOwnApplication(String(args.applicationId));
        if (err) return err;
        const application = getAllApplications().find((a) => a.id === args.applicationId);
        const assignedTo: TaskPerson = { id: String(args.assignToId), role: args.assignToRole as TaskPerson["role"], name: String(args.assignToName) };
        const assignedBy: TaskPerson = { id: counsellorId, role: "counsellor", name: ctx.userName };
        return addTask({
          title: String(args.title),
          assignedTo,
          assignedBy,
          dueDate: args.dueDate as string | undefined,
          applicationId: String(args.applicationId),
          stageType: args.stageType as StageType | undefined,
          priority: args.priority as "low" | "medium" | "high" | undefined,
          studentId: application?.studentId,
          studentName: application ? loadAssignedStudents().find((s) => s.id === application.studentId)?.name : undefined,
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
        description: "Add a note to an application's activity timeline — visible to anyone reviewing the application later.",
        parameters: { type: "object", properties: { applicationId: { type: "string" }, note: { type: "string" }, stageType: { type: "string" } }, required: ["applicationId", "note"] },
      },
      execute: (args) => {
        const err = assertOwnApplication(String(args.applicationId));
        if (err) return err;
        return recordActivity({
          applicationId: String(args.applicationId),
          stageType: args.stageType as StageType | undefined,
          action: "note_added",
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
