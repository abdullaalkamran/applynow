import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Compass, FileText, MessageCircle, User, Upload, Loader2, Check, RotateCcw, X, Sparkles } from "lucide-react";

/** Small circular back-arrow button, reused standalone on tab-root screens and inside MobileHeader. */
export function BackButton({ onBack }: { onBack?: () => void }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => (onBack ? onBack() : navigate(-1))}
      aria-label="Back"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--sd-ink)] shadow-sm shadow-black/5"
    >
      <ArrowLeft size={18} />
    </button>
  );
}

/** Back-header used on every "pushed" student screen (not a bottom-tab root). */
export function MobileHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pb-2 pt-5">
      <BackButton onBack={onBack} />
      <h1 className="truncate px-2 text-[15px] font-semibold text-slate-900">{title}</h1>
      {right ?? <div className="h-9 w-9 shrink-0" />}
    </div>
  );
}

const TABS: { path: string; label: string; icon: typeof Home }[] = [
  { path: "/student", label: "Home", icon: Home },
  { path: "/student/search", label: "Explore", icon: Compass },
  { path: "/student/applications", label: "Applications", icon: FileText },
  { path: "/student/messages", label: "Messages", icon: MessageCircle },
  { path: "/student/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const location = useLocation();
  return (
    <div className="flex shrink-0 items-stretch justify-between border-t border-black/5 bg-white px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
      {TABS.map((t) => {
        const active = location.pathname === t.path;
        const Icon = t.icon;
        return (
          <NavLink key={t.path} to={t.path} className="flex flex-1 flex-col items-center gap-1 py-1">
            <Icon size={21} className={active ? "text-[var(--sd-ink)]" : "text-slate-400"} strokeWidth={active ? 2.4 : 2} />
            <span className={`text-[10px] font-medium ${active ? "text-[var(--sd-ink)]" : "text-slate-400"}`}>{t.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}

const pillTones: Record<string, string> = {
  blue: "bg-[#E7EEFC] text-[#2955C4]",
  green: "bg-[#E3F6EC] text-[#12805A]",
  teal: "bg-[#E1F5F0] text-[#0F8A78]",
  rose: "bg-[#FCEAF0] text-[#C23D6B]",
  amber: "bg-[#FDF0DC] text-[#B8791C]",
  violet: "bg-[#F1EAFB] text-[#6D3FBF]",
  navy: "bg-[var(--sd-ink)] text-white",
  gray: "bg-slate-100 text-slate-500",
};

export function Pill({ children, tone = "gray", className = "" }: { children: ReactNode; tone?: keyof typeof pillTones; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${pillTones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function IconTile({ icon, tone = "blue" }: { icon: ReactNode; tone?: "blue" | "green" | "violet" | "rose" | "amber" }) {
  const bg: Record<string, string> = {
    blue: "bg-[#E7EEFC] text-[#2955C4]",
    green: "bg-[#E3F6EC] text-[#12805A]",
    violet: "bg-[#F1EAFB] text-[#6D3FBF]",
    rose: "bg-[#FCEAE8] text-[#D8473C]",
    amber: "bg-[#FDF0DC] text-[#D9891F]",
  };
  return <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg[tone]}`}>{icon}</div>;
}

const skylineTones: Record<string, [string, string]> = {
  violet: ["#8B7BD8", "#4B3F8C"],
  amber: ["#E8B168", "#B9702E"],
  teal: ["#6FC4B3", "#1F7A6C"],
  rose: ["#E893A8", "#B14A63"],
};

/** Months between now and a yyyy-mm-dd date string (negative if already past); null if the date is blank/invalid. */
export function monthsUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
}

export const inputClass =
  "w-full rounded-xl bg-white px-3.5 py-3 text-[13px] text-slate-800 shadow-sm shadow-black/[0.03] focus:outline-none focus:ring-2 focus:ring-[var(--sd-ink)]/10 disabled:opacity-60";

/** Labeled form field wrapper used across the mobile forms — shows an "Auto-filled" badge and/or an error line. */
export function FieldShell({
  label, autoFilled, error, children,
}: { label: string; autoFilled?: boolean; error?: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-medium text-slate-500">
        {label}
        {autoFilled && (
          <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full bg-[#E3F6EC] px-1.5 py-0.5 text-[10px] font-medium text-[#12805A]">
            <Sparkles size={9} /> Auto-filled
          </span>
        )}
      </span>
      {children}
      {error && <span className="mt-1 block text-[11px] font-medium text-rose-500">{error}</span>}
    </div>
  );
}

export type ScanStatus = "idle" | "scanning" | "done";
export interface UploadedDoc { name: string; previewUrl?: string }

/** Labeled on/off switch used on settings-style screens (e.g. notification preferences). */
export function Toggle({
  checked, onChange, label, description,
}: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-700">{label}</p>
        {description && <p className="text-[11px] text-slate-400">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--sd-teal)]" : "bg-slate-200"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow shadow-black/10 transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

/** Small toggle-style chip button used for single- or multi-select filter/preference lists. */
export function Chip({
  label, selected, onClick, icon,
}: { label: string; selected: boolean; onClick: () => void; icon?: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
        selected ? "bg-[var(--sd-ink)] text-white" : "border border-slate-200 bg-white text-slate-600"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/** Tap-to-upload card that simulates scanning a document (passport, certificate, transcript) and reports back a status. */
export function DocumentUpload({
  file, status, title, description, scanningLabel = "Scanning…", doneLabel = "Details extracted", onPick, onRemove,
}: {
  file: UploadedDoc | null;
  status: ScanStatus;
  title: string;
  description: string;
  scanningLabel?: string;
  doneLabel?: string;
  onPick: () => void;
  onRemove: () => void;
}) {
  if (!file) {
    return (
      <button
        onClick={onPick}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/60 py-6 text-center"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E7EEFC] text-[#2955C4]">
          <Upload size={17} />
        </div>
        <p className="text-[13px] font-medium text-slate-700">{title}</p>
        <p className="max-w-[240px] text-[11px] leading-snug text-slate-400">{description}</p>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm shadow-black/[0.03]">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
        {file.previewUrl ? (
          <img src={file.previewUrl} alt="Document preview" className="h-full w-full object-cover" />
        ) : (
          <FileText size={20} className="text-slate-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-800">{file.name}</p>
        {status === "scanning" && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-slate-400">
            <Loader2 size={12} className="animate-spin" /> {scanningLabel}
          </p>
        )}
        {status === "done" && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-[var(--sd-teal)]">
            <Check size={12} /> {doneLabel}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button onClick={onPick} aria-label="Replace" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50">
          <RotateCcw size={14} />
        </button>
        <button onClick={onRemove} aria-label="Remove" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/** Self-contained illustrated "skyline" hero — stands in for a university photo without an external asset. */
export function SkylineArt({ tone = "violet", className = "" }: { tone?: keyof typeof skylineTones; className?: string }) {
  const [from, to] = skylineTones[tone];
  const gid = `sky-${tone}`;
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className={className}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill={`url(#${gid})`} />
      <g fill="#000" opacity="0.16">
        <rect x="20" y="150" width="34" height="110" />
        <rect x="60" y="120" width="26" height="140" />
        <rect x="94" y="165" width="30" height="95" />
        <rect x="270" y="140" width="30" height="120" />
        <rect x="306" y="170" width="24" height="90" />
        <rect x="336" y="130" width="34" height="130" />
      </g>
      <g fill="#000" opacity="0.22">
        <rect x="168" y="70" width="20" height="190" />
        <rect x="160" y="60" width="36" height="16" />
        <rect x="174" y="40" width="8" height="24" />
        <circle cx="178" cy="34" r="5" />
        <rect x="150" y="230" width="76" height="30" />
      </g>
      <circle cx="330" cy="46" r="22" fill="#fff" opacity="0.18" />
    </svg>
  );
}
