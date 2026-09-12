import { useState } from "react";
import { MobileHeader } from "../../components/ui/mobile";
import { TaskBoard } from "../../components/tasks/TaskBoard";
import { getStudentTasks } from "../../utils/taskBoard";
import { STUDENTS, CURRENT_STUDENT_ID } from "../../data/mockData";

export default function StudentTasks() {
  const [, forceTick] = useState(0);
  const student = STUDENTS.find((s) => s.id === CURRENT_STUDENT_ID)!;
  const tasks = getStudentTasks(CURRENT_STUDENT_ID);
  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div className="pb-8">
      <MobileHeader title="My Tasks" />
      <div className="px-5">
        <p className="-mt-2 mb-4 text-xs text-slate-500">{openCount} open task{openCount === 1 ? "" : "s"}.</p>
        <TaskBoard
          tasks={tasks}
          from={{ id: student.id, role: "student", name: student.name }}
          onChanged={() => forceTick((t) => t + 1)}
        />
      </div>
    </div>
  );
}
