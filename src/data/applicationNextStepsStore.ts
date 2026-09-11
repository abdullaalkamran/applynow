// Per-application next steps a counsellor lays out — a real to-do checklist scoped to one
// application, distinct from the single free-text "next action" field. Each step can be checked
// off, optionally has a due date, and the open ones also surface on the counsellor's main To Do List.

export interface NextStep {
  id: string;
  title: string;
  createdAt: string;
  done: boolean;
  dueDate?: string;
}

const STORAGE_PREFIX = "sd-application-next-steps:";

export function loadNextSteps(applicationId: string): NextStep[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + applicationId);
    return raw ? (JSON.parse(raw) as NextStep[]) : [];
  } catch {
    return [];
  }
}

function persist(applicationId: string, steps: NextStep[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + applicationId, JSON.stringify(steps));
}

export function addNextStep(applicationId: string, title: string, dueDate?: string): NextStep | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const step: NextStep = {
    id: `ns-${Date.now().toString(36)}`,
    title: trimmed,
    createdAt: new Date().toISOString().slice(0, 10),
    done: false,
    ...(dueDate ? { dueDate } : {}),
  };
  persist(applicationId, [...loadNextSteps(applicationId), step]);
  return step;
}

export function toggleNextStepDone(applicationId: string, stepId: string) {
  persist(applicationId, loadNextSteps(applicationId).map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)));
}

export function setNextStepDueDate(applicationId: string, stepId: string, dueDate: string) {
  persist(applicationId, loadNextSteps(applicationId).map((s) => (s.id === stepId ? { ...s, dueDate: dueDate || undefined } : s)));
}

export function removeNextStep(applicationId: string, stepId: string) {
  persist(applicationId, loadNextSteps(applicationId).filter((s) => s.id !== stepId));
}

/** "Overdue" / "Due soon" / "On track" classification for showing urgency. */
export function dueDateTone(dueDate: string | undefined, done: boolean): "overdue" | "soon" | "normal" | "none" {
  if (!dueDate) return "none";
  if (done) return "normal";
  const days = Math.round((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "normal";
}
