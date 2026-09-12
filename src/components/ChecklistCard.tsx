import { FileText, Copy, AlertCircle } from "lucide-react";
import { DocViewButton } from "./DocViewButton";
import type { ChecklistRow } from "../utils/documentChecklist";

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
        <span className="shrink-0 text-[11px] font-medium capitalize text-emerald-600">{row.own.status}</span>
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
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <AlertCircle size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-slate-800">{row.type}</p>
        <p className="text-[11px] text-slate-400">Not uploaded yet</p>
      </div>
    </div>
  );
}
