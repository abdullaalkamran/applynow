// Who can assign a task to whom — deliberately one-directional and scoped to real working
// relationships (not a global "pick anyone" directory), matching how this app already models
// who works with whom (Student.agentId / Student.counsellorId).

import { COUNSELLORS, AGENTS } from "../data/mockData";
import { loadAssignedStudents } from "../data/counsellorStudentsStore";
import { loadAgentStudents } from "../data/agentStudentsStore";
import type { TaskPerson, TaskRole } from "../data/tasksStore";

export const ASSIGNABLE_ROLES: Record<TaskRole, TaskRole[]> = {
  counsellor: ["agent", "student", "admin"],
  admin: ["counsellor"],
  agent: ["student"],
  student: [],
};

const ADMIN_PERSON: TaskPerson = { id: "admin", role: "admin", name: "Admin" };

/** Everyone `from` is allowed to assign a task to, scoped to who they actually work with. */
export function recipientsFor(from: TaskPerson): TaskPerson[] {
  if (from.role === "counsellor") {
    const students = loadAssignedStudents();
    const studentPeople: TaskPerson[] = students.map((s) => ({ id: s.id, role: "student", name: s.name }));
    const agentIds = new Set(students.map((s) => s.agentId).filter((id): id is string => !!id));
    const agentPeople: TaskPerson[] = AGENTS.filter((a) => agentIds.has(a.id)).map((a) => ({ id: a.id, role: "agent", name: a.name }));
    return [...studentPeople, ...agentPeople, ADMIN_PERSON];
  }

  if (from.role === "admin") {
    return COUNSELLORS.map((c) => ({ id: c.id, role: "counsellor", name: c.name }));
  }

  if (from.role === "agent") {
    return loadAgentStudents().map((s) => ({ id: s.id, role: "student", name: s.name }));
  }

  return [];
}
