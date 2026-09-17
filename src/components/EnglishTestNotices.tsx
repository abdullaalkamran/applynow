// Internal English test and MOI (Medium of Instruction) acceptance — shown plainly on the
// Overview tab (not just tucked into the Requirements tab's level-specific view) since both are
// important enough that someone shouldn't have to dig into Requirements to find them. Hides
// itself entirely when neither applies.
import { GraduationCap } from "lucide-react";
import type { University } from "../types";

export function EnglishTestNotices({
  university, className = "", showMoi = true,
}: {
  university: University;
  className?: string;
  // MOI is postgraduate-only — pass false when showing this next to a specific undergraduate
  // course, since accepting MOI there wouldn't apply.
  showMoi?: boolean;
}) {
  const hasInternalTest = !!university.internalEnglishTestOffered;
  const hasMoi = showMoi && !!university.moiAccepted;
  if (!hasInternalTest && !hasMoi) return null;
  return (
    <div className={`space-y-2 ${className}`}>
      {hasInternalTest && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          <GraduationCap size={14} className="shrink-0" />
          Offers its own English test (Undergraduate & Postgraduate) —{" "}
          <span className="font-semibold">
            {university.internalEnglishTestFree
              ? "free"
              : `fee: ${university.currencySymbol}${(university.internalEnglishTestFee ?? 0).toLocaleString()}`}
          </span>
        </div>
      )}
      {hasMoi && (
        <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          <p className="flex items-center gap-2 font-semibold">
            <GraduationCap size={14} className="shrink-0" /> Accepts MOI (Medium of Instruction) — Postgraduate only
          </p>
          {(university.moiAcceptedUniversities ?? []).length > 0 && (
            <p className="mt-1 text-emerald-700">From: {university.moiAcceptedUniversities!.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
