import {
  Children, Fragment, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ChangeEvent, type ReactElement, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

interface Option { value: string; label: ReactNode; disabled: boolean }

// Pulls <option> elements out of the children (through fragments and arrays), so call sites keep writing plain
// <option value="x">Label</option> exactly as they did for a native <select>.
function collectOptions(children: ReactNode, out: Option[] = []): Option[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>;
    if (el.type === Fragment) collectOptions(el.props.children, out);
    else if (el.type === "option") {
      const label = el.props.children;
      const text = typeof label === "string" || typeof label === "number" ? String(label) : "";
      out.push({ value: el.props.value !== undefined ? String(el.props.value) : text, label, disabled: !!el.props.disabled });
    }
  });
  return out;
}

const textOf = (n: ReactNode): string => (typeof n === "string" || typeof n === "number" ? String(n) : Array.isArray(n) ? n.map(textOf).join("") : "");

/**
 * The app's own dropdown — a drop-in for <select>: same `value` / `onChange` / <option> children, but the list opens as a
 * soft raised panel in the app's style instead of the phone's native picker. Keyboard: Enter/Space/↓ open, ↑↓ move,
 * Home/End, Enter select, Esc close, type a letter to jump. The panel is portalled to <body>, so a card's overflow never
 * clips it, and it flips above the field when there's no room below.
 */
export function NeuSelect({
  value, onChange, children, name, id, disabled, className = "", variant = "field", startAdornment, searchable = false, "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  /** "field" = a full-width recessed field; "inline" = a compact raised chip (e.g. a phone dial-code picker). */
  variant?: "field" | "inline";
  startAdornment?: ReactNode;
  /** The field is also a text box: typing narrows the list, but only picking an entry sets the value (free text is never kept). */
  searchable?: boolean;
  "aria-label"?: string;
}) {
  const allOptions = useMemo(() => collectOptions(children), [children]);
  const selected = allOptions.find((o) => o.value === value);
  const [query, setQuery] = useState("");
  // While searching, hide the "Select …" placeholder row and keep only entries containing every typed word.
  const options = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!searchable || words.length === 0) return allOptions;
    return allOptions.filter((o) => o.value !== "" && words.every((w) => textOf(o.label).toLowerCase().includes(w)));
  }, [allOptions, query, searchable]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxH: number; above: boolean } | null>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = `neusel-${useId().replace(/:/g, "")}`;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const above = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxH = Math.max(120, Math.min(280, above ? spaceAbove : spaceBelow));
    const width = Math.max(r.width, variant === "inline" ? 200 : r.width);
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - width - 8));
    setPos({ left, top: above ? r.top - 6 : r.bottom + 6, width, maxH, above });
  }, [variant]);

  const openList = () => {
    if (disabled) return;
    place();
    setActive(Math.max(0, allOptions.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = useCallback(() => { setOpen(false); setQuery(""); }, []);

  const choose = (opt: Option) => {
    if (opt.disabled) return;
    const target = { value: opt.value, name: name ?? "", id: id ?? "" };
    onChange({ target, currentTarget: target } as unknown as ChangeEvent<HTMLSelectElement>);
    close();
    // A searchable field opens itself on focus, so refocusing it here popped the list straight back open after every pick.
    // Drop focus instead; a plain button keeps it for keyboard users.
    if (searchable) inputRef.current?.blur();
    else triggerRef.current?.focus();
  };

  // Keep the panel attached to the field while the page scrolls or resizes; close on an outside press.
  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    const outside = (e: Event) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !listRef.current?.contains(t)) close();
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside, { passive: true });
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("touchstart", outside);
    };
  }, [open, place, close]);

  useLayoutEffect(() => {
    if (open && active >= 0) listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", ...(searchable ? [] : [" "])].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    const enabled = (i: number) => !options[i]?.disabled;
    const step = (dir: 1 | -1) => {
      let i = active;
      for (let n = 0; n < options.length; n++) { i = (i + dir + options.length) % options.length; if (enabled(i)) break; }
      setActive(i);
    };
    if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
    else if (e.key === "Home") { e.preventDefault(); setActive(options.findIndex((_, i) => enabled(i))); }
    else if (e.key === "End") { e.preventDefault(); for (let i = options.length - 1; i >= 0; i--) if (enabled(i)) { setActive(i); break; } }
    else if (e.key === "Enter" || (e.key === " " && !searchable)) { e.preventDefault(); if (options[active]) choose(options[active]); }
    else if (e.key === "Escape" || e.key === "Tab") { if (e.key === "Escape") e.preventDefault(); close(); }
    else if (e.key.length === 1 && !searchable) {
      const k = e.key.toLowerCase();
      const from = (active + 1) % options.length;
      for (let n = 0; n < options.length; n++) {
        const i = (from + n) % options.length;
        if (enabled(i) && textOf(options[i].label).trim().toLowerCase().startsWith(k)) { setActive(i); break; }
      }
    }
  }

  const empty = !selected || selected.value === "";
  return (
    <>
      {searchable ? (
        <div
          ref={triggerRef as React.RefObject<HTMLDivElement>}
          className={`neu-select-trigger ${variant === "inline" ? "neu-select-trigger--inline" : ""} ${disabled ? "opacity-60" : ""} cursor-text ${className}`}
          onClick={(e) => {
            // Pressing the arrow (anywhere outside the text box) while the list is open closes it.
            if (open && e.target !== inputRef.current) { close(); inputRef.current?.blur(); return; }
            inputRef.current?.focus();
            if (!open) openList();
          }}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            {startAdornment}
            <input
              ref={inputRef}
              id={id}
              name={name}
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-autocomplete="list"
              aria-label={ariaLabel}
              disabled={disabled}
              autoComplete="off"
              value={open ? query : selected && selected.value !== "" ? textOf(selected.label) : ""}
              placeholder={selected && selected.value !== "" ? textOf(selected.label) : selected ? textOf(selected.label) : allOptions[0] ? textOf(allOptions[0].label) : ""}
              onChange={(e) => { setQuery(e.target.value); setActive(0); if (!open) { place(); setOpen(true); } }}
              onFocus={() => { if (!open) openList(); }}
              onKeyDown={onKeyDown}
              onBlur={() => window.setTimeout(() => { if (document.activeElement !== inputRef.current) close(); }, 120)}
              onClick={(e) => e.stopPropagation()}
              className="neu-select-input min-w-0 flex-1 truncate border-0 p-0 text-inherit shadow-none outline-none placeholder:text-neutral-500"
              style={{ boxShadow: "none", background: "transparent" }}
            />
          </span>
          <ChevronDown size={14} className={`shrink-0 text-neutral-900 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </div>
      ) : (
      <button
        ref={triggerRef as React.RefObject<HTMLButtonElement>}
        type="button"
        id={id}
        name={name}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={`neu-select-trigger ${variant === "inline" ? "neu-select-trigger--inline" : ""} ${className}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          {startAdornment}
          <span className={`min-w-0 flex-1 truncate ${empty ? "text-neutral-500" : ""}`}>{selected ? selected.label : value}</span>
        </span>
        <ChevronDown size={14} className={`shrink-0 text-neutral-900 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      )}

      {open && pos && createPortal(
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          style={{ position: "fixed", left: pos.left, width: pos.width, maxHeight: pos.maxH, ...(pos.above ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
          className="neu-theme z-[80] overflow-y-auto rounded-2xl bg-[var(--sd-card)] p-1.5 shadow-neu-lg"
        >
          {options.length === 0 && <div className="px-3 py-2 text-[12.5px] text-neutral-500">No matches</div>}
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <div
                key={`${o.value}-${i}`}
                data-idx={i}
                role="option"
                aria-selected={isSel}
                aria-disabled={o.disabled || undefined}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-[13px] leading-snug transition-shadow ${
                  o.disabled ? "cursor-not-allowed opacity-40" : ""
                } ${i === active ? "shadow-neu-inset-sm" : ""} ${isSel ? "font-semibold text-neutral-900" : "text-neutral-700"}`}
              >
                <span className="min-w-0 flex-1">{o.label}</span>
                {isSel && <Check size={14} className="shrink-0 text-neutral-900" aria-hidden="true" />}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
