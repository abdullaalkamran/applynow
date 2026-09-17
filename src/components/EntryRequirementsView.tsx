// Academic + English entry requirements, split by degree level (Bachelor's/Undergraduate vs.
// Postgraduate) — a university's admissions criteria for the two rarely match, so this replaces
// what used to be one shared list with a level switcher. Shared across every role's University
// Detail "Requirements" tab (see UniversityForm.tsx for where Data Management enters this).
import { useState } from "react";
import { CheckCircle2, GraduationCap } from "lucide-react";

export interface EnglishTestRequirement {
  testName: string;
  minScore?: string;
  skillScores?: { skill: string; score: string }[];
}

const LEVELS = ["Undergraduate", "Postgraduate"] as const;
type Level = (typeof LEVELS)[number];

export function EntryRequirementsView({
  requirements, englishRequirements, minIELTS, minGPA, currencySymbol = "$",
  moiAccepted, moiAcceptedUniversities, internalEnglishTestOffered, internalEnglishTestFree, internalEnglishTestFee,
}: {
  requirements: { undergraduate: string[]; postgraduate: string[] };
  englishRequirements?: { undergraduate: EnglishTestRequirement[]; postgraduate: EnglishTestRequirement[] };
  minIELTS?: number;
  minGPA?: number;
  currencySymbol?: string;
  // MOI (Medium of Instruction) — postgraduate only, so only ever shown on that tab.
  moiAccepted?: boolean;
  moiAcceptedUniversities?: string[];
  // The university's own English test — offered to both levels alike, so shown on both tabs.
  internalEnglishTestOffered?: boolean;
  internalEnglishTestFree?: boolean;
  internalEnglishTestFee?: number;
}) {
  const [level, setLevel] = useState<Level>("Undergraduate");
  const key = level === "Undergraduate" ? "undergraduate" : "postgraduate";
  const academic = requirements[key];
  const english = englishRequirements?.[key] ?? [];

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
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Academic Requirements</p>
          <div className="space-y-2">
            {!!minGPA && (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <span className="text-slate-600">Minimum GPA</span>
                <span className="font-semibold text-slate-800">{minGPA.toFixed(1)} / 4.0</span>
              </div>
            )}
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
          {internalEnglishTestOffered && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <GraduationCap size={14} className="shrink-0" />
              This university offers its own English test —{" "}
              <span className="font-semibold">
                {internalEnglishTestFree ? "free" : `fee: ${currencySymbol}${(internalEnglishTestFee ?? 0).toLocaleString()}`}
              </span>
            </div>
          )}
          {level === "Postgraduate" && moiAccepted && (
            <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <p className="flex items-center gap-2 font-semibold"><GraduationCap size={14} className="shrink-0" /> Accepts MOI (Medium of Instruction)</p>
              {(moiAcceptedUniversities ?? []).length > 0 && (
                <p className="mt-1 text-emerald-700">From: {moiAcceptedUniversities!.join(", ")}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
