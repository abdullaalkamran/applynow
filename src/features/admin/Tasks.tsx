import { useState } from "react";
import { TaskBoard } from "../../components/tasks/TaskBoard";
import { getAdminTasks } from "../../utils/taskBoard";

const ADMIN_PERSON = { id: "admin", role: "admin" as const, name: "Admin" };

export default function AdminTasks() {
  const [, forceTick] = useState(0);
  const tasks = getAdminTasks(ADMIN_PERSON.id);
  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
        <p className="mt-1 text-sm text-slate-500">{openCount} open task{openCount === 1 ? "" : "s"} assigned to Admin.</p>
      </div>

      <TaskBoard tasks={tasks} from={ADMIN_PERSON} onChanged={() => forceTick((t) => t + 1)} />
    </div>
  );
}
