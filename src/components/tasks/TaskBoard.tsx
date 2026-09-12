import { useState } from "react";
import { Plus, List, Calendar as CalendarIcon } from "lucide-react";
import { MonthCalendar } from "./MonthCalendar";
import { TaskListSection } from "./TaskListSection";
import { AssignTaskModal } from "./AssignTaskModal";
import { recipientsFor } from "../../utils/taskAssignment";
import type { DisplayTask } from "../../utils/taskBoard";
import type { TaskPerson } from "../../data/tasksStore";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The shared Tasks-page body for every role: a List/Calendar toggle over the same `tasks`, plus
 * an "Assign Task" button (hidden when `from`'s role can't assign to anyone). */
export function TaskBoard({
  tasks,
  from,
  onChanged,
}: {
  tasks: DisplayTask[];
  from: TaskPerson;
  onChanged: () => void;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayKey());

  const canAssign = recipientsFor(from).length > 0;

  // Toggling/deleting a task mutates the underlying store directly (see utils/taskBoard.ts) but
  // that alone wouldn't re-render this component, since `tasks` is a prop computed by the parent —
  // wrap each action to also call `onChanged`, which the parent uses to recompute and re-pass tasks.
  const liveTasks = tasks.map((t) => ({
    ...t,
    onToggle: t.onToggle ? () => { t.onToggle!(); onChanged(); } : undefined,
    onDelete: t.onDelete ? () => { t.onDelete!(); onChanged(); } : undefined,
  }));

  const tasksByDate: Record<string, DisplayTask[]> = {};
  liveTasks.forEach((t) => {
    if (!t.dueDate) return;
    (tasksByDate[t.dueDate] ??= []).push(t);
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${view === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
          >
            <List size={13} /> List
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${view === "calendar" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
          >
            <CalendarIcon size={13} /> Calendar
          </button>
        </div>
        {canAssign && (
          <button
            onClick={() => setAssignOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--sd-ink)] px-3 py-2 text-xs font-semibold text-white"
          >
            <Plus size={14} /> Assign Task
          </button>
        )}
      </div>

      {view === "list" ? (
        <TaskListSection tasks={liveTasks} />
      ) : (
        <div className="space-y-4">
          <MonthCalendar tasksByDate={tasksByDate} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <TaskListSection tasks={tasksByDate[selectedDate] ?? []} />
          </div>
        </div>
      )}

      {assignOpen && (
        <AssignTaskModal
          from={from}
          onClose={() => setAssignOpen(false)}
          onCreated={() => {
            setAssignOpen(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
