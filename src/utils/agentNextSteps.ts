// Next steps are set by the counsellor, not the agent — this derives a read-only, agent-facing
// view of those open steps across a set of students' active applications, so the same task the
// counsellor laid out surfaces everywhere the agent needs it (application details, the Tasks tab,
// the dashboard) with its urgency intact.

import { loadNextSteps, dueDateTone, type NextStep } from "../data/applicationNextStepsStore";
import type { Application, Student } from "../types";

export interface AgentVisibleStep {
  id: string;
  title: string;
  studentId: string;
  studentName: string;
  applicationId: string;
  university: string;
  dueDate?: string;
  tone: ReturnType<typeof dueDateTone>;
}

function toVisible(ns: NextStep, student: Student, app: Application): AgentVisibleStep {
  return {
    id: ns.id,
    title: ns.title,
    studentId: student.id,
    studentName: student.name,
    applicationId: app.id,
    university: app.university,
    dueDate: ns.dueDate,
    tone: dueDateTone(ns.dueDate, ns.done),
  };
}

/** Open (not-done) counsellor next steps across every application in `apps`, newest urgency first
 * — overdue, then due soon, then the rest, undated steps last. */
export function loadOpenNextStepsFor(students: Student[], apps: Application[]): AgentVisibleStep[] {
  const rank: Record<AgentVisibleStep["tone"], number> = { overdue: 0, soon: 1, normal: 2, none: 3 };
  const steps: AgentVisibleStep[] = [];
  apps.forEach((app) => {
    const student = students.find((s) => s.id === app.studentId);
    if (!student) return;
    loadNextSteps(app.id).forEach((ns) => {
      if (!ns.done) steps.push(toVisible(ns, student, app));
    });
  });
  return steps.sort((a, b) => rank[a.tone] - rank[b.tone] || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}
