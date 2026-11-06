// A save queue for "write this value to the server" calls that can fire many times in a row. It:
//   - sends nothing when the value is identical (by value, not by reference) to what the server last accepted;
//   - waits `delayMs` after the last change and sends only the latest value (rapid edits become one request);
//   - sends the writes for one key strictly in order, never two at once;
//   - flushes everything immediately on request (route change, unmount) and on page hide / unload, so nothing typed is lost;
//   - retries a failed send a few times with growing delays, then gives up — it never retries forever. An error the caller marks
//     as fatal (e.g. "that record doesn't exist") is not retried at all.
// The value in memory stays the caller's source of truth; giving up never discards it, it just stops asking the server.

export interface WriterOptions<T> {
  send: (key: string, value: T) => Promise<void>;
  /** Best-effort send used while the page is closing (fetch with keepalive). Defaults to nothing. */
  sendOnUnload?: (key: string, value: T) => void;
  /** True for an error that retrying can't fix. Default: any 4xx status. */
  isFatal?: (err: unknown) => boolean;
  onGiveUp?: (key: string, err: unknown) => void;
  /** Called after the server has accepted a value. */
  onSaved?: (key: string, value: T) => void;
  delayMs?: number;
  maxRetries?: number;
  backoffMs?: number;
}

interface Queued<T> { value: T; json: string; timer: ReturnType<typeof setTimeout> | null }

const defaultFatal = (err: unknown) => {
  const status = (err as { status?: number })?.status;
  return typeof status === "number" && status >= 400 && status < 500;
};

export function createCoalescedWriter<T>(options: WriterOptions<T>) {
  const delayMs = options.delayMs ?? 800;
  const maxRetries = options.maxRetries ?? 3;
  const backoffMs = options.backoffMs ?? 1000;
  const isFatal = options.isFatal ?? defaultFatal;

  const lastSaved = new Map<string, string>(); // key -> JSON the server last accepted
  const queued = new Map<string, Queued<T>>(); // waiting for the debounce
  const chains = new Map<string, Promise<void>>(); // per-key send order
  let inFlight = 0;

  async function sendWithRetry(key: string, value: T, json: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        await options.send(key, value);
        lastSaved.set(key, json);
        options.onSaved?.(key, value);
        return;
      } catch (err) {
        if ((err as Error)?.name === "StaleSessionError") return;
        if (isFatal(err) || attempt >= maxRetries) {
          options.onGiveUp?.(key, err);
          return;
        }
        await new Promise((r) => setTimeout(r, backoffMs * 2 ** attempt));
      }
    }
  }

  function dispatch(key: string): Promise<void> {
    const entry = queued.get(key);
    if (!entry) return chains.get(key) ?? Promise.resolve();
    if (entry.timer) clearTimeout(entry.timer);
    queued.delete(key);
    if (lastSaved.get(key) === entry.json) return chains.get(key) ?? Promise.resolve(); // changed back to what the server has
    inFlight++;
    const run = (chains.get(key) ?? Promise.resolve()).then(() => sendWithRetry(key, entry.value, entry.json)).finally(() => {
      inFlight--;
      if (chains.get(key) === run) chains.delete(key);
    });
    chains.set(key, run);
    return run;
  }

  return {
    write(key: string, value: T) {
      const json = JSON.stringify(value);
      const waiting = queued.get(key);
      if (!waiting && lastSaved.get(key) === json) return; // nothing changed
      if (waiting?.timer) clearTimeout(waiting.timer);
      queued.set(key, { value, json, timer: setTimeout(() => { void dispatch(key); }, delayMs) });
    },
    /** Sends everything waiting right now and resolves when all sends (including ones already running) have finished. */
    async flushAll() {
      await Promise.all([...queued.keys()].map(dispatch));
      await Promise.all([...chains.values()]);
    },
    /** For pagehide/beforeunload: hands what is still waiting to `sendOnUnload` (which must not depend on async work). */
    flushOnUnload() {
      for (const [key, entry] of queued) {
        if (entry.timer) clearTimeout(entry.timer);
        if (lastSaved.get(key) !== entry.json) options.sendOnUnload?.(key, entry.value);
      }
      queued.clear();
    },
    /** Writes not yet confirmed by the server (waiting, or being sent). */
    pending: () => queued.size + inFlight,
    /** Forgets what the server is known to hold (call after reloading from the server, which may have changed elsewhere), so
     * the next write of any value is sent rather than skipped as "unchanged". Waiting writes are untouched. */
    forgetSaved() {
      lastSaved.clear();
    },
  };
}
