import { FileText, Copy, AlertCircle } from "lucide-react";
import { DocViewButton } from "./DocViewButton";
import type { ChecklistRow } from "../utils/documentChecklist";

const STATUS_LABEL: Record<string, string> = { uploaded: "Pending review", verified: "Verified" };
const STATUS_TONE: Record<string, string> = { uploaded: "text-amber-600", verified: "text-emerald-600" };

/** Read-only view of a document checklist row's own/reused/missing state — used anywhere a
 * document requirement needs to be shown without an upload action (e.g. an agent's read-only
 * view of a student's case, or a counsellor's core-document summary). */
export function ChecklistCard({ row }: { row: ChecklistRow }) {
  if (row.own) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7EEFC] text-[#2955C4]">
          <FileText size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-slate-800">{row.type}</p>
          <p className="truncate text-[11px] text-slate-400">{row.own.name}</p>
        </div>
        {row.own.previewUrl && <DocViewButton name={row.type} previewUrl={row.own.previewUrl} />}
        <span className={`shrink-0 text-[11px] font-medium capitalize ${STATUS_TONE[row.own.status] ?? "text-emerald-600"}`}>
          {STATUS_LABEL[row.own.status] ?? row.own.status}
        </span>
      </div>
    );
  }
  if (row.reused) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[#B9E2D4] bg-[#EAF9F2] p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#12805A]/10 text-[#12805A]">
          <Copy size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-slate-800">{row.type}</p>
          <p className="truncate text-[11px] text-[#12805A]">Reused from {row.reused.sourceUniversity ?? "a previous application"}</p>
        </div>
      </div>
    );
  }
  if (row.rejected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
          <AlertCircle size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-slate-800">{row.type}</p>
          <p className="truncate text-[11px] text-rose-600">Rejected — {row.rejected.reason || "no reason given"}</p>
        </div>
      </div>
    );
  }
  // Not uploaded at all — red, same as a rejected or counsellor-requested item, since it's still
  // something the student needs to act on.
  return (
    <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
        <AlertCircle size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-slate-800">{row.type}</p>
        <p className="text-[11px] text-rose-600">
          {row.requested ? "Requested by counsellor — not uploaded yet" : "Not uploaded yet"}
        </p>
      </div>
    </div>
  );
}
