// Academic + English entry requirements, split by degree level (Bachelor's/Undergraduate vs.
// Postgraduate) — a university's admissions criteria for the two rarely match, so this replaces
// what used to be one shared list with a level switcher. Shared across every role's University
// Detail "Requirements" tab (see UniversityForm.tsx for where Data Management enters this).
import { useState } from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";

export interface EnglishTestRequirement {
  testName: string;
  minScore?: string;
  skillScores?: { skill: string; score: string }[];
}

export interface RequirementCourse {
  id: string;
  name: string;
  level: string;
  feeUSD: number;
}

const LEVELS = ["Undergraduate", "Postgraduate"] as const;
type Level = (typeof LEVELS)[number];

export function EntryRequirementsView({
  requirements, englishRequirements, minIELTS, courses, currencySymbol = "$", onSelectCourse,
}: {
  requirements: { undergraduate: string[]; postgraduate: string[] };
  englishRequirements?: { undergraduate: EnglishTestRequirement[]; postgraduate: EnglishTestRequirement[] };
  minIELTS?: number;
  // Optional — when given, shows which of the university's courses these requirements actually
  // apply to. The Postgraduate tab matches anything that isn't Undergraduate ("PG and above"), so
  // a level beyond the current two (e.g. a future Doctorate) still lands somewhere sensible without
  // this needing to know every level name in advance.
  courses?: RequirementCourse[];
  currencySymbol?: string;
  onSelectCourse?: (courseId: string) => void;
}) {
  const [level, setLevel] = useState<Level>("Undergraduate");
  const key = level === "Undergraduate" ? "undergraduate" : "postgraduate";
  const academic = requirements[key];
  const english = englishRequirements?.[key] ?? [];
  const levelCourses = courses?.filter((c) => (level === "Undergraduate" ? c.level === "Undergraduate" : c.level !== "Undergraduate"));

  return (
    <div>
      <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        {LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              level === l ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {courses && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {level === "Undergraduate" ? "Undergraduate" : "Postgraduate & above"} Courses
            </p>
            <div className="space-y-1.5">
              {levelCourses!.map((c) => {
                const Tag = onSelectCourse ? "button" : "div";
                return (
                  <Tag
                    key={c.id}
                    onClick={onSelectCourse ? () => onSelectCourse(c.id) : undefined}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left text-xs ${onSelectCourse ? "hover:bg-slate-100" : ""}`}
                  >
                    <span className="font-medium text-slate-700">{c.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-slate-500">
                      {currencySymbol}{c.feeUSD.toLocaleString()}/yr
                      {onSelectCourse && <ChevronRight size={13} className="text-slate-300" />}
                    </span>
                  </Tag>
                );
              })}
              {levelCourses!.length === 0 && (
                <p className="text-xs text-slate-400">No {level === "Undergraduate" ? "undergraduate" : "postgraduate"} courses added yet.</p>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Academic Requirements</p>
          <div className="space-y-2">
            {academic.map((r) => (
              <div key={r} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <CheckCircle2 size={14} className="shrink-0 text-emerald-500" /> {r}
              </div>
            ))}
            {academic.length === 0 && <p className="text-xs text-slate-400">No {level.toLowerCase()} academic requirements added yet.</p>}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">English Requirements</p>
          {english.length === 0 ? (
            <p className="text-xs text-slate-400">
              {minIELTS ? `Minimum IELTS ${minIELTS} overall — no other tests listed.` : `No ${level.toLowerCase()} English requirements added yet.`}
            </p>
          ) : (
            <div className="space-y-1.5">
              {english.map((e, i) => (
                <div key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-700">{e.testName}</p>
                    {e.minScore && <span className="font-semibold text-slate-800">{e.minScore}</span>}
                  </div>
                  {(e.skillScores ?? []).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {e.skillScores!.map((s, si) => (
                        <span key={si} className="rounded-md bg-white px-2 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200">
                          {s.skill} <span className="font-semibold text-slate-700">{s.score}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
