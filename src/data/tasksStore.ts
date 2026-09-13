// Manually assigned, cross-role tasks — "I'm asking you to do this" rather than something derived
// automatically from an application's next steps or a missing document (see utils/taskBoard.ts for
// those). This is the only store where a Task is actually persisted; assignment is one-directional
// per utils/taskAssignment.ts (e.g. an agent can assign to a student, not the other way round).
//
// Also doubles as the Application → Enrolment workflow's task system (the PDF spec's
// `application_tasks`) via the optional applicationId/stageType/taskType/priority fields below,
// rather than a second parallel task store — utils/taskBoard.ts already merges manual tasks with
// application-next-step and missing-document tasks into one board per role, which is the exact
// generalization a stage-linked task needs.
import type { StageType } from "../types/journey";

export type TaskRole = "student" | "agent" | "counsellor" | "admin" | "admission";

export interface TaskPerson {
  id: string;
  role: TaskRole;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo: TaskPerson;
  assignedBy: TaskPerson;
  dueDate?: string; // YYYY-MM-DD
  done: boolean;
  createdAt: string; // ISO datetime
  studentId?: string;
  studentName?: string;
  // Application-workflow linkage — all optional so every existing manually-assigned task (with
  // none of these) keeps working unchanged.
  applicationId?: string;
  stageType?: StageType;
  taskType?: string;
  priority?: "low" | "medium" | "high";
  // For an owner that isn't a StudyOne account at all (e.g. "the university"), since TaskPerson
  // requires a role/id pair that only makes sense for real platform accounts.
  externalOwner?: string;
}

const RAFIQ: TaskPerson = { id: "a1", role: "agent", name: "Rafiq Hossain" };
const MARIA: TaskPerson = { id: "c1", role: "counsellor", name: "Maria Fernandez" };
const ADMIN_PERSON: TaskPerson = { id: "admin", role: "admin", name: "Admin" };

// Seeded against real people/students so every role's Tasks page has real content on first load —
// the agent's own former reminders (now self-assigned) plus one cross-role example per assignable
// pair, so "assigned by someone else" is visible immediately rather than only after someone
// creates one by hand.
const SEED_TASKS: Task[] = [
  { id: "t1", title: "Follow up on updated IELTS score", assignedTo: RAFIQ, assignedBy: RAFIQ, dueDate: "2026-09-12", done: false, createdAt: "2026-09-01T09:00:00.000Z", studentId: "s2", studentName: "Tomiwa Adeyemi" },
  { id: "t2", title: "Share intake options for MSc programs", assignedTo: RAFIQ, assignedBy: RAFIQ, dueDate: "2026-09-13", done: false, createdAt: "2026-09-01T09:00:00.000Z", studentId: "s11", studentName: "Rafid Tajwar" },
  { id: "t3", title: "Confirm deposit receipt with university", assignedTo: RAFIQ, assignedBy: RAFIQ, dueDate: "2026-09-15", done: false, createdAt: "2026-09-01T09:00:00.000Z", studentId: "s5", studentName: "Fatima Al-Sayed" },
  { id: "t4", title: "Register interest and open a case", assignedTo: RAFIQ, assignedBy: RAFIQ, dueDate: "2026-09-16", done: false, createdAt: "2026-09-01T09:00:00.000Z", studentId: "s12", studentName: "Meher Nabila" },
  { id: "t5", title: "Prep visa document pack before CAS is issued", assignedTo: RAFIQ, assignedBy: MARIA, dueDate: "2026-09-18", done: false, createdAt: "2026-09-05T09:00:00.000Z", studentId: "s1", studentName: "Sarah Khan" },
  { id: "t6", title: "Review this quarter's commission approvals before Friday", assignedTo: MARIA, assignedBy: ADMIN_PERSON, dueDate: "2026-09-19", done: false, createdAt: "2026-09-06T09:00:00.000Z" },
];

const CREATED_KEY = "tasks-created";
const OVERRIDES_KEY = "tasks-overrides";
const DELETED_KEY = "tasks-deleted-ids";

function loadCreated(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CREATED_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

function saveCreated(list: Task[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CREATED_KEY, JSON.stringify(list));
}

function loadOverrides(): Record<string, Partial<Task>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Partial<Task>>) : {};
  } catch {
    return {};
  }
}

function saveOverrides(map: Record<string, Partial<Task>>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(map));
}

function loadDeleted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DELETED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDeleted(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DELETED_KEY, JSON.stringify([...ids]));
}

/** All manually assigned tasks — seeded (with any edits applied, deletions removed) plus anything
 * created this session. */
export function loadTasks(): Task[] {
  const overrides = loadOverrides();
  const deleted = loadDeleted();
  const seedMerged = SEED_TASKS.filter((t) => !deleted.has(t.id)).map((t) => (overrides[t.id] ? { ...t, ...overrides[t.id] } : t));
  const created = loadCreated().filter((t) => !deleted.has(t.id));
  return [...seedMerged, ...created];
}

export function addTask(input: {
  title: string;
  description?: string;
  assignedTo: TaskPerson;
  assignedBy: TaskPerson;
  dueDate?: string;
  studentId?: string;
  studentName?: string;
  applicationId?: string;
  stageType?: StageType;
  taskType?: string;
  priority?: "low" | "medium" | "high";
  externalOwner?: string;
}): Task {
  const task: Task = {
    id: `tk-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    assignedTo: input.assignedTo,
    assignedBy: input.assignedBy,
    dueDate: input.dueDate || undefined,
    done: false,
    createdAt: new Date().toISOString(),
    studentId: input.studentId,
    studentName: input.studentName,
    applicationId: input.applicationId,
    stageType: input.stageType,
    taskType: input.taskType,
    priority: input.priority,
    externalOwner: input.externalOwner,
  };
  saveCreated([...loadCreated(), task]);
  return task;
}

export function patchTask(id: string, patch: Partial<Task>) {
  if (loadCreated().some((t) => t.id === id)) {
    saveCreated(loadCreated().map((t) => (t.id === id ? { ...t, ...patch } : t)));
    return;
  }
  const overrides = loadOverrides();
  overrides[id] = { ...overrides[id], ...patch };
  saveOverrides(overrides);
}

export function toggleTaskDone(id: string) {
  const task = loadTasks().find((t) => t.id === id);
  if (!task) return;
  patchTask(id, { done: !task.done });
}

export function removeTask(id: string) {
  if (loadCreated().some((t) => t.id === id)) {
    saveCreated(loadCreated().filter((t) => t.id !== id));
    return;
  }
  const deleted = loadDeleted();
  deleted.add(id);
  saveDeleted(deleted);
}
