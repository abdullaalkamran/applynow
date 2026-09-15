import { useState } from "react";
import { Plus } from "lucide-react";
import { type GetTaskTarget } from "./TaskListSection";
import { TaskColumnView } from "./TaskColumnView";
import { AssignTaskModal } from "./AssignTaskModal";
import type { DisplayTask } from "../../utils/taskBoard";
import type { TaskPerson } from "../../data/tasksStore";

/** The shared Tasks-page body for every role: the date-column calendar over `tasks`, plus an
 * "Assign Task" button — either the general one up top, or one per calendar column that pre-fills
 * that column's date as the due date. Always available: at minimum, everyone can assign a task to
 * themselves (see AssignTaskModal), even a role with no one else to delegate to. */
export function TaskBoard({
  tasks,
  from,
  onChanged,
  getTaskTarget,
}: {
  tasks: DisplayTask[];
  from: TaskPerson;
  onChanged: () => void;
  // Where a task should open (application/student page) — omitted (e.g. for admin's
  // platform-wide tasks) when there's nowhere sensible for a task to open.
  getTaskTarget?: GetTaskTarget;
}) {
  // "" (general button, no pre-filled date), a date key (from a column's own add button), or null
  // (closed).
  const [assignOpen, setAssignOpen] = useState<string | null>(null);

  // Toggling/deleting a task mutates the underlying store directly (see utils/taskBoard.ts) but
  // that alone wouldn't re-render this component, since `tasks` is a prop computed by the parent —
  // wrap each action to also call `onChanged`, which the parent uses to recompute and re-pass tasks.
  const liveTasks = tasks.map((t) => ({
    ...t,
    onToggle: t.onToggle ? () => { t.onToggle!(); onChanged(); } : undefined,
    onDelete: t.onDelete ? () => { t.onDelete!(); onChanged(); } : undefined,
  }));

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setAssignOpen("")}
          className="flex items-center gap-1.5 rounded-lg bg-[image:var(--sd-gradient)] px-3 py-2 text-xs font-semibold text-white"
        >
          <Plus size={14} /> Assign Task
        </button>
      </div>

      <TaskColumnView tasks={liveTasks} getTaskTarget={getTaskTarget} onAddTask={(date) => setAssignOpen(date)} />

      {assignOpen !== null && (
        <AssignTaskModal
          from={from}
          initialDueDate={assignOpen || undefined}
          onClose={() => setAssignOpen(null)}
          onCreated={() => {
            setAssignOpen(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
