import { useState } from "react";
import { MobileHeader } from "../../components/ui/mobile";
import { TaskBoard } from "../../components/tasks/TaskBoard";
import type { GetTaskTarget } from "../../components/tasks/TaskListSection";
import { getStudentTasks } from "../../utils/taskBoard";
import { getAllApplications } from "../../data/applicationsStore";
import { CURRENT_STUDENT_ID } from "../../data/mockData";
import { getAllStudents } from "../../data/allStudentsStore";

export default function StudentTasks() {
  const [, forceTick] = useState(0);
  const student = getAllStudents().find((s) => s.id === CURRENT_STUDENT_ID);
  const tasks = getStudentTasks(CURRENT_STUDENT_ID);
  const openCount = tasks.filter((t) => !t.done).length;
  // Financial Readiness is one shared record per student, not tied to a specific application (see
  // studentFinancialReadinessStore.ts), so its task has no applicationId of its own to route to —
  // any of the student's own applications shows the same shared status in its Overview tab.
  const fallbackApplicationId = getAllApplications().find((a) => a.studentId === CURRENT_STUDENT_ID)?.id;

  const getTaskTarget: GetTaskTarget = (task) => {
    if (task.applicationId) return { path: `/student/applications/${task.applicationId}` };
    if (task.source === "document") return { path: "/student/documents" };
    if (task.source === "finance" && fallbackApplicationId) return { path: `/student/applications/${fallbackApplicationId}` };
    return undefined;
  };

  if (!student) {
    return <p className="p-5 text-sm text-slate-400">Loading your tasks…</p>;
  }

  return (
    <div className="pb-8">
      <MobileHeader title="My Tasks" />
      <div className="px-5">
        <p className="-mt-2 mb-4 text-xs text-slate-500">{openCount} open task{openCount === 1 ? "" : "s"}.</p>
        <TaskBoard
          tasks={tasks}
          from={{ id: student.id, role: "student", name: student.name }}
          onChanged={() => forceTick((t) => t + 1)}
          getTaskTarget={getTaskTarget}
        />
      </div>
    </div>
  );
}
