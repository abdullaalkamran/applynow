import { useState } from "react";
import { TaskBoard } from "../../../components/tasks/TaskBoard";
import type { GetTaskTarget } from "../../../components/tasks/TaskListSection";
import { BackButton } from "../../../components/ui";
import { getCounsellorTasks, staffTaskTarget } from "../../../utils/taskBoard";
import { COUNSELLOR_ID } from "../../../utils/counsellorData";
import { COUNSELLORS } from "../../../data/mockData";

const getTaskTarget: GetTaskTarget = (task) => staffTaskTarget(task, "/staff/counsellor/students");

export default function CounsellorTasks() {
  const [, forceTick] = useState(0);
  const counsellor = COUNSELLORS.find((c) => c.id === COUNSELLOR_ID)!;
  const tasks = getCounsellorTasks(COUNSELLOR_ID);
  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div>
      <BackButton fallback="/staff/counsellor" />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
        <p className="mt-1 text-sm text-slate-500">{openCount} open task{openCount === 1 ? "" : "s"} across your students.</p>
      </div>

      <TaskBoard
        tasks={tasks}
        from={{ id: counsellor.id, role: "counsellor", name: counsellor.name }}
        onChanged={() => forceTick((t) => t + 1)}
        getTaskTarget={getTaskTarget}
      />
    </div>
  );
}
