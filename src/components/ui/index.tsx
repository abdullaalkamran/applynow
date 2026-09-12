import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

const badgeStyles: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-rose-50 text-rose-700",
  violet: "bg-violet-50 text-violet-700",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof badgeStyles }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${badgeStyles[tone]}`}>
      {children}
    </span>
  );
}

export function statusTone(status: string): keyof typeof badgeStyles {
  const s = status.toLowerCase();
  if (["enrolled", "paid", "verified", "approved", "published", "active", "cleared", "done"].some((k) => s.includes(k))) return "green";
  if (["pending", "review", "draft", "in review", "expected", "investigating"].some((k) => s.includes(k))) return "amber";
  if (["rejected", "withdrawn", "disputed", "flagged", "frozen", "high", "compliance hold", "escalated"].some((k) => s.includes(k))) return "red";
  if (["offer", "decision", "submitted", "current"].some((k) => s.includes(k))) return "blue";
  return "neutral";
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status}</Badge>;
}

export function ProgressBar({
  value,
  size = "md",
  showLabel = false,
}: { value: number; size?: "sm" | "md" | "lg"; showLabel?: boolean }) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  const h = size === "sm" ? "h-1.5" : size === "lg" ? "h-3.5" : "h-2.5";
  const textClass = size === "sm" ? "text-xs" : "text-sm";

  // color tiers
  const tone = v >= 75 ? "bg-emerald-600" : v >= 45 ? "bg-amber-500" : "bg-rose-600";

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className={`w-full ${h} rounded-full bg-slate-100 overflow-hidden`}
    >
      <div
        className={`${h} rounded-full shadow-sm transition-all ${tone} progress-stripes flex items-center justify-center`}
        style={{ width: `${v}%` }}
      >
        {showLabel && (
          <span className={`text-white font-semibold ${textClass} px-2`}>{v}%</span>
        )}
      </div>
    </div>
  );
}

export function StepBar({
  stages,
  compact = false,
}: {
  stages: { key: string; label: string; status: string }[];
  compact?: boolean;
}) {
  const len = stages.length;
  return (
    <div className={`w-full ${compact ? 'text-xs' : 'text-sm'}`}>
      <div className="flex items-center gap-3">
        {stages.map((s, i) => {
          const done = s.status === 'done';
          const current = s.status === 'current';
          const blocked = s.status === 'blocked';
          const circleClass = done ? 'bg-emerald-600 text-white' : blocked ? 'bg-rose-500 text-white' : current ? 'bg-[var(--brand-600)] text-white' : 'bg-slate-100 text-slate-700';
          const connectorDone = i < stages.findIndex(st => st.status === 'current') || done;
          return (
            <div key={s.key} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-3 w-full">
                <div className="flex items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${circleClass}`}>
                    {done ? <Check size={14} /> : <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{i + 1}</span>}
                  </div>
                </div>
                {i < len - 1 && (
                  <div className={`ml-3 h-1 flex-1 rounded-full ${connectorDone ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                )}
              </div>
              {!compact && (
                <div className="min-w-0">
                  <p className={`truncate font-medium ${done ? 'text-slate-800' : current ? 'text-[var(--brand-600)]' : 'text-slate-500'}`}>{s.label}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Button({
  children, onClick, variant = "primary", className = "", type = "button", disabled,
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string; type?: "button" | "submit"; disabled?: boolean;
}) {
  const styles: Record<string, string> = {
    primary: "bg-[var(--brand-600)] text-white hover:bg-[var(--brand-700)]",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 py-12 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: keyof typeof badgeStyles }) {
  return (
    <Card className="flex-1">
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className={`mt-1.5 text-2xl font-semibold ${tone === "red" ? "text-rose-600" : tone === "green" ? "text-emerald-600" : "text-slate-900"}`}>{value}</p>
      </CardBody>
    </Card>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            {head.map((h) => (
              <th key={h} className="px-5 py-3 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Avatar({ name, colorClass }: { name: string; colorClass: string }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${colorClass}`}>
      {initials}
    </div>
  );
}

/** A text input that filters `options` as you type and shows a click-to-pick suggestion list —
 * for pickers with too many options to comfortably scroll a plain <select> (e.g. course/subject). */
export function SearchableSelect({
  value, onChange, options, placeholder = "Search…",
}: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  const [query, setQuery] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(value);
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [value]);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div ref={containerRef} className="relative mt-1">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setQuery(""); setOpen(true); }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[var(--sd-ink)] focus:outline-none"
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">No matches</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => { onChange(o); setQuery(o); setOpen(false); }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${o === value ? "font-medium text-[var(--sd-ink)]" : "text-slate-700"}`}
              >
                {o}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** A compact "label: value" filter button that opens a small popover of options with counts —
 * for filters with more options than comfortably fit as a row of pills (country, source, etc.). */
export function FilterMenu({
  label, icon, value, onChange, options, counts,
}: {
  label: string; icon?: ReactNode; value: string; onChange: (v: string) => void; options: string[]; counts: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFiltered = value !== "All";

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
          isFiltered
            ? "border-[var(--sd-ink)]/30 bg-[var(--sd-ink)]/[0.06] text-[var(--sd-ink)]"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        {icon}
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold">{value}</span>
        {isFiltered && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--sd-ink)]/10 px-1 text-[10px] font-semibold">
            {counts[value] ?? 0}
          </span>
        )}
        <ChevronDown size={12} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1.5 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setOpen(false); }}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${
                o === value ? "font-semibold text-[var(--sd-ink)]" : "text-slate-700"
              }`}
            >
              {o}
              <span className="text-[10px] text-slate-400">{counts[o] ?? 0}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
