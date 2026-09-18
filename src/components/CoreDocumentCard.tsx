import { useRef, useState } from "react";
import { FileText, AlertCircle, Upload, Plus } from "lucide-react";
import { ChecklistCard } from "./ChecklistCard";
import { DocViewButton } from "./DocViewButton";
import { requestCoreDocType } from "../data/coreDocsStore";
import { coreDocTypeOptions } from "../utils/documentChecklist";
import type { ChecklistRow } from "../utils/documentChecklist";

const STATUS_LABEL: Record<string, string> = { uploaded: "Pending review", verified: "Verified" };
const STATUS_TONE: Record<string, string> = { uploaded: "text-amber-600", verified: "text-emerald-600" };

/** A core-document checklist row for staff (counsellor/agent) views — same own/reused states as
 * ChecklistCard, but adds an upload action (either role can supply a document on the student's
 * behalf, same as ApplicationChecklistCard does for per-application docs) and, counsellor-only, the
 * approve/reject verification actions on anything awaiting review. */
export function CoreDocumentCard({
  row, canUpload, canVerify, onUpload, onVerify, onReject,
}: {
  row: ChecklistRow;
  canUpload: boolean;
  canVerify: boolean;
  onUpload: (file: File) => void;
  onVerify?: (id: string) => void;
  onReject?: (id: string, reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (row.own) {
    const own = row.own;
    const pendingReview = own.status === "uploaded";
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
          <span className={`shrink-0 text-[11px] font-medium capitalize ${STATUS_TONE[own.status] ?? "text-slate-500"}`}>
            {STATUS_LABEL[own.status] ?? own.status}
          </span>
        </div>

        {canVerify && pendingReview && own.id && !rejecting && (
          <div className="mt-2 flex items-center gap-2 pl-11">
            <button
              onClick={() => onVerify?.(own.id!)}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white"
            >
              Approve
            </button>
            <button
              onClick={() => setRejecting(true)}
              className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600"
            >
              Reject
            </button>
          </div>
        )}

        {canVerify && rejecting && own.id && (
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
                onClick={() => {
                  onReject?.(own.id!, reason.trim());
                  setRejecting(false);
                  setReason("");
                }}
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

  // Missing, or the previous upload was rejected — both need a (re-)upload action.
  return (
    <div className={`rounded-xl border p-3 ${row.rejected ? "border-rose-200 bg-rose-50/50" : "border-dashed border-slate-300 bg-white"}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${row.rejected ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-400"}`}>
          <AlertCircle size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-slate-800">{row.type}</p>
          <p className={`truncate text-[11px] ${row.rejected ? "text-rose-600" : "text-slate-400"}`}>
            {row.rejected ? `Rejected — ${row.rejected.reason || "no reason given"}` : "Not uploaded yet"}
          </p>
        </div>
        {canUpload && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-[image:var(--sd-gradient)] px-2.5 py-1.5 text-[11px] font-semibold text-white"
            >
              <Upload size={11} /> {row.rejected ? "Re-upload" : "Upload"}
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
          </>
        )}
      </div>
    </div>
  );
}

/** Lets a student manually add a core-document checklist slot the automatic profile-derived list
 * hasn't produced — the situation when their academic profile is too incomplete for it to know
 * exactly which level's transcript/certificate (or other type) they actually need. Creates a
 * "requested" placeholder that shows up as a normal missing row until something's uploaded to it. */
export function AddCoreDocumentButton({
  studentId, existingTypes, onAdded,
}: { studentId: string; existingTypes: string[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [customType, setCustomType] = useState("");
  const options = coreDocTypeOptions().filter((t) => !existingTypes.includes(t));

  function pick(type: string) {
    if (!type.trim()) return;
    requestCoreDocType(studentId, type.trim());
    setOpen(false);
    setCustomType("");
    onAdded();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[12px] font-semibold text-[var(--sd-ink)]"
      >
        <Plus size={13} /> Add a document type
      </button>
      {open && (
        <>
          <button aria-hidden className="fixed inset-0 z-10" onClick={() => setOpen(false)} tabIndex={-1} />
          <div className="absolute left-0 z-20 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
            <p className="px-1 pb-1.5 text-[10.5px] text-slate-400">Not sure which one applies? Pick the closest match.</p>
            <div className="max-h-52 space-y-0.5 overflow-y-auto">
              {options.map((t) => (
                <button
                  key={t}
                  onClick={() => pick(t)}
                  className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                >
                  {t}
                </button>
              ))}
              {options.length === 0 && <p className="px-2 py-1.5 text-[11.5px] text-slate-400">Every option is already on your checklist.</p>}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 border-t border-slate-100 pt-1.5">
              <input
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Other (type your own)"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[12px] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
              <button
                disabled={!customType.trim()}
                onClick={() => pick(customType)}
                className="shrink-0 rounded-lg bg-[var(--sd-ink)] px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
