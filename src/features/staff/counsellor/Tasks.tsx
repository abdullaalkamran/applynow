import { useState } from "react";
import { TaskBoard } from "../../../components/tasks/TaskBoard";
import { getCounsellorTasks } from "../../../utils/taskBoard";
import { COUNSELLOR_ID } from "../../../utils/counsellorData";
import { COUNSELLORS } from "../../../data/mockData";

export default function CounsellorTasks() {
  const [, forceTick] = useState(0);
  const counsellor = COUNSELLORS.find((c) => c.id === COUNSELLOR_ID)!;
  const tasks = getCounsellorTasks(COUNSELLOR_ID);
  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
        <p className="mt-1 text-sm text-slate-500">{openCount} open task{openCount === 1 ? "" : "s"} across your students.</p>
      </div>

      <TaskBoard
        tasks={tasks}
        from={{ id: counsellor.id, role: "counsellor", name: counsellor.name }}
        onChanged={() => forceTick((t) => t + 1)}
      />
    </div>
  );
}
