import { useNavigate } from "react-router-dom";
import { useRef, type WheelEvent } from "react";
import { Trash2, Plus } from "lucide-react";
import type { DisplayTask } from "../../utils/taskBoard";
import type { GetTaskTarget } from "./TaskListSection";

const SOURCE_LABEL: Record<DisplayTask["source"], string> = {
  manual: "Assigned",
  "next-step": "Next Step",
  document: "Document",
};

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 3 days back through 10 ahead, same range as the Dashboard's date strip — far enough to be a
// genuine week-plus agenda, not just "today".
function buildDayRange(): Date[] {
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    return d;
  });
}

// A due date is the LAST day a task should be done by, not the one day it's allowed to appear.
// An incomplete task shows every day starting today: from today through its due date if that's
// still ahead (so it's on your radar well before the deadline, not sprung on you the day it's
// due), and every day from today onward with no end once the due date has actually passed and
// it's still not done. Completed tasks, and any column before today, still only show a task on
// its literal due date, so the calendar reads as real history there instead of repeating entries.
function showsOnColumn(task: DisplayTask, columnKey: string, todayKey: string): boolean {
  if (!task.dueDate) return false;
  if (task.done) return task.dueDate === columnKey;
  if (columnKey < todayKey) return task.dueDate === columnKey;
  if (task.dueDate < todayKey) return true; // already overdue — show every day from today on
  return columnKey <= task.dueDate; // not yet due — show every day from today through the due date
}

function TaskCard({ task, columnKey, getTaskTarget, muted = false }: { task: DisplayTask; columnKey: string; getTaskTarget?: GetTaskTarget; muted?: boolean }) {
  const navigate = useNavigate();
  const target = getTaskTarget?.(task);
  const dueLabel = !task.done && task.dueDate && task.dueDate !== columnKey
    ? `${task.dueDate < columnKey ? "Was due" : "Due"} ${new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
    : null;
  return (
    <div
      onClick={target ? () => navigate(target.path, { state: target.state }) : undefined}
      className={`rounded-lg border border-slate-100 bg-white p-2.5 ${muted ? "opacity-60" : ""} ${target ? "cursor-pointer hover:bg-slate-50" : ""}`}
    >
      <div className="flex items-start gap-2">
        {task.onToggle ? (
          <input
            type="checkbox"
            checked={task.done}
            onChange={task.onToggle}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300"
          />
        ) : (
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-[12.5px] font-medium text-slate-800 ${task.done ? "line-through" : ""}`}>{task.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] text-slate-400">
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500">{SOURCE_LABEL[task.source]}</span>
            {dueLabel && (
              <span className={`rounded-full px-1.5 py-0.5 font-medium ${dueLabel.startsWith("Was due") ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-600"}`}>
                {dueLabel}
              </span>
            )}
            {task.subtitle && <span className="truncate">{task.subtitle}</span>}
          </div>
          {task.assignedByName && <p className="mt-0.5 truncate text-[10.5px] text-slate-400">from {task.assignedByName}</p>}
        </div>
        {task.onDelete && (
          <button onClick={(e) => { e.stopPropagation(); task.onDelete!(); }} aria-label="Delete task" className="shrink-0 text-slate-300 hover:text-rose-500">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

/** A week-plus agenda: one column per date, each listing that date's tasks top to bottom — open
 * ones first, completed ones (dimmed) below them — instead of one month grid plus a single flat
 * list for whichever day happens to be selected. Tasks without a due date get their own leading
 * column so nothing silently disappears from the calendar view that the List view still shows.
 * Every real date column also gets its own "+" to add a task due that day. */
export function TaskColumnView({
  tasks, getTaskTarget, onAddTask,
}: { tasks: DisplayTask[]; getTaskTarget?: GetTaskTarget; onAddTask?: (date: string) => void }) {
  const days = buildDayRange();
  const todayKey = toKey(new Date());
  const undated = tasks.filter((t) => !t.dueDate);
  const rowRef = useRef<HTMLDivElement>(null);

  // A plain vertical mouse wheel does nothing on an overflow-x container by default (only a
  // horizontal trackpad swipe or shift+wheel does) — redirect vertical wheel delta into
  // horizontal scroll so scrolling through the columns works the way people actually try it. But
  // only when the pointer isn't over a column's own task list still able to scroll vertically —
  // otherwise this would hijack scrolling through a long list of tasks within one day.
  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const innerScroll = (e.target as HTMLElement).closest<HTMLElement>("[data-col-scroll]");
    if (innerScroll && innerScroll.scrollHeight > innerScroll.clientHeight) {
      const atTop = innerScroll.scrollTop <= 0;
      const atBottom = innerScroll.scrollTop + innerScroll.clientHeight >= innerScroll.scrollHeight - 1;
      if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) return;
    }
    const el = rowRef.current;
    if (!el) return;
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }

  return (
    <div ref={rowRef} onWheel={handleWheel} className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
      {undated.length > 0 && (
        <div className="flex w-64 shrink-0 flex-col rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
          <div className="border-b border-dashed border-slate-200 px-3 py-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">No due date</p>
          </div>
          <div data-col-scroll className="max-h-[560px] space-y-2 overflow-y-auto p-2">
            {undated.map((t) => (
              <TaskCard key={t.id} task={t} columnKey="" getTaskTarget={getTaskTarget} muted={t.done} />
            ))}
          </div>
        </div>
      )}

      {days.map((d) => {
        const key = toKey(d);
        const dayTasks = tasks.filter((t) => showsOnColumn(t, key, todayKey));
        const isToday = key === todayKey;
        return (
          <div key={key} className={`flex w-64 shrink-0 flex-col rounded-2xl border bg-white ${isToday ? "border-[var(--sd-ink)]" : "border-slate-200"}`}>
            <div className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${isToday ? "border-[var(--sd-ink)] bg-[image:var(--sd-gradient)] text-white" : "border-slate-100"}`}>
              <div className="min-w-0 flex-1 text-center">
                <p className={`text-[11px] font-medium ${isToday ? "text-white/70" : "text-slate-400"}`}>{d.toLocaleDateString(undefined, { weekday: "short" })}</p>
                <p className={`text-sm font-semibold ${isToday ? "text-white" : "text-slate-800"}`}>{d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
              </div>
              {onAddTask && (
                <button
                  onClick={() => onAddTask(key)}
                  aria-label={`Add task due ${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${isToday ? "text-white/80 hover:bg-white/10" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
            <div data-col-scroll className="max-h-[560px] space-y-2 overflow-y-auto p-2">
              {dayTasks.length === 0 ? (
                <p className="py-6 text-center text-[11px] text-slate-300">No tasks</p>
              ) : (
                dayTasks.map((t) => <TaskCard key={t.id} task={t} columnKey={key} getTaskTarget={getTaskTarget} muted={t.done} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
