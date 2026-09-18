import { useRef, useState, type WheelEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Eye, X, Download, ZoomIn, ZoomOut, RotateCcw, ExternalLink } from "lucide-react";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i;
const PDF_EXT = /\.pdf(\?|$)/i;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/** A document is now served from a real, persistent URL (see server/src/routes/documents.js's
 * multer upload + app.js's static /uploads mount) — no longer a blob: URL scoped to whichever tab
 * created it, which is what made "View" silently fail for anyone other than the uploader. An image
 * gets an inline, zoomable/pannable preview (scroll or the +/− buttons) so fine detail — a passport
 * number, a signature — can actually be checked, not just glanced at; a PDF gets the browser's own
 * PDF viewer (which already has its own zoom); anything else falls back to a plain download link. */
export function DocViewButton({ name, previewUrl, className }: { name: string; previewUrl: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const isPdf = PDF_EXT.test(previewUrl);
  const isImage = !isPdf && (IMAGE_EXT.test(previewUrl) || !imgFailed);

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function openModal() {
    resetView();
    setImgFailed(false);
    setOpen(true);
  }

  function zoomBy(delta: number) {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2))));
  }

  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    if (!isImage) return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 0.25 : -0.25);
  }

  function handleMouseDown(e: ReactMouseEvent<HTMLImageElement>) {
    if (zoom <= 1) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  }

  function handleMouseMove(e: ReactMouseEvent<HTMLImageElement>) {
    if (!dragState.current) return;
    const { startX, startY, panX, panY } = dragState.current;
    setPan({ x: panX + (e.clientX - startX), y: panY + (e.clientY - startY) });
  }

  function stopDrag() {
    dragState.current = null;
  }

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openModal(); }}
        aria-label={`View ${name}`}
        className={className ?? "flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10.5px] font-medium text-slate-600 hover:bg-slate-200"}
      >
        <Eye size={11} /> View
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-3.5">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{name}</p>
              <div className="flex shrink-0 items-center gap-1">
                {isImage && !imgFailed && (
                  <>
                    <button
                      onClick={() => zoomBy(-0.25)}
                      disabled={zoom <= MIN_ZOOM}
                      aria-label="Zoom out"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <span className="w-10 text-center text-[11px] font-medium text-slate-500">{Math.round(zoom * 100)}%</span>
                    <button
                      onClick={() => zoomBy(0.25)}
                      disabled={zoom >= MAX_ZOOM}
                      aria-label="Zoom in"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ZoomIn size={14} />
                    </button>
                    {zoom > 1 && (
                      <button onClick={resetView} aria-label="Reset zoom" className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
                        <RotateCcw size={13} />
                      </button>
                    )}
                  </>
                )}
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open in new tab"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                >
                  <ExternalLink size={13} />
                </a>
                <button onClick={() => setOpen(false)} aria-label="Close preview" className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div
              onWheel={handleWheel}
              className={`flex-1 overflow-hidden bg-slate-50 ${zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={{ minHeight: isPdf ? "70vh" : "50vh" }}
            >
              {isPdf ? (
                <iframe title={name} src={previewUrl} className="h-full min-h-[70vh] w-full border-0" />
              ) : !imgFailed ? (
                <div className="flex h-full min-h-[50vh] items-center justify-center">
                  <img
                    src={previewUrl}
                    alt={name}
                    draggable={false}
                    onError={() => setImgFailed(true)}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={stopDrag}
                    onMouseLeave={stopDrag}
                    className="max-h-[70vh] max-w-full select-none object-contain transition-transform"
                    style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                  />
                </div>
              ) : (
                <div className="flex h-full min-h-[50vh] items-center justify-center p-6 text-center">
                  <p className="text-xs text-slate-500">Preview isn't available for this file type — download or open it instead.</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 p-3.5">
              <a
                href={previewUrl}
                download={name}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
              >
                <Download size={13} /> Download
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
