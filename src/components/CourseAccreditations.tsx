import { Award } from "lucide-react";
import type { CourseAccreditation } from "../types";
import { SectionBoundary } from "./SectionBoundary";

/** What a course may carry as accreditations: a plain name ("IET" — what imports and the public API produce) or a
 * { name, logoUrl } object (what Data Management's course form saves). */
export type AccreditationInput = string | Partial<CourseAccreditation> | null | undefined;

/** Accepts either shape, in any mix, and returns clean { name, logoUrl? } items — no empty names, no repeats, never throws. */
export function normalizeAccreditations(input: unknown): CourseAccreditation[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: CourseAccreditation[] = [];
  for (const item of input as AccreditationInput[]) {
    const name = (typeof item === "string" ? item : typeof item?.name === "string" ? item.name : "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const logoUrl = typeof item === "object" && item && typeof item.logoUrl === "string" && item.logoUrl.trim() ? item.logoUrl.trim() : undefined;
    out.push(logoUrl ? { name, logoUrl } : { name });
  }
  return out;
}

/** The bodies that accredit one specific course — logo (or initials) + name badges, rendered on the course's Overview across
 * the public, student, agent and counsellor pages. Renders nothing when the course has none, and a problem here can never take
 * the page down with it. */
export function CourseAccreditations({ accreditations, className = "" }: { accreditations?: unknown; className?: string }) {
  return (
    <SectionBoundary name="accreditations">
      <Badges accreditations={accreditations} className={className} />
    </SectionBoundary>
  );
}

function Badges({ accreditations, className }: { accreditations?: unknown; className: string }) {
  const items = normalizeAccreditations(accreditations);
  if (!items.length) return null;
  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-neutral-700">
        <Award size={14} className="text-neutral-400" /> Accredited by
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((a, i) => (
          <span key={`${a.name}-${i}`} className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white py-1.5 pl-1.5 pr-3 text-[12px] font-medium text-neutral-700">
            {a.logoUrl ? (
              <img src={a.logoUrl} alt={`${a.name} logo`} className="h-7 w-7 rounded-md object-contain" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100 text-[11px] font-semibold text-neutral-500">
                {a.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            {a.name}
          </span>
        ))}
      </div>
    </div>
  );
}
