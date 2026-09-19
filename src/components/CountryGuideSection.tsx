// Renders a country's "Country Guide" content (see countryRegistry.ts) on a university's profile
// page — shared between student and agent, since the content itself is country-level, not
// per-university. Sections that haven't been filled in yet by Data Management simply don't render.
import { useState } from "react";
import { ChevronDown, Download, FileText } from "lucide-react";
import type { CountryRecord } from "../data/countryRegistry";

function StepList({ text }: { text: string }) {
  const steps = text.split("\n").map((s) => s.trim()).filter(Boolean);
  if (steps.length === 0) return null;
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-700">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-50)] text-[10.5px] font-semibold text-[var(--brand-700)]">
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

/** `hideWhyThisCountry` skips the intro block for callers that already show it elsewhere on the
 * page (the Country Detail Overview tab renders it as its own card under Key Information). */
export function CountryGuideSection({ country, hideWhyThisCountry = false }: { country: CountryRecord | undefined; hideWhyThisCountry?: boolean }) {
  const showWhy = !!country?.whyThisCountry && !hideWhyThisCountry;
  const hasAnything =
    !!country && !!(showWhy || country.applicationProcedure || country.visaProcedure || country.requiredDocuments?.length);

  if (!hasAnything) {
    return (
      <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-[0_0_10px_rgba(0,0,0,0.11)]">
        <p className="text-sm font-medium text-slate-700">Country guide not added yet</p>
        <p className="mt-1 text-xs text-slate-400">Data Management hasn't filled in this country's guide content.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showWhy && (
        <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
          <p className="text-[13px] font-semibold text-slate-800">Why This Country</p>
          <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-slate-600">{country!.whyThisCountry}</p>
        </div>
      )}

      {!!country?.requiredDocuments?.length && (
        <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
          <p className="text-[13px] font-semibold text-slate-800">Required Documents</p>
          <div className="mt-2 space-y-2.5">
            {country.requiredDocuments.map((doc) => (
              <div key={doc.id} className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
                <FileText size={15} className="mt-0.5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-800">{doc.name}</p>
                  {doc.description && <p className="mt-0.5 text-[12px] text-slate-500">{doc.description}</p>}
                </div>
                {doc.sampleFileDataUrl && (
                  <a
                    href={doc.sampleFileDataUrl}
                    download={doc.sampleFileName || doc.name}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--sd-ink)] shadow-[0_0_6px_rgba(0,0,0,0.08)]"
                  >
                    <Download size={12} /> Sample
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {country?.applicationProcedure && (
        <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
          <p className="text-[13px] font-semibold text-slate-800">Application Procedure</p>
          <div className="mt-3">
            <StepList text={country.applicationProcedure} />
          </div>
        </div>
      )}

      {country?.visaProcedure && (
        <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
          <p className="text-[13px] font-semibold text-slate-800">Visa Procedure</p>
          <div className="mt-3">
            <StepList text={country.visaProcedure} />
          </div>
        </div>
      )}
    </div>
  );
}

/** A collapsed-by-default entry point onto a country's Guide content, for pages that browse a
 * country's programs (student/agent Explore, counsellor Partners) rather than dedicating a whole
 * tab to it the way UniversityDetail does. Renders nothing once there's genuinely no guide content
 * yet, instead of a permanently-collapsed empty accordion. */
export function CountryGuideDisclosure({ country }: { country: CountryRecord | undefined }) {
  const [open, setOpen] = useState(false);
  // "Why This Country" is deliberately excluded — the Overview cards above already show it.
  const hasAnything = !!country && !!(country.applicationProcedure || country.visaProcedure || country.requiredDocuments?.length);

  if (!hasAnything) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-2xl bg-[var(--sd-card)] p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.11)]"
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
          <FileText size={15} className="text-slate-400" /> Country Guide
        </span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3">
          <CountryGuideSection country={country} hideWhyThisCountry />
        </div>
      )}
    </div>
  );
}
