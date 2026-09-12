export interface AgentTask {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  studentId?: string;
  subtitle: string;
}

// Seeded against the agent's own real students (see agentStudentsStore.ts) and their actual
// application statuses, rather than fictional placeholders.
const SEED_TASKS: AgentTask[] = [
  { id: "at1", date: "2026-09-12", title: "Follow up on updated IELTS score", subtitle: "Tomiwa Adeyemi", studentId: "s2" },
  { id: "at2", date: "2026-09-13", title: "Share intake options for MSc programs", subtitle: "Rafid Tajwar", studentId: "s11" },
  { id: "at3", date: "2026-09-15", title: "Confirm deposit receipt with university", subtitle: "Fatima Al-Sayed", studentId: "s5" },
  { id: "at4", date: "2026-09-16", title: "Register interest and open a case", subtitle: "Meher Nabila", studentId: "s12" },
];

const CUSTOM_KEY = "agent-custom-tasks";
const DONE_KEY = "agent-tasks-done";

function loadCustomTasks(): AgentTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    return raw ? (JSON.parse(raw) as AgentTask[]) : [];
  } catch {
    return [];
  }
}

/** Seeded tasks plus any added this session, date-sorted. */
export function loadAgentTasks(): AgentTask[] {
  return [...SEED_TASKS, ...loadCustomTasks()].sort((a, b) => a.date.localeCompare(b.date));
}

export function addAgentTask(input: Omit<AgentTask, "id">): AgentTask {
  const task: AgentTask = { ...input, id: `at-${Date.now().toString(36)}` };
  const custom = loadCustomTasks();
  custom.push(task);
  if (typeof window !== "undefined") window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
  return task;
}

export function loadDoneAgentTaskIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DONE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function toggleAgentTaskDone(id: string) {
  if (typeof window === "undefined") return;
  const ids = loadDoneAgentTaskIds();
  if (ids.has(id)) ids.delete(id); else ids.add(id);
  window.localStorage.setItem(DONE_KEY, JSON.stringify([...ids]));
}
