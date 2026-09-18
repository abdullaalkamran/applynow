import { useRef, useState } from "react";
import { AlertCircle, Upload, X, FileText } from "lucide-react";
import { ChecklistCard } from "./ChecklistCard";
import { DocViewButton } from "./DocViewButton";
import type { ChecklistRow } from "../utils/documentChecklist";

const STATUS_LABEL: Record<string, string> = { uploaded: "Pending review", verified: "Verified" };
const STATUS_TONE: Record<string, string> = { uploaded: "text-amber-600", verified: "text-emerald-600" };

/** Same own/reused/missing states as ChecklistCard — and the same plain layout as
 * CoreDocumentCard — plus a real upload control for a missing item, used anywhere staff
 * (counsellor or agent) can supply a required document on a student's behalf, writing to the
 * exact same store the student's own upload flow uses. Counsellor-only (`canVerify`), it also
 * adds approve/reject on anything a student or agent uploaded and is still awaiting review, and a
 * rejected upload gets its own state (reason shown, re-upload offered) instead of just looking
 * "missing" again. */
export function ApplicationChecklistCard({
  row, onUpload, onRemoveRequest, canVerify, onVerify, onReject,
}: {
  row: ChecklistRow; onUpload: (file: File) => void; onRemoveRequest?: () => void;
  canVerify?: boolean; onVerify?: (id: string) => void; onReject?: (id: string, reason: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  if (row.own) {
    const own = row.own;
    const pendingReview = own.status === "uploaded";
    // Anything without a real Document row behind it (legacy seed data) has no `id` — nothing to
    // verify or reject, so it stays the plain read-only view.
    if (!canVerify || !own.id || !pendingReview) {
      return <ChecklistCard row={row} />;
    }
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7EEFC] text-[#2955C4]">
            <FileText size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-slate-800">{row.type}</p>
            <p className="truncate text-[11px] text-slate-400">{own.name}</p>
          </div>
          {own.previewUrl && <DocViewButton name={row.type} previewUrl={own.previewUrl} />}
          <span className={`shrink-0 text-[11px] font-medium ${STATUS_TONE[own.status] ?? "text-slate-500"}`}>
            {STATUS_LABEL[own.status] ?? own.status}
          </span>
        </div>

        {!rejecting ? (
          <div className="mt-2 flex items-center gap-2 pl-11">
            <button onClick={() => onVerify?.(own.id!)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white">
              Approve
            </button>
            <button onClick={() => setRejecting(true)} className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600">
              Reject
            </button>
          </div>
        ) : (
          <div className="mt-2 space-y-1.5 pl-11">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection — shown to the student"
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-300"
            />
            <div className="flex items-center gap-2">
              <button
                disabled={!reason.trim()}
                onClick={() => { onReject?.(own.id!, reason.trim()); setRejecting(false); setReason(""); }}
                className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                Confirm reject
              </button>
              <button onClick={() => { setRejecting(false); setReason(""); }} className="text-[11px] text-slate-400">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (row.reused) {
    return <ChecklistCard row={row} />;
  }

  // Missing, or the previous upload was rejected, or a counsellor asked for this specific item —
  // red either way, since all three mean the same thing: this still needs a (re-)upload.
  const rejected = row.rejected;

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
          <AlertCircle size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-slate-800">{row.type}</p>
          <p className="truncate text-[11px] text-rose-600">
            {rejected ? `Rejected — ${rejected.reason || "no reason given"}` : row.requested ? "Requested by counsellor — not uploaded yet" : "Not uploaded yet"}
          </p>
        </div>
        {onRemoveRequest && (
          <button onClick={onRemoveRequest} aria-label={`Remove request for ${row.type}`} className="shrink-0 text-slate-300 hover:text-slate-500">
            <X size={13} />
          </button>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white"
        >
          <Upload size={11} /> {rejected ? "Re-upload" : "Upload"}
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
    </div>
  );
}
