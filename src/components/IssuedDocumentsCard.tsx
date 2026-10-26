import { useRef, useState } from "react";
import { FileText, Paperclip, Trash2, Upload, Loader2 } from "lucide-react";
import { loadIssuedDocs, addIssuedDoc, removeIssuedDoc } from "../data/applicationDocsStore";
import { DocViewButton } from "./DocViewButton";
import { useHoldCacheSync } from "../utils/syncCache";

const ACCEPT = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";
const SUGGESTIONS = ["Offer Letter", "CAS Letter", "Visa Decision Letter"];

/** Offer letter, CAS letter and any other document staff attach to an application under a field name
 * they choose. Everyone tied to the application (student, agent, counsellor, admission) sees the same
 * list; only staff (`canManage`) get the upload form. PDF, JPEG and PNG are accepted. */
export function IssuedDocumentsCard({
  applicationId, canManage, tone = "light",
}: { applicationId: string; canManage: boolean; tone?: "light" | "neu" }) {
  const docs = loadIssuedDocs(applicationId);
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Keep a half-filled form (and the chosen file) from being rebuilt away by a background refresh.
  useHoldCacheSync(canManage && (busy || label.length > 0 || !!file));

  async function submit() {
    if (!label.trim() || !file) return;
    setBusy(true);
    setError("");
    try {
      await addIssuedDoc(applicationId, label, file);
      setLabel("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const card = tone === "neu"
    ? "rounded-2xl border border-transparent bg-[var(--sd-card)] p-3.5 shadow-neu"
    : "rounded-xl border border-slate-100 bg-white p-3";

  if (docs.length === 0 && !canManage) return null;

  return (
    <div className={card}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <Paperclip size={13} /> Offer, CAS &amp; other letters
      </p>

      {docs.length === 0 ? (
        <p className="mb-2 text-[12px] text-slate-400">Nothing attached yet.</p>
      ) : (
        <div className="mb-3 space-y-1.5">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
              <FileText size={14} className="shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-slate-700">{d.label}</p>
                <p className="truncate text-[10.5px] text-slate-400">
                  {d.uploadedAt}{d.uploadedByName ? ` · ${d.uploadedByName}` : ""}
                </p>
              </div>
              {d.previewUrl && (
                <DocViewButton
                  name={d.label}
                  previewUrl={d.previewUrl}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                />
              )}
              {canManage && (
                <button
                  onClick={() => { removeIssuedDoc(d.id).catch((err) => setError(err instanceof Error ? err.message : "Couldn't remove it.")); }}
                  aria-label={`Remove ${d.label}`}
                  className="shrink-0 text-slate-300 hover:text-rose-500"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="space-y-2 border-t border-dashed border-slate-200 pt-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            list={`issued-doc-names-${applicationId}`}
            placeholder="Field name, e.g. Offer Letter"
            maxLength={120}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-[var(--sd-ink)] focus:outline-none"
          />
          <datalist id={`issued-doc-names-${applicationId}`}>
            {SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
          <div className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] text-slate-500 hover:bg-slate-50">
              <Upload size={13} className="shrink-0" />
              <span className="truncate">{file ? file.name : "Choose a PDF or JPEG"}</span>
              <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <button
              onClick={submit}
              disabled={busy || !label.trim() || !file}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[image:var(--sd-gradient)] px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
            >
              {busy && <Loader2 size={13} className="animate-spin" />} Upload
            </button>
          </div>
          <p className="text-[11px] text-slate-400">Visible to the student, their agent and everyone responsible for this application, who are notified.</p>
          {error && <p className="text-[12px] text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
