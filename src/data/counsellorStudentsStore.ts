import { STUDENTS } from "./mockData";
import { COUNSELLOR_ID } from "../utils/counsellorData";
import type { Student } from "../types";

const KEY = "staff-created-students";
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

/** All students the demo counsellor should see — those directly assigned to them, plus any
 * agent-referred student who hasn't been claimed by a counsellor yet (so referral leads and
 * applications from an agent partner are visible to work, not stuck waiting on an assignment
 * step this demo doesn't model) — plus anyone added this session. */
export function loadAssignedStudents(): Student[] {
  return [
    ...STUDENTS.filter((s) => s.counsellorId === COUNSELLOR_ID || (!s.counsellorId && !!s.agentId)),
    ...loadCreated(),
  ];
}

export function addStudent(name: string, email: string, country: string): Student {
  const created = loadCreated();
  const student: Student = {
    id: `st-${Date.now().toString(36)}`,
    name,
    email,
    country,
    counsellorId: COUNSELLOR_ID,
    avatarColor: AVATAR_COLORS[(STUDENTS.length + created.length) % AVATAR_COLORS.length],
    riskFlag: "none",
  };
  persist([...created, student]);
  return student;
}
