import { useRef, useState } from "react";
import { FileText, AlertCircle, Upload, Plus } from "lucide-react";
import { ChecklistCard } from "./ChecklistCard";
import { DocViewButton } from "./DocViewButton";
import { requestCoreDocType } from "../data/coreDocsStore";
import { coreDocTypeOptions } from "../utils/documentChecklist";
import type { ChecklistRow } from "../utils/documentChecklist";

const STATUS_LABEL: Record<string, string> = { uploaded: "Pending review", verified: "Verified" };
const STATUS_TONE: Record<string, string> = { uploaded: "text-amber-700", verified: "text-green-700" };
const STATUS_ICON: Record<string, string> = { uploaded: "text-amber-600", verified: "text-green-600" };

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
      <div className={`rounded-xl border border-transparent p-3 ${own.status === "verified" ? "neu-card-green" : "bg-white"}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${own.status === "verified" ? "neu-icon-green" : "bg-[var(--sd-card)] shadow-neu-inset-sm"} ${STATUS_ICON[own.status] ?? "text-neutral-900"}`}>
            <FileText size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-neutral-800">{row.type}</p>
            <p className="truncate text-[11px] text-neutral-400">{own.name}</p>
          </div>
          {own.previewUrl && <DocViewButton name={row.type} previewUrl={own.previewUrl} />}
          <span className={`shrink-0 text-[11px] font-semibold capitalize ${STATUS_TONE[own.status] ?? "text-neutral-500"}`}>
            {STATUS_LABEL[own.status] ?? own.status}
          </span>
        </div>

        {canVerify && pendingReview && own.id && !rejecting && (
          <div className="mt-2 flex items-center gap-2 pl-11">
            <button
              onClick={() => onVerify?.(own.id!)}
              className="rounded-lg bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white"
            >
              Approve
            </button>
            <button
              onClick={() => setRejecting(true)}
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-neutral-900"
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
              className="w-full resize-none rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300"
            />
            <div className="flex items-center gap-2">
              <button
                disabled={!reason.trim()}
                onClick={() => {
                  onReject?.(own.id!, reason.trim());
                  setRejecting(false);
                  setReason("");
                }}
                className="rounded-lg bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                Confirm reject
              </button>
              <button onClick={() => { setRejecting(false); setReason(""); }} className="text-[11px] text-neutral-400">
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

  // Missing, or the previous upload was rejected — both need a (re-)upload action, so both are red.
  return (
    <div className="neu-card-red rounded-xl p-3">
      <div className="flex items-center gap-3">
        <div className="neu-icon-red flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-600">
          <AlertCircle size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-neutral-800">{row.type}</p>
          {row.rejected && (
            <p className="truncate text-[11px] font-medium text-red-700">Rejected — {row.rejected.reason || "no reason given"}</p>
          )}
        </div>
        {canUpload && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              className="neu-btn-red flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-semibold"
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
  studentId, existingTypes, onAdded, variant = "inline",
}: {
  studentId: string; existingTypes: string[]; onAdded: () => void;
  /** "header" = a raised pill for a page's top-right corner, with the list opening as a soft raised panel (student app style). */
  variant?: "inline" | "header";
}) {
  const header = variant === "header";
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
      {header ? (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Add a document type"
          aria-expanded={open}
          className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-[var(--sd-card)] px-3 text-[12px] font-semibold text-[var(--sd-ink)] shadow-neu-sm"
        >
          <Plus size={14} /> <span className="hidden min-[380px]:inline">Add type</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-[clamp(11px,3.1vw,13.5px)] font-semibold text-[var(--sd-ink)]"
        >
          <Plus size={13} /> Add a document type
        </button>
      )}
      {open && (
        <>
          <button aria-hidden className="fixed inset-0 z-10" onClick={() => setOpen(false)} tabIndex={-1} />
          <div className={header
            ? "absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2.5rem)] rounded-2xl bg-[var(--sd-card)] p-3 shadow-neu"
            : "absolute left-0 z-20 mt-1.5 w-64 rounded-xl border border-neutral-200 bg-white p-2 shadow-[0_4px_24px_rgba(0,0,0,0.12)]"}>
            <p className="px-1 pb-1.5 text-[10.5px] text-neutral-400">Not sure which one applies? Pick the closest match.</p>
            <div className="max-h-52 space-y-0.5 overflow-y-auto">
              {options.map((t) => (
                <button
                  key={t}
                  onClick={() => pick(t)}
                  className={`block w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-neutral-700 ${header ? "hover:bg-neutral-200/40" : "hover:bg-neutral-50"}`}
                >
                  {t}
                </button>
              ))}
              {options.length === 0 && <p className="px-2 py-1.5 text-[11.5px] text-neutral-400">Every option is already on your checklist.</p>}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 border-t border-transparent pt-1.5">
              <input
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Other (type your own)"
                className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[12px] placeholder:text-neutral-400 focus:outline-none ${header ? "bg-[var(--sd-card)] shadow-neu-inset-sm" : "border border-neutral-200 focus:ring-1 focus:ring-neutral-300"}`}
              />
              <button
                disabled={!customType.trim()}
                onClick={() => pick(customType)}
                className="shrink-0 rounded-lg bg-[var(--sd-ink)] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
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
