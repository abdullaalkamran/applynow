import { useState } from "react";
import { Eye, X, Download } from "lucide-react";

// Opening a blob: URL in a new tab (target="_blank") reliably fails in current Chromium — blob
// URLs are scoped to the document that created them, so a new top-level browsing context can't
// load one (confirmed: it renders chrome-error://chromewebdata/). An <img> in the SAME document
// can always load it, and a same-document `download` link works regardless of file type — so this
// button previews inline (falling back to a download-only message for non-image files) instead of
// ever navigating to the blob URL directly.
export function DocViewButton({ name, previewUrl, className }: { name: string; previewUrl: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        aria-label={`View ${name}`}
        className={className ?? "flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10.5px] font-medium text-slate-600 hover:bg-slate-200"}
      >
        <Eye size={11} /> View
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{name}</p>
              <button onClick={() => setOpen(false)} aria-label="Close preview" className="shrink-0 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            {!imgFailed ? (
              <img
                src={previewUrl}
                alt={name}
                className="max-h-[60vh] w-full rounded-lg border border-slate-100 object-contain"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
                Preview isn't available for this file type — download it instead.
              </p>
            )}
            <a
              href={previewUrl}
              download={name}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            >
              <Download size={13} /> Download
            </a>
          </div>
        </div>
      )}
    </>
  );
}
