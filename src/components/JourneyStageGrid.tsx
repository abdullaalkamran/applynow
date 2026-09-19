import type { ComponentType, CSSProperties } from "react";
import {
  ArrowRight, CheckCircle2, CreditCard, FileText, GraduationCap, Mail, Plane, Users, Wallet, ScanLine,
} from "lucide-react";
import { STAGE_ORDER, type StageType, type ApplicationJourney } from "../types/journey";
import { computeCurrentStage } from "../utils/applicationJourneyEngine";

// The 4-across, snake-connected stage grid from the design: numbered cards with an icon, the
// stage's status, the date it was reached, one card highlighted as the current stage, and a
// bracket-shaped connector that carries the line from the end of one row round into the start
// of the next. Shared by the counsellor's application card and the student's application page
// so both roles see the same picture of the journey.
//
// The layout is the same at every width — always 4 columns with the connectors — and only the
// sizes change: a compact mode (icon above the text, smaller type) below the `@md` container
// width, a medium tier up to `@4xl` (the student page's column), the full design above that.
// All the geometry the connectors depend on (card height, gaps, the side room the brackets run
// in) is expressed as CSS variables switched by the same container
// query, so the brackets stay aligned in both modes without measuring the DOM.

const COLUMNS = 4;

// Compact / full geometry, as CSS variables the grid, cards and connectors all read.
const GEOMETRY_CLASSES =
  "[--card-h:92px] [--gap-x:8px] [--gap-y:22px] [--pad:8px] " +
  "@md:[--card-h:112px] @md:[--gap-x:16px] @md:[--gap-y:32px] @md:[--pad:12px] " +
  "@4xl:[--card-h:118px] @4xl:[--gap-x:24px] @4xl:[--gap-y:36px] @4xl:[--pad:16px]";

const STAGE_TITLE: Record<StageType, string> = {
  application: "Application",
  offer: "Offer",
  financial_readiness: "Financial",
  payment: "Payment",
  interview: "Interview",
  university_document: "Immigration",
  visa: "Visa",
  evisa: "E-Visa",
  enrolment: "Enrolment",
};

const STAGE_ICON: Record<StageType, ComponentType<{ className?: string }>> = {
  application: FileText,
  offer: Mail,
  financial_readiness: Wallet,
  payment: CreditCard,
  interview: Users,
  university_document: FileText,
  visa: Plane,
  evisa: ScanLine,
  enrolment: GraduationCap,
};

type Tone = "completed" | "current" | "ongoing" | "pending" | "notRequired";

// Statuses that mean "underway, with conditions still to satisfy" — shown amber whether or not
// the stage is the current one: the bank balance is being held but hasn't matured; the offer is
// in hand but conditional; the payment is being arranged or awaiting the university's confirmation.
const ONGOING_STATUSES: Partial<Record<StageType, string[]>> = {
  financial_readiness: ["Maintaining"],
  offer: ["Conditional"],
  payment: ["Preparing", "Waiting for Confirmation"],
};

const TONE_STYLES: Record<Tone, { card: string; iconWrap: string; title: string; status: string; number: string }> = {
  completed: {
    card: "border-emerald-100 bg-emerald-50/70",
    iconWrap: "bg-emerald-100 text-emerald-600",
    title: "text-slate-900",
    status: "text-slate-500",
    number: "text-slate-500",
  },
  current: {
    card: "border-2 border-rose-500 bg-rose-50/70",
    iconWrap: "bg-rose-500 text-white",
    title: "text-slate-900",
    status: "text-slate-500",
    number: "text-slate-500",
  },
  ongoing: {
    card: "border-amber-200 bg-amber-50/80",
    iconWrap: "bg-amber-100 text-amber-700",
    title: "text-slate-900",
    status: "text-amber-800",
    number: "text-slate-500",
  },
  pending: {
    card: "border-slate-200 bg-slate-50",
    iconWrap: "bg-slate-100 text-slate-800",
    title: "text-slate-900",
    status: "text-slate-500",
    number: "text-slate-500",
  },
  notRequired: {
    card: "border-slate-200 bg-slate-50",
    iconWrap: "bg-slate-100 text-slate-500",
    title: "text-slate-800",
    status: "text-slate-400",
    number: "text-slate-400",
  },
};

const LEGEND: { label: string; dot: string }[] = [
  { label: "Completed", dot: "bg-emerald-500" },
  { label: "In Progress", dot: "bg-rose-500" },
  { label: "Ongoing", dot: "bg-amber-400" },
  { label: "Pending", dot: "bg-slate-400" },
  { label: "Not Required", dot: "bg-slate-200" },
];

function shortDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Vertical positions inside the grid, in terms of the CSS variables above.
const rowTop = (row: number) => `calc(${row} * (var(--card-h) + var(--gap-y)))`;

/** A row-wrap bracket: out of the last card of row `r`, round the outside, into the first card of
 * row `r + 1`. Three pieces — right hook, middle bar, left hook — drawn with borders. */
function RowBracket({ row, done }: { row: number; done: boolean }) {
  const y1 = `calc(${rowTop(row)} + var(--card-h) / 2)`; // exit height (card centre) on the upper row
  const yg = `calc(${rowTop(row)} + var(--card-h) + var(--gap-y) / 2)`; // the horizontal run between rows
  const hookHeight = "calc(var(--card-h) / 2 + var(--gap-y) / 2)"; // y1→yg and yg→y2 are the same distance
  const line = done ? "border-emerald-500" : "border-slate-200";
  const hook: CSSProperties = { width: "var(--pad)", height: hookHeight };
  return (
    <>
      <div className={`pointer-events-none absolute rounded-r-2xl border-b border-r border-t ${line}`} style={{ ...hook, left: "100%", top: y1 }} />
      <div className={`pointer-events-none absolute left-0 right-0 border-t ${line}`} style={{ top: yg }} />
      <div className={`pointer-events-none absolute rounded-l-2xl border-b border-l border-t ${line}`} style={{ ...hook, left: "calc(-1 * var(--pad))", top: yg }} />
    </>
  );
}

export function JourneyStageGrid({
  journey, onViewDetails, viewDetailsLabel = "View Full Details",
}: {
  journey: ApplicationJourney;
  onViewDetails?: () => void;
  viewDetailsLabel?: string;
}) {
  const currentStage = computeCurrentStage(journey);
  const stages = STAGE_ORDER.filter((s) => journey.stages[s]?.applicable);
  const rows = Math.ceil(stages.length / COLUMNS);

  return (
    // The geometry variables live on a child of the `@container` element, not on it: container
    // query variants resolve against an *ancestor* container, so on the container itself they
    // would never match.
    <div className="@container w-full">
      <div className={GEOMETRY_CLASSES}>
      {/* --pad of side room so the brackets aren't clipped; `relative` so they position against the grid. */}
      <div className="relative mx-[var(--pad)]">
        <div className="grid grid-cols-4 gap-x-[var(--gap-x)] gap-y-[var(--gap-y)]">
          {stages.map((stageType, i) => {
            const record = journey.stages[stageType]!;
            const done = !!record.completedAt;
            const current = stageType === currentStage;
            const notRequired = !done && !current && record.status === "Not Required";
            const ongoing = !done && !!ONGOING_STATUSES[stageType]?.includes(record.status);
            const tone: Tone = done ? "completed" : ongoing ? "ongoing" : current ? "current" : notRequired ? "notRequired" : "pending";
            const s = TONE_STYLES[tone];
            const Icon = STAGE_ICON[stageType];
            const date = shortDate(done ? record.completedAt : current ? record.startedAt : undefined);
            const lastInRow = (i + 1) % COLUMNS === 0;
            const last = i === stages.length - 1;
            return (
              <div key={stageType} className="relative h-[var(--card-h)]">
                <div className={`flex h-full flex-col items-start gap-1.5 overflow-hidden rounded-xl border p-1.5 @md:flex-row @md:gap-2.5 @md:rounded-2xl @md:p-3 @4xl:gap-3.5 @4xl:p-4 ${s.card}`}>
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full @md:h-9 @md:w-9 @4xl:h-11 @4xl:w-11 ${s.iconWrap}`}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5 @md:h-[18px] @md:w-[18px] @4xl:h-5 @4xl:w-5" /> : <Icon className="h-3 w-3 @md:h-4 @md:w-4 @4xl:h-[18px] @4xl:w-[18px]" />}
                  </div>
                  <div className="w-full min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`hidden text-[9px] font-medium @md:inline @md:text-[11px] @4xl:text-[12px] ${s.number}`}>{String(i + 1).padStart(2, "0")}</span>
                      {date && <span className="truncate text-[8.5px] text-slate-500 @md:text-[11px] @4xl:text-[12px]">{date}</span>}
                    </div>
                    <p className={`truncate text-[9px] font-semibold leading-tight tracking-tight @md:mt-0.5 @md:text-[13px] @md:tracking-normal @4xl:text-[15px] ${s.title}`}>
                      {STAGE_TITLE[stageType]}
                    </p>
                    <p className={`line-clamp-2 text-[8.5px] leading-snug @md:mt-0.5 @md:text-[11px] @4xl:text-[12px] ${s.status}`}>{record.status}</p>
                    {current && (
                      <span
                        className={`mt-1 hidden whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium @md:inline-block @4xl:text-[11px] ${
                          ongoing ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-600"
                        }`}
                      >
                        Current Stage
                      </span>
                    )}
                  </div>
                </div>
                {/* Straight connector to the next card in the same row. */}
                {!last && !lastInRow && (
                  <div
                    className={`pointer-events-none absolute left-full w-[var(--gap-x)] border-t ${done ? "border-emerald-500" : "border-slate-200"}`}
                    style={{ top: "calc(var(--card-h) / 2)" }}
                  />
                )}
              </div>
            );
          })}
        </div>
        {Array.from({ length: rows - 1 }, (_, r) => {
          const lastOfRow = stages[(r + 1) * COLUMNS - 1];
          return <RowBracket key={r} row={r} done={!!journey.stages[lastOfRow]?.completedAt} />;
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 @md:mt-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 @md:gap-x-6 @md:gap-y-2">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-slate-600 @md:gap-2 @md:text-[13px]">
              <span className={`h-2 w-2 rounded-full @md:h-3 @md:w-3 ${l.dot}`} /> {l.label}
            </span>
          ))}
        </div>
        {onViewDetails && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11.5px] font-semibold text-[#1B2C57] hover:border-slate-300 @md:gap-2 @md:rounded-xl @md:px-4 @md:py-2.5 @md:text-[13px]"
          >
            {viewDetailsLabel} <ArrowRight className="h-3.5 w-3.5 @md:h-[15px] @md:w-[15px]" />
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
