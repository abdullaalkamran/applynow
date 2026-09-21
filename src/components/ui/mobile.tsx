import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Home, Compass, FileText, MessageCircle, Phone, User, Upload, Loader2, Check, RotateCcw, X,
  Sparkles, ChevronDown, GraduationCap, Copy, AlertCircle,
} from "lucide-react";
import type { SupportContact } from "../../types";
import type { ChecklistDoc } from "../../utils/documentChecklist";

/** Small circular back-arrow button, reused standalone on tab-root screens and inside MobileHeader. */
export function BackButton({ onBack }: { onBack?: () => void }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => (onBack ? onBack() : navigate(-1))}
      aria-label="Back"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--sd-card)] text-[var(--sd-ink)] shadow-[0_0_8px_rgba(0,0,0,0.07)]"
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

export const STUDENT_TABS: { path: string; label: string; icon: typeof Home }[] = [
  { path: "/student", label: "Home", icon: Home },
  { path: "/student/search", label: "Explore", icon: Compass },
  { path: "/student/applications", label: "Applications", icon: FileText },
  { path: "/student/messages", label: "Messages", icon: MessageCircle },
  { path: "/student/profile", label: "Profile", icon: User },
];

/** Bottom tab bar — the primary nav on narrow (mobile) viewports. */
export function BottomNav() {
  const location = useLocation();
  return (
    <div className="flex shrink-0 items-stretch justify-between border-t border-black/5 bg-[var(--sd-card)] px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
      {STUDENT_TABS.map((t) => {
        const active = location.pathname === t.path;
        const Icon = t.icon;
        return (
          <NavLink key={t.path} to={t.path} className="flex flex-1 flex-col items-center gap-1 py-1">
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${active ? "bg-[image:var(--sd-gradient)] text-white" : "text-slate-400"}`}>
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
            </span>
            <span className={`text-[10px] font-medium ${active ? "text-[var(--sd-ink)]" : "text-slate-400"}`}>{t.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}

/** Left nav rail — the primary nav on wide (desktop) viewports, replacing the bottom tab bar. */
export function Sidebar() {
  const location = useLocation();
  return (
    <aside className="flex h-dvh w-64 shrink-0 flex-col border-r border-black/5 bg-[var(--sd-card)] px-4 py-6">
      <div className="flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[image:var(--sd-gradient)] text-white">
          <GraduationCap size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-slate-900">StudyOne</p>
          <p className="truncate text-[11px] leading-tight text-slate-400">Student Portal</p>
        </div>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {STUDENT_TABS.map((t) => {
          const active = location.pathname === t.path;
          const Icon = t.icon;
          return (
            <NavLink
              key={t.path}
              to={t.path}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                active ? "bg-[var(--brand-50)] text-[var(--sd-ink)]" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[image:var(--sd-gradient)]" />}
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              {t.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

const pillTones: Record<string, string> = {
  blue: "bg-[#E7EEFC] text-[#2955C4]",
  green: "bg-[#E3F6EC] text-[#12805A]",
  teal: "bg-[#E1F5F0] text-[#0F8A78]",
  rose: "bg-[#FCEAF0] text-[#C23D6B]",
  amber: "bg-[#FDF0DC] text-[#B8791C]",
  violet: "bg-[#F1EAFB] text-[#6D3FBF]",
  navy: "bg-[image:var(--sd-gradient)] text-white",
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
  "w-full rounded-xl bg-[var(--sd-card)] px-3.5 py-3 text-[13px] text-slate-800 shadow-[0_0_10px_rgba(0,0,0,0.11)] focus:outline-none focus:ring-2 focus:ring-[var(--sd-ink)]/10 disabled:opacity-60";

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

export type ScanStatus = "idle" | "scanning" | "done" | "unavailable";
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
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--sd-card)] shadow-[0_0_6px_rgba(0,0,0,0.13)] transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

/** Titled card wrapper used to group related fields on settings/filter forms. */
export function Section({
  icon, title, subtitle, children,
}: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_14px_rgba(0,0,0,0.11)]">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7EEFC] text-[#2955C4]">
          {icon}
        </div>
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Small uppercase-weight label above a control within a Section. */
export function SubLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mb-1.5 text-xs font-medium text-slate-500 ${className}`}>{children}</p>;
}

/** Flex-wrap row for a group of Chip buttons. */
export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

/** Small toggle-style chip button used for single- or multi-select filter/preference lists. */
export function Chip({
  label, selected, onClick, icon,
}: { label: string; selected: boolean; onClick: () => void; icon?: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
        selected ? "bg-[image:var(--sd-gradient)] text-white" : "border border-slate-200 bg-[var(--sd-card)] text-slate-600"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Collapsed dropdown-style trigger for a multi-select Chip list — shows a summary
 * ("Any" / one value / "N selected") and only reveals the chip options when tapped.
 * `open`/`onToggleOpen` are controlled by the caller so only one such dropdown is
 * expanded at a time on a page with several of these.
 */
export function DropdownChips({
  label, options, selected, onToggle, open, onToggleOpen, placeholder = "Any",
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  open: boolean;
  onToggleOpen: () => void;
  placeholder?: string;
}) {
  const summary = selected.size === 0 ? placeholder : selected.size === 1 ? [...selected][0] : `${selected.size} selected`;
  return (
    <div>
      <SubLabel>{label}</SubLabel>
      <button
        type="button"
        aria-label={label}
        onClick={onToggleOpen}
        className="flex w-full items-center justify-between rounded-xl bg-[var(--sd-card)] px-3.5 py-3 text-left text-[13px] shadow-[0_0_10px_rgba(0,0,0,0.11)] focus:outline-none"
      >
        <span className={selected.size === 0 ? "text-slate-400" : "font-medium text-slate-800"}>{summary}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
          {options.map((o) => (
            <Chip key={o} label={o} selected={selected.has(o)} onClick={() => onToggle(o)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Free-text input with a live filtered suggestion list dropped below it — tapping a suggestion fills the field. */
export function SuggestInput({
  value, onChange, options, placeholder,
}: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  const q = value.trim().toLowerCase();
  const suggestions = q ? options.filter((o) => o.toLowerCase().includes(q)).slice(0, 6) : [];
  const showSuggestions = focused && suggestions.length > 0;

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        className={inputClass}
      />
      {showSuggestions && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl bg-[var(--sd-card)] shadow-[0_0_20px_rgba(0,0,0,0.13)]">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s); setFocused(false); }}
              className="block w-full px-3.5 py-2.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tap-to-upload card that scans a document (passport, certificate, transcript) and reports back a status. */
export function DocumentUpload({
  file, status, title, description, scanningLabel = "Scanning…", doneLabel = "Details extracted",
  unavailableLabel = "Couldn't auto-fill — check the details below", onPick, onRemove,
}: {
  file: UploadedDoc | null;
  status: ScanStatus;
  title: string;
  description: string;
  scanningLabel?: string;
  doneLabel?: string;
  unavailableLabel?: string;
  onPick: () => void;
  onRemove: () => void;
}) {
  if (!file) {
    return (
      <button
        onClick={onPick}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-[var(--sd-card)]/60 py-6 text-center"
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
    <div className="flex items-center gap-3 rounded-2xl bg-[var(--sd-card)] p-3 shadow-[0_0_14px_rgba(0,0,0,0.11)]">
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
        {status === "unavailable" && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-amber-600">
            <AlertCircle size={12} /> {unavailableLabel}
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

const logoBadgeTones: Record<string, [string, string]> = {
  violet: ["#8B7BD8", "#4B3F8C"],
  amber: ["#E8B168", "#B9702E"],
  teal: ["#6FC4B3", "#1F7A6C"],
  rose: ["#E893A8", "#B14A63"],
};

/** Monogram badge standing in for a university crest/logo — deterministic color from `tone`. */
export function LogoBadge({
  name, tone = "violet", logoUrl, className = "",
}: { name: string; tone?: keyof typeof logoBadgeTones; logoUrl?: string; className?: string }) {
  if (logoUrl) {
    // object-contain (not object-cover) so a non-square logo — a crest, a wordmark — shows in full
    // rather than getting cropped to fill the badge; the white backing keeps it legible on any
    // background the badge sits on, same as a real logo lockup would use.
    return (
      <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white ${className}`}>
        <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-contain" />
      </div>
    );
  }
  const initials = name.replace(/^University of /, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const [from, to] = logoBadgeTones[tone];
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl text-[13px] font-bold text-white ${className}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {initials}
    </div>
  );
}

/** Small pill with a chevron that opens a single-select dropdown list — used for compact inline filters. */
export function PillSelect({
  label, value, options, onChange, placeholder = "All", active = false,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void; placeholder?: string; active?: boolean }) {
  const [open, setOpen] = useState(false);
  const isSet = value !== "";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-medium transition-colors ${
          isSet || active ? "bg-[var(--brand-500)] text-[var(--ink-900)]" : "border border-slate-200 bg-[var(--sd-card)] text-slate-600"
        }`}
      >
        {isSet ? value : label}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <button aria-hidden className="fixed inset-0 z-10" onClick={() => setOpen(false)} tabIndex={-1} />
          <div className="absolute left-0 z-20 mt-1.5 max-h-64 w-44 overflow-y-auto rounded-xl bg-[var(--sd-card)] p-1.5 shadow-[0_0_20px_rgba(0,0,0,0.15)]">
            <button
              onClick={() => { onChange(""); setOpen(false); }}
              className={`block w-full rounded-lg px-2.5 py-2 text-left text-[13px] ${value === "" ? "font-semibold text-[var(--sd-ink)]" : "text-slate-600"}`}
            >
              {placeholder}
            </button>
            {options.map((o) => (
              <button
                key={o}
                onClick={() => { onChange(o); setOpen(false); }}
                className={`block w-full rounded-lg px-2.5 py-2 text-left text-[13px] ${value === o ? "font-semibold text-[var(--sd-ink)]" : "text-slate-600"}`}
              >
                {o}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** A support-team contact row with Chat/WhatsApp/Call actions — used on the Dashboard and on an application's own team list. */
export function SupportRow({ contact, onChat }: { contact: SupportContact; onChat: () => void }) {
  const initials = contact.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  const digits = contact.phone.replace(/\D/g, "");

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${contact.avatarColor}`}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{contact.name}</p>
        <p className="truncate text-xs text-slate-400">
          {contact.role}
          {contact.organization ? ` · ${contact.organization}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={onChat}
          aria-label={`Chat with ${contact.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E7EEFC] text-[#2955C4]"
        >
          <MessageCircle size={14} />
        </button>
        <a
          href={`https://wa.me/${digits}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${contact.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E3F6EC] text-[#12805A]"
        >
          <MessageCircle size={14} />
        </a>
        <a
          href={`tel:+${digits}`}
          aria-label={`Call ${contact.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[image:var(--sd-gradient)] text-white"
        >
          <Phone size={14} />
        </a>
      </div>
    </div>
  );
}

const docStatusTone: Record<string, string> = {
  verified: "text-[var(--sd-teal)]",
  pending: "text-[#B8791C]",
  uploaded: "text-[#B8791C]",
  rejected: "text-rose-500",
  flagged: "text-rose-500",
};

const docStatusLabel: Record<string, string> = { uploaded: "Pending review" };

/**
 * One row of an application's auto-built document checklist — shows whichever of four states
 * applies: already on file, reused from another application, mid-upload, or still missing.
 * Shared between the Application Detail page and the My Documents overview so both stay in sync.
 */
export function DocChecklistRow({
  type, own, reused, rejected, requested, highlighted, highlightLabel, isUploading, uploadingFile, scanStatus, onStartUpload, onCancelUpload,
}: {
  type: string;
  own?: { name: string; status: string };
  reused?: ChecklistDoc;
  // Core-doc only: the most recent upload was rejected by the counsellor and nothing's replaced
  // it yet — shown instead of the plain "Not uploaded yet" empty state, with the reason and a
  // "Re-upload" affordance (reuses onStartUpload — a fresh upload simply supersedes it).
  rejected?: { reason?: string };
  // Still missing, but a counsellor specifically asked for it (see documentChecklist.ts's
  // `requested` flag) — shown in red rather than the plain "not uploaded yet" style so it doesn't
  // blend in with the rest of the standard checklist.
  requested?: boolean;
  highlighted?: boolean;
  highlightLabel?: string;
  isUploading: boolean;
  uploadingFile: UploadedDoc | null;
  scanStatus: ScanStatus;
  onStartUpload: () => void;
  onCancelUpload: () => void;
}) {
  if (own) {
    return (
      <div className={`flex items-center gap-3 rounded-2xl border p-3.5 ${highlighted ? "border-[#F3D9A8] bg-[#FDF6E9]" : "border-slate-100 bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.06)]"}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E7EEFC] text-[#2955C4]">
          <FileText size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-slate-800">{type}</p>
          <p className="truncate text-xs text-slate-400">{own.name}</p>
        </div>
        <span className={`shrink-0 text-xs font-medium capitalize ${docStatusTone[own.status] ?? "text-slate-400"}`}>
          {docStatusLabel[own.status] ?? own.status}
        </span>
      </div>
    );
  }

  if (reused) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[#B9E2D4] bg-[#EAF9F2] p-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#12805A]/10 text-[#12805A]">
          <Copy size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-slate-800">{type}</p>
          <p className="truncate text-xs text-[#12805A]">Reused from {reused.sourceUniversity ?? "a previous application"} — no need to re-upload</p>
        </div>
      </div>
    );
  }

  if (isUploading) {
    return (
      <div className={`rounded-2xl border p-3.5 ${highlighted ? "border-[#F3D9A8] bg-[#FDF6E9]" : "border-slate-100 bg-[var(--sd-card)]"}`}>
        {highlighted && highlightLabel && <p className="mb-2 text-[12.5px] font-semibold text-[#8A5A11]">{highlightLabel}</p>}
        <DocumentUpload
          file={uploadingFile}
          status={scanStatus}
          title={`Upload ${type.toLowerCase()}`}
          description="We'll attach this to your checklist for this application."
          scanningLabel="Uploading…"
          doneLabel="Uploaded"
          onPick={onStartUpload}
          onRemove={onCancelUpload}
        />
      </div>
    );
  }

  // Every "not uploaded yet" card reads as red now, not just a rejected/counsellor-requested one —
  // it's still something the student needs to act on. `highlighted` (this stage's specific
  // blocker) gets its own amber call-out layered on top via the label/icon below, but the card
  // itself stays red so it's consistent with how the same item shows up in the Required section
  // of My Documents.
  return (
    <button
      onClick={onStartUpload}
      className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-3.5 text-left"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
        <AlertCircle size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-800">{type}</p>
        <p className="truncate text-xs text-rose-600">
          {rejected ? `Rejected — ${rejected.reason || "no reason given"}` : requested ? "Requested by counsellor — not uploaded yet" : highlighted && highlightLabel ? highlightLabel : "Not uploaded yet"}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white">
        <Upload size={12} /> {rejected ? "Re-upload" : "Upload"}
      </span>
    </button>
  );
}
