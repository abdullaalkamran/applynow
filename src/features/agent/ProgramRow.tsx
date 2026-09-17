import { useNavigate } from "react-router-dom";
import { ChevronRight, Wallet, CalendarDays, GraduationCap, AlertTriangle } from "lucide-react";
import { LogoBadge } from "../../components/ui/mobile";
import { scholarshipAmountUSD, courseHasOpenIntake } from "../../utils/universityFilter";
import { ShortlistButton } from "./ShortlistButton";
import type { Student, University } from "../../types";

type Course = University["courses"][number];

/** One program (a course at a university) — the shared row used by the Programs tab of the
 * Universities browse page and by the per-subject page, so both look and behave identically. */
export function ProgramRow({
  university, course, students, onApply,
}: { university: University; course: Course; students: Student[]; onApply: (university: University, course: Course) => void }) {
  const navigate = useNavigate();
  const scholarship = scholarshipAmountUSD(university, course.feeUSD);
  const openDetail = () => navigate(`/agent/universities/${university.id}`, { state: { selectedCourseName: course.name, subject: course.subject } });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(e) => { if (e.key === "Enter") openDetail(); }}
      className="flex cursor-pointer flex-col gap-2.5 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)] transition hover:border-slate-200 hover:shadow-[0_2px_14px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-start gap-3">
        <LogoBadge name={university.name} tone={university.tone} logoUrl={university.logoUrl} className="h-11 w-11 shrink-0 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-slate-400">{university.name}</p>
          <p className="truncate text-xs font-semibold text-slate-800">{course.name}</p>
        </div>
        <ChevronRight size={16} className="mt-1 shrink-0 text-slate-300" />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><Wallet size={11} /> ${course.feeUSD.toLocaleString()}/yr</span>
        <span className="flex items-center gap-1"><CalendarDays size={11} /> {university.openIntake}</span>
        {scholarship !== null && (
          <span className="flex items-center gap-1 text-emerald-600"><GraduationCap size={11} /> Up to ${scholarship.toLocaleString()}</span>
        )}
        {(university.restrictedRegions ?? []).length > 0 && (
          <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={11} /> Restricted regions</span>
        )}
        {university.internalEnglishTestOffered && (
          <span className="flex items-center gap-1 text-emerald-600"><GraduationCap size={11} /> Own English test</span>
        )}
        {course.level !== "Undergraduate" && university.moiAccepted && (
          <span className="flex items-center gap-1 text-emerald-600"><GraduationCap size={11} /> MOI accepted</span>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-2.5">
        <button onClick={openDetail} className="text-[11px] font-medium text-blue-600">
          University Profile →
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <ShortlistButton students={students} universityId={university.id} universityName={university.name} courseName={course.name} />
          <button
            onClick={() => onApply(university, course)}
            disabled={!courseHasOpenIntake(university, course)}
            className="rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            {courseHasOpenIntake(university, course) ? "Apply" : "Intake Closed"}
          </button>
        </div>
      </div>
    </div>
  );
}
