import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DisplayTask } from "../../utils/taskBoard";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Presentational month grid — a dot per day with due tasks (rose if any are overdue), selecting a
 * day is entirely up to the caller (typically to show that day's task list alongside it). */
export function MonthCalendar({
  tasksByDate,
  selectedDate,
  onSelectDate,
}: {
  tasksByDate: Record<string, DisplayTask[]>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const [viewDate, setViewDate] = useState(() => {
    const d = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = toKey(new Date());

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          aria-label="Previous month"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-slate-800">
          {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          aria-label="Next month"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = toKey(d);
          const dayTasks = tasksByDate[key] ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const hasOverdue = dayTasks.some((t) => !t.done && t.tone === "overdue");
          return (
            <button
              key={i}
              onClick={() => onSelectDate(key)}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium transition ${
                isSelected ? "bg-[var(--sd-ink)] text-white" : isToday ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {d.getDate()}
              {dayTasks.length > 0 && (
                <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : hasOverdue ? "bg-rose-500" : "bg-[var(--sd-ink)]"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
