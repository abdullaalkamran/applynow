// The two entry cards on a course page: academic requirements and English requirements.
// Academic = the university's list for the course's level plus anything the course itself adds;
// English = the course's own tests when it sets any, otherwise the university's for that level.
// Shared by every role's course view so Undergraduate and Postgraduate courses both show them.
import type { ReactNode } from "react";
import { CheckCircle2, GraduationCap, ListChecks, Languages } from "lucide-react";
import type { University } from "../types";
import { EnglishTestNotices } from "./EnglishTestNotices";

type Course = University["courses"][number];

export function CourseEntryCards({
  university, course, variant = "neu",
}: {
  university: University;
  course: Course;
  variant?: "neu" | "plain";
}) {
  const key = course.level === "Undergraduate" ? "undergraduate" : "postgraduate";
  const levelLabel = course.level === "Undergraduate" ? "undergraduate" : "postgraduate";
  const academic = [...new Set([...(university.requirements?.[key] ?? []), ...(course.requirements ?? [])])];
  const english = (course.englishRequirements?.length ? course.englishRequirements : university.englishRequirements?.[key]) ?? [];
  const tests = course.standardizedTests ?? [];
  const wrap = (icon: ReactNode, title: string, children: ReactNode) => (
    <div className={variant === "neu" ? "rounded-2xl bg-[var(--sd-card)] p-4 shadow-neu" : "rounded-xl border border-slate-200 bg-white p-4"}>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">{icon} {title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
  const rowCls = variant === "neu" ? "" : "rounded-lg bg-slate-50 px-3 py-2";

  return (
    <div className="space-y-4">
      {wrap(<ListChecks size={15} />, "Academic Entry Requirements", (
        <div className="space-y-2">
          {!!university.minGPA && (
            <div className={`flex items-center justify-between text-[13px] text-neutral-600 ${rowCls}`}>
              <span>Minimum GPA</span>
              <span className="font-semibold text-neutral-800">{university.minGPA.toFixed(1)} / 4.0</span>
            </div>
          )}
          {academic.map((r) => (
            <div key={r} className={`flex items-start gap-2 text-[13px] text-neutral-600 ${rowCls}`}>
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[var(--sd-teal,#14b8a6)]" /> {r}
            </div>
          ))}
          {tests.length > 0 && (
            <div className={`flex items-start gap-2 text-[13px] text-neutral-600 ${rowCls}`}>
              <GraduationCap size={15} className="mt-0.5 shrink-0 text-[var(--sd-teal,#14b8a6)]" /> Admission test: {tests.join(", ")}
            </div>
          )}
          {academic.length === 0 && !university.minGPA && tests.length === 0 && (
            <p className="text-xs text-neutral-400">No {levelLabel} academic requirements added yet.</p>
          )}
        </div>
      ))}
      {wrap(<Languages size={15} />, "English Language Requirements", (
        <>
          <EnglishTestNotices university={university} showMoi={course.level !== "Undergraduate"} className="mb-3" />
          {english.length === 0 ? (
            <p className="text-xs text-neutral-500">
              {university.minIELTS ? `Minimum IELTS ${university.minIELTS} overall — no other tests listed.` : `No ${levelLabel} English requirements added yet.`}
            </p>
          ) : (
            <div className="space-y-1.5">
              {english.map((e, i) => (
                <div key={i} className={`text-[13px] ${variant === "neu" ? "rounded-lg shadow-neu-inset-sm px-3 py-2" : "rounded-lg bg-slate-50 px-3 py-2"}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-neutral-700">{e.testName}</p>
                    {e.minScore && <span className="font-semibold text-neutral-800">{e.minScore}</span>}
                  </div>
                  {(e.skillScores ?? []).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {e.skillScores!.map((s, si) => (
                        <span key={si} className="rounded-md px-2 py-0.5 text-xs text-neutral-500 ring-1 ring-neutral-200">
                          {s.skill} <span className="font-semibold text-neutral-700">{s.score}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ))}
    </div>
  );
}
