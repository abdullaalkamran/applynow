import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { loadTasks } from "../../data/tasksStore";
import { getAllApplications } from "../../data/applicationsStore";
import { getAllStudents } from "../../data/allStudentsStore";

interface CalEvent {
  key: string;
  date: string; // YYYY-MM-DD
  label: string;
  tone: "rose" | "blue" | "green" | "slate";
  path: string;
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TONE: Record<CalEvent["tone"], string> = {
  rose: "bg-[#fdecef] text-[#c81e4a]",
  blue: "bg-[#e8f1fd] text-[#2563eb]",
  green: "bg-[#e6f6ec] text-[#15803d]",
  slate: "bg-slate-100 text-slate-600",
};

/** Month view of everything with a date on it: task due dates (open ones red once overdue) and
 * application intake months. */
export default function AdminCalendar() {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const today = ymd(new Date());

  const events = useMemo(() => {
    const out: CalEvent[] = [];
    const students = new Map(getAllStudents().map((s) => [s.id, s.name]));
    for (const t of loadTasks()) {
      if (!t.dueDate) continue;
      out.push({
        key: `t-${t.id}`,
        date: t.dueDate,
        label: t.title,
        tone: t.done ? "slate" : t.dueDate < today ? "rose" : "blue",
        path: "/admin/tasks",
      });
    }
    for (const a of getAllApplications()) {
      // Intakes are stored as e.g. "September 2026" — pin them to the 1st of that month.
      const m = /^(\w+)\s+(\d{4})$/.exec(a.intake ?? "");
      if (!m) continue;
      const d = new Date(`${m[1]} 1, ${m[2]}`);
      if (Number.isNaN(d.getTime())) continue;
      out.push({
        key: `a-${a.id}`,
        date: ymd(d),
        label: `${students.get(a.studentId) ?? "Student"} · ${a.university} intake`,
        tone: "green",
        path: "/admin/applications",
      });
    }
    return out;
  }, [today]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [events]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7) cells.push(null);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900">Calendar</h1>
          <p className="mt-1 text-[12px] text-slate-500">Task due dates and application intakes, month by month.</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"><ChevronLeft size={16} /></button>
          <span className="min-w-[140px] text-center text-[12px] font-semibold text-slate-800">{MONTH_FMT.format(cursor)}</span>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-[#f6f8fb] text-center text-[12px] font-medium text-slate-500">
          {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const key = d ? ymd(d) : "";
            const dayEvents = d ? byDate.get(key) ?? [] : [];
            const isToday = key === today;
            return (
              <div key={i} className={`min-h-[84px] border-b border-r border-slate-100 p-1.5 md:min-h-[104px] ${d ? "" : "bg-slate-50/60"}`}>
                {d && (
                  <>
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${isToday ? "bg-[#0b5d3d] font-semibold text-white" : "text-slate-600"}`}>{d.getDate()}</span>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 3).map((e) => (
                        <button key={e.key} onClick={() => navigate(e.path)} title={e.label} className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${TONE[e.tone]}`}>
                          {e.label}
                        </button>
                      ))}
                      {dayEvents.length > 3 && <p className="px-1 text-[10.5px] text-slate-400">+{dayEvents.length - 3} more</p>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
