// Brings every kind of "thing someone needs to do" into one shape for the Tasks page: manually
// assigned tasks (tasksStore), counsellor-authored next steps (applicationNextStepsStore), and
// missing required documents (documentChecklist) — the latter two stay derived from their existing
// source of truth rather than being duplicated into tasksStore, so there's nothing to keep in sync.

import { loadTasks, toggleTaskDone, removeTask, type Task, type TaskPerson } from "../data/tasksStore";
import { loadNextSteps, toggleNextStepDone, dueDateTone as nextStepTone } from "../data/applicationNextStepsStore";
import { buildCoreChecklist, buildChecklist } from "./documentChecklist";
import { loadDocDueDate, dueDateTone as docTone } from "../data/documentDueDatesStore";
import { getAllApplications } from "../data/applicationsStore";
import { loadUploadedDocs } from "../data/applicationDocsStore";
import { getAllUniversities } from "../data/universityCatalogStore";
import { loadAssignedStudents } from "../data/counsellorStudentsStore";
import { loadAgentStudents } from "../data/agentStudentsStore";
import { STUDENTS } from "../data/mockData";
import type { Application, Student } from "../types";

export type TaskSource = "manual" | "next-step" | "document";
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
      tasks.push({
        id: `doc-core-${student.id}-${row.type}`,
        title: `Upload ${row.type}`,
        subtitle: `${student.name} · Core document`,
        done: false,
        source: "document",
        tone: "none",
        studentId: student.id,
      });
    });

  apps.forEach((app) => {
    const university = universities.find((u) => u.name === app.university);
    if (!university) return;
    const ownDocs = loadUploadedDocs(app.id);
    buildChecklist(university, student.id, app.id, ownDocs)
      .filter((row) => !row.own && !row.reused)
      .forEach((row) => {
        const dueDate = loadDocDueDate(app.id, row.type);
        tasks.push({
          id: `doc-${app.id}-${row.type}`,
          title: `Upload ${row.type}`,
          subtitle: `${student.name} · ${app.university}`,
          dueDate,
          done: false,
          source: "document",
          tone: docTone(dueDate),
          applicationId: app.id,
          studentId: student.id,
        });
      });
  });

  return tasks;
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
    ...students.flatMap((s) => documentTasksFor(s, apps.filter((a) => a.studentId === s.id))),
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
  if (task.source === "document") return { path, state: { tab: "Documents" } };
  return { path, state: { tab: "Overview" } };
}

export type { TaskPerson };
