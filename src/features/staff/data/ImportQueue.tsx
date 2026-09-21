// The shared AI import queue page behind "Import from URLs" for both courses (CourseImport.tsx)
// and universities (UniversityImport.tsx). Paste links in bulk, let the AI draft each one, then
// review and approve each draft in the normal form. This page only manages the queue: it
// creates rows, runs them one at a time (one request per URL, so a slow page or a slow model
// never blocks the others), and shows where every row stands. Approval itself only ever happens
// from the form (`?importId=`) — the queue never writes to the catalog.
import { safeHref } from "../../../utils/safeHref";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ExternalLink, Pause, Play, Sparkles, Trash2, Upload } from "lucide-react";
import { Badge, Button, Modal, StatTile } from "../../../components/ui";
import { fetchCourseImportConfig, type CourseImportConfig, type CourseImportStatus } from "../../../data/courseImportsStore";
import { useHoldCacheSync } from "../../../utils/syncCache";

/** The minimum a queue row must expose for this page to manage it. */
export interface QueueRow {
  id: string;
  sourceUrl: string;
  status: CourseImportStatus;
  textSource?: "fetch" | "paste";
  error?: string;
  updatedAt: string;
  extracted?: { needsAttention: string[]; warnings: string[] };
}

/** Everything that differs between the course and university queues. */
export interface QueueAdapter<Row extends QueueRow> {
  title: string;
  subtitle: string;
  backLabel: string;
  backTo: { path: string; state?: unknown };
  urlPlaceholder: string;
  /** Extra controls rendered above the URL box (e.g. a country picker), and any batch options they produce. */
  batchOptions?: ReactNode;
  /** A notice shown above the form (e.g. "this university has no subjects yet"). */
  notice?: ReactNode;
  emptyText: string;
  list: () => Promise<Row[]>;
  create: (urls: string[]) => Promise<{ created: Row[]; skipped: { url: string; reason: string }[] }>;
  run: (row: Row, opts: { pageText?: string; refetch?: boolean }) => Promise<Row>;
  discard: (row: Row) => Promise<Row>;
  remove: (row: Row) => Promise<void>;
  reviewPath: (row: Row) => string;
  /** Where "Open" goes once a row is approved (undefined = no link yet). */
  approvedPath: (row: Row) => string | undefined;
  /** The two-line summary of what was extracted (name + details), or null when nothing was. */
  summary: (row: Row) => { title: string; detail: ReactNode } | null;
  reviewLabel: string;
  openLabel: string;
}

const STATUS_LABEL: Record<CourseImportStatus, { label: string; tone: "neutral" | "blue" | "green" | "amber" | "red" }> = {
  queued: { label: "Queued", tone: "neutral" },
  running: { label: "Extracting…", tone: "blue" },
  needs_review: { label: "Needs review", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  discarded: { label: "Discarded", tone: "neutral" },
  failed: { label: "Failed", tone: "red" },
};

const STALE_RUNNING_MS = 2 * 60 * 1000;
const isRunnable = (row: QueueRow) =>
  row.status === "queued" || (row.status === "running" && Date.now() - new Date(row.updatedAt).getTime() > STALE_RUNNING_MS);

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 48 ? `…${u.pathname.slice(-46)}` : u.pathname;
    return `${u.hostname}${path}`;
  } catch {
    return url;
  }
}

type Filter = "all" | "needs_review" | "failed" | "approved";

export function ImportQueue<Row extends QueueRow>({ adapter }: { adapter: QueueAdapter<Row> }) {
  const navigate = useNavigate();
  const [config, setConfig] = useState<CourseImportConfig | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [urlText, setUrlText] = useState("");
  const [skipped, setSkipped] = useState<{ url: string; reason: string }[]>([]);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<{ index: number; total: number; url: string } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [pasteFor, setPasteFor] = useState<Row | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const pausedRef = useRef(false);
  const mountedRef = useRef(true);
  // Keep the adapter's callbacks fresh without restarting the loop when the parent re-renders.
  const adapterRef = useRef(adapter);
  useEffect(() => { adapterRef.current = adapter; });

  // The shell remounts the routed page on every cache change (see syncCache.ts) — that would
  // kill the run loop mid-batch, so hold it off while extraction is in progress.
  useHoldCacheSync(running);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetchCourseImportConfig().then(setConfig).catch(() => setConfig({ enabled: false, provider: "stub", providerReady: false }));
    adapterRef.current.list()
      .then((rows) => { setItems(rows); setLoaded(true); })
      .catch((err) => { setError(err instanceof Error ? err.message : "Couldn't load the import queue."); setLoaded(true); });
  }, []);

  function replaceItem(next: Row) {
    setItems((prev) => prev.map((i) => (i.id === next.id ? next : i)));
  }

  function setBusy(id: string, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  /** Runs every runnable row, one at a time, until the queue is empty or Pause is pressed. */
  async function runQueue(rows: Row[]) {
    const todo = rows.filter(isRunnable);
    if (todo.length === 0) return;
    pausedRef.current = false;
    setRunning(true);
    try {
      for (let i = 0; i < todo.length; i++) {
        if (pausedRef.current || !mountedRef.current) break;
        const row = todo[i];
        setCurrent({ index: i + 1, total: todo.length, url: row.sourceUrl });
        try {
          const result = await adapterRef.current.run(row, {});
          if (mountedRef.current) replaceItem(result);
        } catch (err) {
          if (mountedRef.current) replaceItem({ ...row, status: "failed", error: err instanceof Error ? err.message : "Extraction failed." });
        }
      }
    } finally {
      if (mountedRef.current) {
        setRunning(false);
        setCurrent(null);
      }
    }
  }

  async function addUrls() {
    const urls = urlText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (urls.length === 0) return;
    setError("");
    try {
      const result = await adapterRef.current.create(urls);
      setSkipped(result.skipped);
      setUrlText("");
      setItems((prev) => [...prev, ...result.created]);
      void runQueue(result.created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add those URLs.");
    }
  }

  async function rerun(row: Row, opts: { pageText?: string; refetch?: boolean } = {}) {
    setBusy(row.id, true);
    try {
      replaceItem(await adapterRef.current.run(row, opts));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't re-run that row.");
    } finally {
      setBusy(row.id, false);
    }
  }

  async function discard(row: Row) {
    setBusy(row.id, true);
    try {
      replaceItem(await adapterRef.current.discard(row));
    } finally {
      setBusy(row.id, false);
    }
  }

  async function remove(row: Row) {
    setBusy(row.id, true);
    try {
      await adapterRef.current.remove(row);
      setItems((prev) => prev.filter((i) => i.id !== row.id));
    } finally {
      setBusy(row.id, false);
    }
  }

  async function submitPaste() {
    if (!pasteFor || !pasteText.trim()) return;
    const target = pasteFor;
    const text = pasteText;
    setPasteFor(null);
    setPasteText("");
    await rerun(target, { pageText: text });
  }

  function readPasteFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPasteText((prev) => `${prev}${prev ? "\n" : ""}${String(reader.result || "")}`);
    reader.readAsText(file);
  }

  const back = (
    <button onClick={() => navigate(adapter.backTo.path, { state: adapter.backTo.state })} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
      <ArrowLeft size={14} /> {adapter.backLabel}
    </button>
  );

  if (config && !config.enabled) {
    return (
      <div className="max-w-3xl">
        {back}
        <h1 className="mb-1 text-xl font-semibold text-slate-900">{adapter.title}</h1>
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
          AI import is turned off. An admin can enable it under Admin → AI Settings → "Data Management features".
        </p>
      </div>
    );
  }

  const counts = {
    needs_review: items.filter((i) => i.status === "needs_review").length,
    failed: items.filter((i) => i.status === "failed").length,
    approved: items.filter((i) => i.status === "approved").length,
    queued: items.filter(isRunnable).length,
  };
  const visible = filter === "all" ? items : items.filter((i) => i.status === filter);
  const urlCount = urlText.split("\n").map((s) => s.trim()).filter(Boolean).length;

  return (
    <div className="max-w-5xl">
      {back}

      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{adapter.title}</h1>
        <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10.5px] font-semibold text-violet-700"><Sparkles size={11} /> AI-assisted</span>
      </div>
      <p className="mb-5 text-xs text-slate-500">{adapter.subtitle}</p>

      {config && !config.providerReady && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>The AI provider is "{config.provider}" with no API key, so pages will be fetched but nothing will be extracted. Set a provider key in Admin → AI Settings first.</span>
        </p>
      )}
      {adapter.notice}

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        {adapter.batchOptions}
        <p className="text-xs font-semibold text-slate-800">Page URLs</p>
        <textarea
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
          rows={5}
          placeholder={adapter.urlPlaceholder}
          className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-[11.5px] text-slate-800"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">{urlCount} URL{urlCount === 1 ? "" : "s"} ready</p>
          <Button disabled={urlCount === 0 || running} onClick={addUrls}>Add to queue & extract</Button>
        </div>
        {skipped.length > 0 && (
          <ul className="space-y-0.5 rounded-lg bg-amber-50 p-2.5 text-[11.5px] text-amber-800">
            {skipped.map((s, i) => <li key={i}><span className="font-mono">{shortUrl(s.url)}</span> — {s.reason}</li>)}
          </ul>
        )}
        {error && <p className="text-[11.5px] text-rose-600">{error}</p>}
      </div>

      {(running || counts.queued > 0) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
          {running && current ? (
            <p className="text-[12px] text-blue-900">
              Extracting {current.index} of {current.total} — <span className="font-mono text-[11px]">{shortUrl(current.url)}</span>
            </p>
          ) : (
            <p className="text-[12px] text-blue-900">{counts.queued} row{counts.queued === 1 ? "" : "s"} waiting to be extracted.</p>
          )}
          {running ? (
            <Button variant="secondary" onClick={() => { pausedRef.current = true; }}><Pause size={13} /> Pause after this one</Button>
          ) : (
            <Button variant="secondary" onClick={() => runQueue(items)}><Play size={13} /> Resume {counts.queued} queued</Button>
          )}
        </div>
      )}

      {loaded && items.length > 0 && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Needs review" value={String(counts.needs_review)} tone="amber" />
            <StatTile label="Failed" value={String(counts.failed)} tone="red" />
            <StatTile label="Approved" value={String(counts.approved)} tone="green" />
            <StatTile label="Total rows" value={String(items.length)} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["all", "needs_review", "failed", "approved"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-[11.5px] font-medium ${filter === f ? "bg-[var(--brand-600)] text-white" : "border border-slate-200 bg-white text-slate-600"}`}
              >
                {f === "all" ? "All" : STATUS_LABEL[f].label}
              </button>
            ))}
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Extracted</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Attention</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((row) => {
                    const busy = busyIds.has(row.id) || (running && current?.url === row.sourceUrl && row.status === "running");
                    const summary = adapter.summary(row);
                    const flags = row.extracted?.needsAttention.length ?? 0;
                    const warns = row.extracted?.warnings.length ?? 0;
                    const status = STATUS_LABEL[row.status];
                    const openPath = row.status === "approved" ? adapter.approvedPath(row) : undefined;
                    return (
                      <tr key={row.id} className="align-top">
                        <td className="max-w-[240px] px-4 py-3">
                          <a href={safeHref(row.sourceUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all font-mono text-[11px] text-[var(--brand-600)]">
                            {shortUrl(row.sourceUrl)} <ExternalLink size={10} className="shrink-0" />
                          </a>
                          {row.textSource === "paste" && <p className="mt-0.5 text-[10.5px] text-slate-400">from pasted text</p>}
                        </td>
                        <td className="px-4 py-3">
                          {summary ? (
                            <>
                              <p className="text-[13px] font-medium text-slate-800">{summary.title}</p>
                              <p className="text-[11px] text-slate-400">{summary.detail}</p>
                            </>
                          ) : (
                            <p className="text-[12px] text-slate-400">—</p>
                          )}
                          {row.status === "failed" && row.error && <p className="mt-1 text-[11.5px] text-rose-600">{row.error}</p>}
                        </td>
                        <td className="px-4 py-3"><Badge tone={status.tone}>{status.label}</Badge></td>
                        <td className="px-4 py-3">
                          {row.extracted && (flags > 0 || warns > 0) ? (
                            <span
                              title={[...row.extracted.needsAttention.map((f) => `Check: ${f}`), ...row.extracted.warnings].join("\n")}
                              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                            >
                              <AlertTriangle size={11} /> {flags} field{flags === 1 ? "" : "s"}{warns ? ` · ${warns} note${warns === 1 ? "" : "s"}` : ""}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11.5px] font-medium">
                            {row.status === "needs_review" && (
                              <>
                                <button disabled={busy} onClick={() => navigate(adapter.reviewPath(row))} className="text-[var(--brand-600)] disabled:opacity-40">{adapter.reviewLabel}</button>
                                <button disabled={busy} onClick={() => rerun(row)} className="text-slate-500 disabled:opacity-40">Re-run</button>
                                <button disabled={busy} onClick={() => discard(row)} className="text-slate-400 hover:text-rose-600 disabled:opacity-40">Discard</button>
                              </>
                            )}
                            {row.status === "failed" && (
                              <>
                                <button disabled={busy} onClick={() => { setPasteFor(row); setPasteText(""); }} className="text-[var(--brand-600)] disabled:opacity-40">Paste text</button>
                                <button disabled={busy} onClick={() => rerun(row, { refetch: true })} className="text-slate-500 disabled:opacity-40">Retry fetch</button>
                                <button disabled={busy} onClick={() => discard(row)} className="text-slate-400 hover:text-rose-600 disabled:opacity-40">Discard</button>
                              </>
                            )}
                            {row.status === "approved" && (
                              <>
                                {openPath && <button onClick={() => navigate(openPath)} className="text-[var(--brand-600)]">{adapter.openLabel}</button>}
                                <button disabled={busy} onClick={() => remove(row)} className="text-slate-400 hover:text-rose-600 disabled:opacity-40">Remove</button>
                              </>
                            )}
                            {(row.status === "discarded" || row.status === "queued") && !busy && (
                              <button onClick={() => remove(row)} className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-600"><Trash2 size={12} /> Remove</button>
                            )}
                            {busy && <span className="text-slate-400">Working…</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {visible.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-[12px] text-slate-400">Nothing here.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {loaded && items.length === 0 && (
        <p className="mt-5 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-400">{adapter.emptyText}</p>
      )}

      {pasteFor && (
        <Modal title="Paste the page text" onClose={() => setPasteFor(null)}>
          <p className="text-[12px] text-slate-500">
            This page couldn't be read automatically. Open it in your browser, select all (Ctrl+A), copy, and paste the text here — or choose a saved .txt/.html file.
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{pasteFor.sourceUrl}</p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={10}
            placeholder="Paste the page's text here…"
            className="mt-3 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-[12px] text-slate-800"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-medium text-[var(--brand-600)]">
              <Upload size={12} /> Choose a .txt / .html file
              <input type="file" accept=".txt,.html,.htm,text/plain,text/html" className="hidden" onChange={(e) => readPasteFile(e.target.files?.[0])} />
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPasteFor(null)}>Cancel</Button>
              <Button disabled={!pasteText.trim()} onClick={submitPaste}>Extract from this text</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
