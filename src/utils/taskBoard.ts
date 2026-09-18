// Brings every kind of "thing someone needs to do" into one shape for the Tasks page: manually
// assigned tasks (tasksStore), counsellor-authored next steps (applicationNextStepsStore), and
// missing required documents (documentChecklist) — the latter two stay derived from their existing
// source of truth rather than being duplicated into tasksStore, so there's nothing to keep in sync.

import { loadTasks, toggleTaskDone, removeTask, type Task, type TaskPerson } from "../data/tasksStore";
import { loadNextSteps, toggleNextStepDone, dueDateTone as nextStepTone } from "../data/applicationNextStepsStore";
import { buildCoreChecklist, buildChecklist } from "./documentChecklist";
import { loadDocDueDate, dueDateTone as docTone } from "../data/documentDueDatesStore";
import { loadFinancialReadiness } from "../data/studentFinancialReadinessStore";
import { getAllApplications } from "../data/applicationsStore";
import { loadUploadedDocs } from "../data/applicationDocsStore";
import { getAllUniversities } from "../data/universityCatalogStore";
import { loadAssignedStudents } from "../data/counsellorStudentsStore";
import { loadAgentStudents } from "../data/agentStudentsStore";
import { STUDENTS } from "../data/mockData";
import type { Application, Student } from "../types";

export type TaskSource = "manual" | "next-step" | "document" | "review" | "finance";
export type TaskTone = "overdue" | "soon" | "normal" | "none";

export interface DisplayTask {
  id: string;
  title: string;
  subtitle?: string;
  dueDate?: string;
  done: boolean;
  source: TaskSource;
  tone: TaskTone;
  assignedByName?: string;
  onToggle?: () => void;
  applicationId?: string;
  studentId?: string;
  onDelete?: () => void;
}

function toDisplayTask(t: Task): DisplayTask {
  return {
    id: t.id,
    title: t.title,
    subtitle: t.studentName ? `For ${t.studentName}` : undefined,
    dueDate: t.dueDate,
    done: t.done,
    source: "manual",
    tone: nextStepTone(t.dueDate, t.done),
    assignedByName: t.assignedBy.name,
    studentId: t.studentId,
    applicationId: t.applicationId,
    onToggle: () => toggleTaskDone(t.id),
    onDelete: () => removeTask(t.id),
  };
}

function manualTasksFor(personId: string): DisplayTask[] {
  return loadTasks()
    .filter((t) => t.assignedTo.id === personId)
    .map(toDisplayTask);
}

/** Every manually assigned task scoped to one application — for the journey panel to show tasks
 * without a second data path from the one already rendered on every role's Tasks page. */
export function getApplicationTasks(applicationId: string): DisplayTask[] {
  return loadTasks()
    .filter((t) => t.applicationId === applicationId)
    .map(toDisplayTask);
}

function nextStepTasksFor(students: Student[], apps: Application[]): DisplayTask[] {
  const tasks: DisplayTask[] = [];
  apps.forEach((app) => {
    const student = students.find((s) => s.id === app.studentId);
    if (!student) return;
    loadNextSteps(app.id).forEach((ns) => {
      tasks.push({
        id: `ns-${ns.id}`,
        title: ns.title,
        subtitle: `${student.name} · ${app.university}`,
        dueDate: ns.dueDate,
        done: ns.done,
        source: "next-step",
        tone: nextStepTone(ns.dueDate, ns.done),
        applicationId: app.id,
        studentId: student.id,
        onToggle: () => toggleNextStepDone(app.id, ns.id),
      });
    });
  });
  return tasks;
}

/** Missing required documents (core + per-application) as view-only tasks — they disappear on
 * their own once uploaded, since they're recomputed from the live checklist each call. */
function documentTasksFor(student: Student, apps: Application[]): DisplayTask[] {
  const universities = getAllUniversities();
  const tasks: DisplayTask[] = [];

  buildCoreChecklist(student.id)
    .filter((row) => !row.own && !row.reused)
    .forEach((row) => {
      // A rejected upload is more urgent than a plain missing one — it's already blocked once and
      // needs the student's attention now, not just "eventually" — so it's flagged "overdue" and
      // carries the counsellor's reason, distinct from a document that was simply never provided.
      tasks.push({
        id: `doc-core-${student.id}-${row.type}`,
        title: row.rejected ? `Re-upload ${row.type} — rejected` : `Upload ${row.type}`,
        subtitle: row.rejected ? `${student.name} · ${row.rejected.reason || "Core document rejected"}` : `${student.name} · Core document`,
        done: false,
        source: "document",
        tone: row.rejected ? "overdue" : "none",
        studentId: student.id,
      });
    });

  apps.forEach((app) => {
    // buildChecklist tolerates `university` being undefined — a counsellor-requested item still
    // needs to surface as a task even when the university name doesn't resolve to a catalog entry.
    const university = universities.find((u) => u.name === app.university);
    const ownDocs = loadUploadedDocs(app.id);
    buildChecklist(university, student.id, app.id, ownDocs)
      .filter((row) => !row.own && !row.reused)
      .forEach((row) => {
        const dueDate = loadDocDueDate(app.id, row.type);
        tasks.push({
          id: `doc-${app.id}-${row.type}`,
          title: row.rejected ? `Re-upload ${row.type} — rejected` : `Upload ${row.type}`,
          subtitle: row.rejected ? `${student.name} · ${row.rejected.reason || "Document rejected"}` : `${student.name} · ${app.university}`,
          dueDate,
          done: false,
          source: "document",
          tone: row.rejected ? "overdue" : docTone(dueDate),
          applicationId: app.id,
          studentId: student.id,
        });
      });
  });

  return tasks;
}

/** One task per student with 1+ documents awaiting review — deliberately not one task per
 * document, so a student uploading several things at once doesn't flood the counsellor's Tasks
 * page with near-identical entries. Recomputed from the live checklist on every call, same as
 * documentTasksFor, so it disappears on its own once every one of that student's pending
 * documents has been approved or rejected — there's nothing to separately mark done besides
 * actually reviewing them, so it carries no onToggle. Counsellor-only: they're the one responsible
 * for approving/rejecting a document, not the agent. */
function reviewTasksFor(student: Student, apps: Application[]): DisplayTask[] {
  const universities = getAllUniversities();
  const corePending = buildCoreChecklist(student.id).filter((row) => row.own?.status === "uploaded").length;
  const appPending = apps.reduce((sum, app) => {
    const university = universities.find((u) => u.name === app.university);
    const ownDocs = loadUploadedDocs(app.id);
    return sum + buildChecklist(university, student.id, app.id, ownDocs).filter((row) => row.own?.status === "uploaded").length;
  }, 0);
  const pending = corePending + appPending;
  if (pending === 0) return [];
  return [
    {
      id: `review-${student.id}`,
      title: `Review ${pending} document${pending === 1 ? "" : "s"} from ${student.name}`,
      subtitle: `${student.name} uploaded ${pending === 1 ? "a document" : `${pending} documents`} — confirm or reject`,
      done: false,
      source: "review",
      tone: "none",
      studentId: student.id,
    },
  ];
}

/** One task per student with 1+ still-missing required documents — deliberately not one task per
 * document, same "flood of near-identical entries" problem reviewTasksFor solves for pending
 * review, but for the counsellor's Tasks page specifically. The student's and agent's own task
 * lists keep the itemised, per-document version (documentTasksFor) below — a student needs to know
 * exactly what to upload, not just that something is missing, and an agent chasing a specific
 * document needs the same. Built from documentTasksFor's own output rather than re-deriving the
 * checklist, so its tone/due date reflect whichever single underlying item is most urgent (a
 * rejected upload counts as most urgent) instead of hiding that signal behind a plain count.
 * Recomputed live, so it disappears on its own once every one of that student's required documents
 * has actually been uploaded — there's nothing to separately mark done besides uploading them, so
 * it carries no onToggle. */
function requiredDocsTaskFor(student: Student, apps: Application[]): DisplayTask[] {
  const items = documentTasksFor(student, apps);
  if (items.length === 0) return [];

  const toneRank: Record<TaskTone, number> = { overdue: 0, soon: 1, normal: 2, none: 3 };
  const worstTone = items.reduce<TaskTone>((worst, t) => (toneRank[t.tone] < toneRank[worst] ? t.tone : worst), "none");
  const earliestDue = items.map((t) => t.dueDate).filter((d): d is string => !!d).sort()[0];
  const rejectedCount = items.filter((t) => t.title.startsWith("Re-upload")).length;

  return [
    {
      id: `docs-required-${student.id}`,
      title: `${items.length} document${items.length === 1 ? "" : "s"} needed from ${student.name}`,
      subtitle:
        rejectedCount > 0
          ? `Includes ${rejectedCount} rejected upload${rejectedCount === 1 ? "" : "s"} needing re-upload`
          : `Still missing ${items.length === 1 ? "a document" : `${items.length} documents`}`,
      dueDate: earliestDue,
      done: false,
      source: "document",
      tone: worstTone,
      studentId: student.id,
    },
  ];
}

/** One automatic task per student whose shared Financial Readiness record (see
 * studentFinancialReadinessStore.ts) hasn't reached a "Ready"/"Matured" bank status yet — appears
 * the moment a student profile exists (a fresh student has no record at all, which counts as
 * incomplete) and disappears on its own the moment it's set to a completed state from any one of
 * that student's applications, since that single shared record is what every application's
 * Financial Readiness stage now reads from. Surfaced to both the counsellor (who fills it in) and
 * the student (whose task it fundamentally is) — same id and content either way, just shown on two
 * different Tasks pages. No onToggle for the same reason every other derived task here has none:
 * filling it in is what completes it, not a checkbox. */
function financialReadinessTaskFor(student: Student): DisplayTask[] {
  const record = loadFinancialReadiness(student.id);
  if (record?.completedAt) return [];
  return [
    {
      id: `finready-${student.id}`,
      title: `Fill Financial Readiness info for ${student.name}`,
      subtitle: `${student.name} · Bank balance evidence not yet confirmed`,
      done: false,
      source: "finance",
      tone: "none",
      studentId: student.id,
    },
  ];
}

function sortTasks(tasks: DisplayTask[]): DisplayTask[] {
  const rank: Record<TaskTone, number> = { overdue: 0, soon: 1, normal: 2, none: 3 };
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return rank[a.tone] - rank[b.tone] || (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  });
}

export function getCounsellorTasks(personId: string): DisplayTask[] {
  const students = loadAssignedStudents();
  const apps = getAllApplications().filter((a) => students.some((s) => s.id === a.studentId));
  return sortTasks([
    ...manualTasksFor(personId),
    ...nextStepTasksFor(students, apps),
    ...students.flatMap((s) => requiredDocsTaskFor(s, apps.filter((a) => a.studentId === s.id))),
    ...students.flatMap((s) => reviewTasksFor(s, apps.filter((a) => a.studentId === s.id))),
    ...students.flatMap((s) => financialReadinessTaskFor(s)),
  ]);
}

export function getAgentTasks(personId: string): DisplayTask[] {
  const students = loadAgentStudents();
  const apps = getAllApplications().filter((a) => students.some((s) => s.id === a.studentId));
  return sortTasks([
    ...manualTasksFor(personId),
    ...nextStepTasksFor(students, apps),
    ...students.flatMap((s) => documentTasksFor(s, apps.filter((a) => a.studentId === s.id))),
  ]);
}

export function getStudentTasks(studentId: string): DisplayTask[] {
  const student = STUDENTS.find((s) => s.id === studentId);
  if (!student) return sortTasks(manualTasksFor(studentId));
  const apps = getAllApplications().filter((a) => a.studentId === studentId);
  return sortTasks([
    ...manualTasksFor(studentId),
    ...nextStepTasksFor([student], apps),
    ...documentTasksFor(student, apps),
    ...financialReadinessTaskFor(student),
  ]);
}

export function getAdminTasks(personId: string): DisplayTask[] {
  return sortTasks(manualTasksFor(personId));
}

export interface TaskTarget {
  path: string;
  state?: unknown;
}

/** Where clicking a task on a staff role's (counsellor/agent) Tasks page should land — the exact
 * application when the task is actually about one (a next-step, or a per-application document
 * requirement — both carry `applicationId`), the Documents tab when it's a core-document task with
 * no application of its own, or otherwise the student's own profile (a "lead" with no application
 * yet is still a real student record, so their Overview tab is "that lead's page"). */
export function staffTaskTarget(task: DisplayTask, studentsBasePath: string): TaskTarget | undefined {
  if (!task.studentId) return undefined;
  const path = `${studentsBasePath}/${task.studentId}`;
  if (task.applicationId) return { path, state: { tab: "Applications", appId: task.applicationId } };
  if (task.source === "document" || task.source === "review") return { path, state: { tab: "Documents" } };
  // Financial Readiness is edited from within an application's own Journey panel (Applications
  // tab) — there's no applicationId on this task since it's one shared record per student, not
  // tied to a specific application, so it just opens the tab rather than a specific one.
  if (task.source === "finance") return { path, state: { tab: "Applications" } };
  return { path, state: { tab: "Overview" } };
}

export type { TaskPerson };
