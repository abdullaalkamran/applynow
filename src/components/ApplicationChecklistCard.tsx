import { useRef } from "react";
import { AlertCircle, Upload, X, CalendarDays } from "lucide-react";
import { ChecklistCard } from "./ChecklistCard";
import { dueDateTone } from "../data/documentDueDatesStore";
import type { ChecklistRow } from "../utils/documentChecklist";

/** Same own/reused states as ChecklistCard, but a "Missing" item gets a real upload control — used
 * anywhere staff (counsellor or agent) can supply a required document on a student's behalf,
 * writing to the exact same store the student's own upload flow uses. */
export function ApplicationChecklistCard({
  row, onUpload, onRemoveRequest, dueDate, onSetDueDate,
}: {
  row: ChecklistRow; onUpload: (file: File) => void; onRemoveRequest?: () => void;
  dueDate?: string; onSetDueDate?: (date: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (row.own || row.reused) {
    return <ChecklistCard row={row} />;
  }

  const tone = dueDateTone(dueDate);
  const dueClass = tone === "overdue" ? "text-rose-600" : tone === "soon" ? "text-amber-600" : "text-slate-500";

  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
          <AlertCircle size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-slate-800">{row.type}</p>
          <p className="text-[11px] text-slate-400">Required — not uploaded yet</p>
        </div>
        {onRemoveRequest && (
          <button onClick={onRemoveRequest} aria-label={`Remove request for ${row.type}`} className="shrink-0 text-slate-300 hover:text-slate-500">
            <X size={13} />
          </button>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-[image:var(--sd-gradient)] px-2.5 py-1.5 text-[11px] font-semibold text-white"
        >
          <Upload size={11} /> Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
      </div>
      {onSetDueDate ? (
        <div className="mt-2 flex items-center gap-1.5 pl-11">
          <CalendarDays size={11} className={dueClass} />
          <label className={`text-[10.5px] font-medium ${dueClass}`}>
            {tone === "overdue" ? "Overdue" : tone === "soon" ? "Due soon" : "Due"}
          </label>
          <input
            type="date"
            value={dueDate ?? ""}
            onChange={(e) => onSetDueDate(e.target.value)}
            className={`rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] ${dueClass}`}
          />
        </div>
      ) : (
        dueDate && (
          <div className="mt-2 flex items-center gap-1.5 pl-11">
            <CalendarDays size={11} className={dueClass} />
            <span className={`text-[10.5px] font-medium ${dueClass}`}>
              {tone === "overdue" ? "Overdue — set by counsellor" : tone === "soon" ? "Due soon" : "Due"} {dueDate}
            </span>
          </div>
        )
      )}
    </div>
  );
}
