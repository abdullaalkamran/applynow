import { useState } from "react";
import { Plus, X } from "lucide-react";

const BASE_INPUT_CLASS = "rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800";

/** A repeatable "type it, click Add, see it as a removable chip" list — used for both Modules and
 * Accreditation on the Subject form and Modules/Careers on the Course form, since none is a single value and a plain comma-separated text field doesn't
 * give the same explicit add/remove interaction. */
export function ChipListEditor({
  label, placeholder, items, onChange,
}: { label: string; placeholder: string; items: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value || items.some((i) => i.toLowerCase() === value.toLowerCase())) return;
    onChange([...items, value]);
    setDraft("");
  }

  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <div className="mt-1 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={`w-full ${BASE_INPUT_CLASS}`}
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--brand-600)] px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
        >
          <Plus size={13} /> Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1.5 text-[11.5px] font-medium text-slate-700">
              {item}
              <button onClick={() => onChange(items.filter((i) => i !== item))} aria-label={`Remove ${item}`} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </label>
  );
}
