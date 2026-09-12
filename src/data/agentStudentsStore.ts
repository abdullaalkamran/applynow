import { STUDENTS, CURRENT_AGENT_ID } from "./mockData";
import type { Student } from "../types";

const KEY = "agent-created-students";
const AVATAR_COLORS = ["bg-sky-500", "bg-rose-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-indigo-500", "bg-teal-500"];

function loadCreated(): Student[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Student[]) : [];
  } catch {
    return [];
  }
}

function persist(list: Student[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

/** All students referred by the demo agent — the seeded set plus any registered this session. */
export function loadAgentStudents(): Student[] {
  return [...STUDENTS.filter((s) => s.agentId === CURRENT_AGENT_ID), ...loadCreated()];
}

export function addAgentStudent(name: string, email: string, country: string): Student {
  const created = loadCreated();
  const student: Student = {
    id: `ast-${Date.now().toString(36)}`,
    name,
    email,
    country,
    agentId: CURRENT_AGENT_ID,
    avatarColor: AVATAR_COLORS[(STUDENTS.length + created.length) % AVATAR_COLORS.length],
    riskFlag: "none",
  };
  persist([...created, student]);
  return student;
}
