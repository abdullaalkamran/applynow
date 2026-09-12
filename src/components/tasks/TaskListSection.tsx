import { Trash2 } from "lucide-react";
import type { DisplayTask } from "../../utils/taskBoard";

const SOURCE_LABEL: Record<DisplayTask["source"], string> = {
  manual: "Assigned",
  "next-step": "Next Step",
  document: "Document",
};

function GroupHeader({ label }: { label: string }) {
  return <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400 first:mt-0">{label}</p>;
}

function TaskRow({ task }: { task: DisplayTask }) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2.5 ${task.done ? "opacity-60" : ""}`}>
      {task.onToggle ? (
        <input type="checkbox" checked={task.done} onChange={task.onToggle} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300" />
      ) : (
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium text-slate-800 ${task.done ? "line-through" : ""}`}>{task.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{SOURCE_LABEL[task.source]}</span>
          {task.subtitle && <span>{task.subtitle}</span>}
          {task.assignedByName && <span>from {task.assignedByName}</span>}
          {task.dueDate && (
            <span className={task.tone === "overdue" ? "font-semibold text-rose-600" : task.tone === "soon" ? "font-semibold text-amber-600" : ""}>
              Due {new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>
      {task.onDelete && (
        <button onClick={task.onDelete} aria-label="Delete task" className="shrink-0 text-slate-300 hover:text-rose-500">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

export function TaskListSection({ tasks }: { tasks: DisplayTask[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-slate-400">No tasks here yet.</p>;
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const overdue = open.filter((t) => t.tone === "overdue");
  const soon = open.filter((t) => t.tone === "soon");
  const rest = open.filter((t) => t.tone !== "overdue" && t.tone !== "soon");

  return (
    <div className="space-y-2">
      {overdue.length > 0 && (
        <>
          <GroupHeader label="Overdue" />
          {overdue.map((t) => <TaskRow key={t.id} task={t} />)}
        </>
      )}
      {soon.length > 0 && (
        <>
          <GroupHeader label="Due soon" />
          {soon.map((t) => <TaskRow key={t.id} task={t} />)}
        </>
      )}
      {rest.length > 0 && (
        <>
          <GroupHeader label="Upcoming" />
          {rest.map((t) => <TaskRow key={t.id} task={t} />)}
        </>
      )}
      {done.length > 0 && (
        <>
          <GroupHeader label="Done" />
          {done.map((t) => <TaskRow key={t.id} task={t} />)}
        </>
      )}
    </div>
  );
}
