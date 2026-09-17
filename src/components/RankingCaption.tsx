// The two specific rankings Data Management enters (QS, Times Higher) — shown as a caption under
// the generic "World rank" stat tile everywhere, since that stat still reads the single derived
// `worldRank` value for backward compatibility and can't show both named rankings on its own.
import type { University } from "../types";

export function RankingCaption({ university, className = "" }: { university: University; className?: string }) {
  if (!university.qsRanking && !university.timesHigherRanking) return null;
  return (
    <p className={`flex flex-wrap gap-3 text-[11px] text-slate-400 ${className}`}>
      {university.qsRanking && <span>QS Ranking: <span className="font-semibold text-slate-600">{university.qsRanking}</span></span>}
      {university.timesHigherRanking && <span>Times Higher: <span className="font-semibold text-slate-600">{university.timesHigherRanking}</span></span>}
    </p>
  );
}
