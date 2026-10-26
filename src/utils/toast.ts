// A tiny, dependency-free notice channel. The synchronous-cache stores save optimistically and, when
// the server rejects or times out, roll the change back — which used to happen silently (just a
// console warning), so a comment, task or document request would vanish with no explanation.
// Anything that fails to save now says so, once, in a toast (see components/ToastHost.tsx).
export const TOAST_EVENT = "sd-toast";

export interface ToastDetail {
  message: string;
  tone: "error" | "info";
}

let lastMessage = "";
let lastAt = 0;

export function showToast(message: string, tone: ToastDetail["tone"] = "info") {
  if (typeof window === "undefined") return;
  // The same failure often fires several times in a row (one per optimistic write); show it once.
  const now = Date.now();
  if (message === lastMessage && now - lastAt < 4000) return;
  lastMessage = message;
  lastAt = now;
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, tone } }));
}

/** Logs a failed save and tells the user it did not go through. Ignores the benign "session ended" case. */
export function reportSaveError(label: string, err: unknown) {
  if ((err as Error)?.name === "StaleSessionError") return;
  console.warn(label, err);
  const reason = err instanceof Error && err.message ? err.message : "Unknown error.";
  showToast(`Couldn't save your change. ${reason}`, "error");
}
