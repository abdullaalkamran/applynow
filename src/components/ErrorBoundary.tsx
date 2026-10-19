import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

// A new deploy renames every built file, so a tab (or a cached page) opened before it still asks for the OLD lazy-loaded
// screen files, which no longer exist: the screen fails to load and the page goes blank. The fix is simply to load the page
// again so it picks up the new files — done once automatically (guarded so a real outage can't loop).
const RELOAD_FLAG = "ui-chunk-reload";
export const isChunkLoadError = (message: string) =>
  /dynamically imported module|importing a module script failed|loading chunk|loading css chunk|failed to fetch dynamically/i.test(message);

export function reloadOnceForNewVersion(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch { /* storage blocked: still reload below */ }
  window.location.reload();
  return true;
}

/** Forget the guard once a page has loaded fine, so the next deploy can auto-refresh again. */
export function clearReloadGuard() {
  try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* ignore */ }
}

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screen crashed:", error, info.componentStack);
    if (isChunkLoadError(String(error?.message ?? error))) reloadOnceForNewVersion();
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl bg-[var(--sd-card,#fff)] p-6 text-center shadow-neu">
          <p className="text-[15px] font-semibold text-neutral-900">This page couldn't load</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-500">
            The app may have just been updated. Reload to get the latest version — your work is saved.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button onClick={() => { clearReloadGuard(); window.location.reload(); }} className="rounded-xl bg-neutral-900 px-4 py-2.5 text-[13px] font-semibold text-white">
              Reload
            </button>
            <button onClick={() => { window.location.href = "/"; }} className="rounded-xl px-4 py-2.5 text-[13px] font-medium text-neutral-600">
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/** Keyed by the current path, so moving to another screen clears an earlier crash instead of leaving the error showing. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary key={pathname}>{children}</Boundary>;
}
