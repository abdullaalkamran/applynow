import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { TOAST_EVENT, type ToastDetail } from "../utils/toast";

interface ActiveToast extends ToastDetail {
  id: number;
}

/** Mounted once at the app root; renders whatever showToast()/reportSaveError() raise. */
export function ToastHost() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  useEffect(() => {
    let nextId = 1;
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      const id = nextId++;
      setToasts((prev) => [...prev.slice(-2), { ...detail, id }]);
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 7000);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-3 text-[13px] shadow-lg ${
            t.tone === "error" ? "bg-rose-600 text-white" : "bg-slate-900 text-white"
          }`}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="shrink-0 opacity-80 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
