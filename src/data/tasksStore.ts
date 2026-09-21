// Postgres-backed via /api/tasks (server/src/routes/tasks.js) — same synchronous-cache pattern as
// applicationsStore.ts. Manually assigned, cross-role tasks; also doubles as the Application →
// Enrolment workflow's task system via the optional applicationId/stageType/taskType/priority
// fields, exactly as before this migration.
import type { StageType } from "../types/journey";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";

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
  applicationId?: string;
  stageType?: StageType;
  taskType?: string;
  priority?: "low" | "medium" | "high";
  externalOwner?: string;
}

let cache: Task[] = [];
let refreshSeq = 0;

export async function refreshTasks(): Promise<void> {
  const seq = ++refreshSeq;
  const next = await apiGet<Task[]>("/api/tasks");
  // A slower, older response landing after a newer one must not win.
  if (seq !== refreshSeq) return;
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

/** All tasks visible to the current session, as of the last successful fetch/mutation. */
export function loadTasks(): Task[] {
  return cache;
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
  const prev = cache;
  cache = [...cache, task];
  notifyCacheChange();
  apiPost<Task>("/api/tasks", task)
    .then((serverTask) => {
      cache = cache.map((t) => (t.id === task.id ? serverTask : t));
      notifyCacheChange();
    })
    .catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to persist new task:", err);
    });
  return task;
}

export function patchTask(id: string, patch: Partial<Task>) {
  const prev = cache;
  cache = cache.map((t) => (t.id === id ? { ...t, ...patch } : t));
  notifyCacheChange();
  apiPatch(`/api/tasks/${id}`, patch).catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to persist task update:", err);
    });
}

export function toggleTaskDone(id: string) {
  const task = cache.find((t) => t.id === id);
  if (!task) return;
  patchTask(id, { done: !task.done });
}

export function removeTask(id: string) {
  const prev = cache;
  cache = cache.filter((t) => t.id !== id);
  notifyCacheChange();
  apiDelete(`/api/tasks/${id}`).catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to delete task on server:", err);
    });
}

/** Drops everything cached for the current session — called on logout/login (see warmCaches.ts)
 * so the next user on this browser never sees the previous one's data. */
export function clearTasksCache() {
  cache = [];
}
