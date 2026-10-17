import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DisplayTask } from "../../utils/taskBoard";

const SOURCE_LABEL: Record<DisplayTask["source"], string> = {
  manual: "Assigned",
  "next-step": "Next Step",
  document: "Document",
  review: "Review",
  finance: "Financial",
};

// Pure — returns where a task should open, or undefined when there's nowhere sensible to send it
// (e.g. a manual task with a studentId but no linked application). Used both to decide whether a
// row looks/behaves as clickable and to actually navigate, so those two can never disagree.
export type TaskTarget = { path: string; state?: unknown };
export type GetTaskTarget = (task: DisplayTask) => TaskTarget | undefined;

function GroupHeader({ label }: { label: string }) {
  return <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400 first:mt-0">{label}</p>;
}

function TaskRow({ task, getTaskTarget }: { task: DisplayTask; getTaskTarget?: GetTaskTarget }) {
  const navigate = useNavigate();
  const target = getTaskTarget?.(task);
  // A document, next-step, or finance task only exists while still outstanding (see taskBoard.ts's
  // documentTasksFor/nextStepTasksFor/financialReadinessTaskFor — each disappears the moment the
  // underlying thing is actually done), so all three are always something to act on — red, same as
  // every other "required" card in the app, not just when overdue. A review task (a counsellor's
  // "go confirm what Sarah uploaded") is a different kind of urgency — amber, matching the Pending
  // review section it points at, not red.
  const isRequiredTask = (task.source === "document" || task.source === "next-step" || task.source === "finance") && !task.done;
  const isReviewTask = task.source === "review" && !task.done;
  const cardClass = isRequiredTask
    ? "border-transparent bg-[var(--sd-card)] shadow-neu-inset-sm"
    : isReviewTask
      ? "border-transparent bg-[var(--sd-card)] shadow-neu-inset-sm"
      : "border-transparent bg-white";
  const textClass = isRequiredTask ? "text-neutral-900" : isReviewTask ? "text-neutral-800" : "text-neutral-800";
  const subtleClass = isRequiredTask ? "text-neutral-900" : isReviewTask ? "text-neutral-700" : "";
  const badgeClass = isRequiredTask
    ? "bg-[var(--sd-card)] shadow-neu-inset-sm text-neutral-900"
    : isReviewTask
      ? "bg-[var(--sd-card)] shadow-neu-inset-sm text-neutral-700"
      : "bg-neutral-100 text-neutral-500";
  const dotClass = isRequiredTask ? "bg-[var(--sd-card)] shadow-neu-inset-sm" : isReviewTask ? "bg-[var(--sd-card)] shadow-neu-inset-sm" : "bg-neutral-300";
  return (
    <div
      onClick={target ? () => navigate(target.path, { state: target.state }) : undefined}
      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${cardClass} ${task.done ? "opacity-60" : ""} ${target ? "cursor-pointer hover:bg-neutral-50" : ""}`}
    >
      {task.onToggle ? (
        <input
          type="checkbox"
          checked={task.done}
          onChange={task.onToggle}
          onClick={(e) => e.stopPropagation()}
          // A completed next step is locked (see applicationNextStepsStore.ts) — the toggle would
          // no-op anyway, but disabling it here avoids the checkbox visibly snapping back.
          disabled={task.source === "next-step" && task.done}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300"
        />
      ) : (
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${textClass} ${task.done ? "line-through" : ""}`}>{task.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
            {SOURCE_LABEL[task.source]}
          </span>
          {task.subtitle && <span className={subtleClass}>{task.subtitle}</span>}
          {task.assignedByName && <span>from {task.assignedByName}</span>}
          {task.dueDate && (
            <span className={task.tone === "overdue" ? "font-semibold text-neutral-900" : task.tone === "soon" ? "font-semibold text-neutral-700" : ""}>
              Due {new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>
      {task.onDelete && (
        <button onClick={(e) => { e.stopPropagation(); task.onDelete!(); }} aria-label="Delete task" className="shrink-0 text-neutral-300 hover:text-neutral-900">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

export function TaskListSection({ tasks, getTaskTarget }: { tasks: DisplayTask[]; getTaskTarget?: GetTaskTarget }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-neutral-400">No tasks here yet.</p>;
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
          {overdue.map((t) => <TaskRow key={t.id} task={t} getTaskTarget={getTaskTarget} />)}
        </>
      )}
      {soon.length > 0 && (
        <>
          <GroupHeader label="Due soon" />
          {soon.map((t) => <TaskRow key={t.id} task={t} getTaskTarget={getTaskTarget} />)}
        </>
      )}
      {rest.length > 0 && (
        <>
          <GroupHeader label="Upcoming" />
          {rest.map((t) => <TaskRow key={t.id} task={t} getTaskTarget={getTaskTarget} />)}
        </>
      )}
      {done.length > 0 && (
        <>
          <GroupHeader label="Done" />
          {done.map((t) => <TaskRow key={t.id} task={t} getTaskTarget={getTaskTarget} />)}
        </>
      )}
    </div>
  );
}
