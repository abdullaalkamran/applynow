import { useEffect, useRef, useState } from "react";
import { Bookmark, Check } from "lucide-react";
import { isShortlistedFor, toggleShortlistFor, shortlistedStudentCountFor } from "../../data/agentShortlistStore";
import type { Student } from "../../types";

/** A bookmark control that shortlists a program for one or more of the agent's own students —
 * unlike the student app's single personal shortlist, the agent has to say *which* student, so
 * this opens a small student-picker instead of just toggling a boolean. */
export function ShortlistButton({
  students, universityId, universityName, courseName,
}: { students: Student[]; universityId: string; universityName: string; courseName: string }) {
  const [open, setOpen] = useState(false);
  const [, forceTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const count = shortlistedStudentCountFor(students, universityId, courseName);

  return (
    <div ref={containerRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Shortlist for a student"
        className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition ${
          count > 0 ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
        }`}
      >
        <Bookmark size={12} className={count > 0 ? "fill-current" : ""} />
        {count > 0 ? `Shortlisted (${count})` : "Shortlist"}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Shortlist for student</p>
          {students.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-slate-400">No students yet.</p>
          ) : (
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {students.map((s) => {
                const checked = isShortlistedFor(s.id, universityId, courseName);
                return (
                  <button
                    key={s.id}
                    onClick={() => { toggleShortlistFor(s.id, universityId, universityName, courseName); forceTick((t) => t + 1); }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>
                      {checked && <Check size={10} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{s.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
