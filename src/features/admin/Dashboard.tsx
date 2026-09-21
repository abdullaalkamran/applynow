import { useState } from "react";
import {
  AlertCircle, Clock, FileText, Users, ArrowRight, ArrowDown, ArrowUp,
  FileEdit, Send, Search, Percent, CreditCard, GraduationCap, FileWarning, Building2, Wallet,
} from "lucide-react";
import { useAdminRange } from "../../context/AdminRangeContext";
import { getAllApplications } from "../../data/applicationsStore";
import {
  computeStats, computeFunnel, computeIssues, computeStageAverages, computeAverageOfferDays, computeOfferTrend,
  inDateRange, JOURNEY_STAGES, STALE_DAYS, type IssueKey, type JourneyStage,
} from "../../utils/adminDashboard";
import { ApplicationsTable, type TabKey } from "./ApplicationsTable";

const ISSUE_TAB: Record<IssueKey, TabKey> = {
  notSubmitted: "risk",
  noOffer: "noOffer",
  missingDocs: "missingDocs",
  awaitingUniversity: "noOffer",
  paymentPending: "all",
};

const ISSUE_ICON: Record<IssueKey, { icon: typeof FileText; cls: string }> = {
  notSubmitted: { icon: FileWarning, cls: "bg-[#fdecef] text-[#e11d48]" },
  noOffer: { icon: Clock, cls: "bg-[#fdf3dc] text-[#f59e0b]" },
  missingDocs: { icon: FileText, cls: "bg-[#fdf3dc] text-[#f59e0b]" },
  awaitingUniversity: { icon: Building2, cls: "bg-[#e8f1fd] text-[#2563eb]" },
  paymentPending: { icon: Wallet, cls: "bg-[#efe9fd] text-[#7c3aed]" },
};

const ISSUE_COUNT_CLS: Record<IssueKey, string> = {
  notSubmitted: "text-[#e11d48]",
  noOffer: "text-[#d97706]",
  missingDocs: "text-[#d97706]",
  awaitingUniversity: "text-[#2563eb]",
  paymentPending: "text-[#7c3aed]",
};

const STAGE_ICON: Record<JourneyStage, { icon: typeof FileText; cls: string }> = {
  prepare: { icon: FileEdit, cls: "bg-[#e8f1fd] text-[#2563eb]" },
  submit: { icon: Send, cls: "bg-[#e8f1fd] text-[#2563eb]" },
  review: { icon: Search, cls: "bg-[#e8f1fd] text-[#2563eb]" },
  offer: { icon: Percent, cls: "bg-[#e6f6ec] text-[#15803d]" },
  visa: { icon: CreditCard, cls: "bg-[#e6f6ec] text-[#15803d]" },
  enrolment: { icon: GraduationCap, cls: "bg-[#e6f6ec] text-[#15803d]" },
};

const FUNNEL_COLORS = ["bg-[#dbeafe]", "bg-[#93c5fd]", "bg-[#a78bfa]", "bg-[#4ade80]", "bg-[#86efac]", "bg-[#e2e8f0]"];

export default function AdminDashboard() {
  const { range } = useAdminRange();
  // Fixed per mount (the shell remounts this page on every cache change, so it never goes stale).
  const [now] = useState(() => Date.now());
  const apps = getAllApplications().filter((a) => inDateRange(a, range));

  const stats = computeStats(apps, now);
  const funnel = computeFunnel(apps);
  const issues = computeIssues(apps, now);
  const stageAvg = computeStageAverages(apps, now);
  const offerDays = computeAverageOfferDays(apps, now);
  const trend = computeOfferTrend(getAllApplications(), now);

  // Change vs the equivalent preceding period — only meaningful for a bounded range.
  let offerDelta: number | null = null;
  if (range.from && range.to && offerDays !== null) {
    const span = range.to.getTime() - range.from.getTime();
    const prev = { from: new Date(range.from.getTime() - span), to: new Date(range.from.getTime() - 1) };
    const prevDays = computeAverageOfferDays(getAllApplications().filter((a) => inDateRange(a, prev)), now);
    if (prevDays) offerDelta = Math.round(((offerDays - prevDays) / prevDays) * 100);
  }

  const [tabOverride, setTabOverride] = useState<{ tab: TabKey; nonce: number } | undefined>();
  function jumpTo(tab: TabKey) {
    setTabOverride({ tab, nonce: Date.now() });
    document.getElementById("admin-applications-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));
  const studentsInvolved = new Set(apps.map((a) => a.studentId)).size;

  return (
    <div className="space-y-5">
      {/* Header + stat cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(0,1.55fr)_repeat(4,minmax(0,1fr))] xl:gap-4">
        <div className="col-span-2 flex flex-col justify-center pr-2 xl:col-span-1">
          <p className="text-[12px] text-slate-500">Application Health</p>
          <h1 className="mt-1 text-[20px] font-bold leading-tight tracking-tight text-slate-900">Find Problems. Take Action.</h1>
          <p className="mt-2 text-[12px] text-slate-500">
            {apps.length === 0
              ? `No application activity ${range.from ? "in this period" : "yet"}.`
              : `${apps.length} application${apps.length === 1 ? "" : "s"} · ${studentsInvolved} student${studentsInvolved === 1 ? "" : "s"} ${range.from ? "active in this period" : "on the platform"}.`}
          </p>
        </div>
        <StatCard
          tone="rose"
          icon={<AlertCircle size={22} strokeWidth={2.2} />}
          title="Not Submitted"
          value={stats.notSubmitted}
          line1={`${stats.notSubmittedStudents} student${stats.notSubmittedStudents === 1 ? "" : "s"}`}
          line2="Need attention"
          line2Cls="text-[#e11d48]"
          onClick={() => jumpTo("risk")}
        />
        <StatCard
          tone="amber"
          icon={<Clock size={22} strokeWidth={2.2} />}
          title="Submitted"
          value={stats.noOfferYet}
          line1="No Offer Yet"
          line2={`> ${STALE_DAYS} days`}
          line2Cls="text-[#e11d48]"
          onClick={() => jumpTo("noOffer")}
        />
        <StatCard
          tone="blue"
          icon={<FileText size={22} strokeWidth={2.2} />}
          title="Offer Received"
          value={stats.offerReceived}
          line1="Pending Acceptance"
        />
        <StatCard
          tone="green"
          icon={<Users size={22} strokeWidth={2.2} />}
          title="Ready for Visa"
          value={stats.readyForVisa}
          line1="Awaiting Documents"
        />
      </div>

      {/* Funnel / Issues / Journey */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.42fr_1fr_1.55fr]">
        <Card title="Application Funnel" action={<CardLink onClick={() => jumpTo("all")}>View Details</CardLink>}>
          <div className="space-y-[9px] pt-1">
            {funnel.map((f, i) => (
              <div key={f.label} className="flex items-center gap-3">
                <span className="w-[112px] shrink-0 text-[12px] text-slate-600">{f.label}</span>
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="h-[20px] flex-1 overflow-hidden rounded-[4px] bg-slate-100/60">
                    <div className={`h-full rounded-[4px] ${FUNNEL_COLORS[i]}`} style={{ width: `${Math.max(f.count > 0 ? 6 : 0, (f.count / funnelMax) * 100)}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-[12px] font-medium text-slate-800">{f.count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Top Issues" action={<CardLink onClick={() => jumpTo("risk")}>View All</CardLink>}>
          <ul className="divide-y divide-slate-100">
            {issues.map((issue) => {
              const { icon: Icon, cls } = ISSUE_ICON[issue.key];
              return (
                <li key={issue.key}>
                  <button onClick={() => jumpTo(ISSUE_TAB[issue.key])} className="flex w-full items-center gap-3 py-[9px] text-left">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cls}`}>
                      <Icon size={15} />
                    </span>
                    <span className="flex-1 text-[12px] text-slate-700">{issue.label}</span>
                    <span className={`text-[12px] font-semibold ${ISSUE_COUNT_CLS[issue.key]}`}>{issue.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Application Journey (Average Time)" action={<CardLink onClick={() => jumpTo("all")}>View Details</CardLink>}>
          <div className="flex items-start justify-between gap-1 pt-1">
            {JOURNEY_STAGES.map((s, i) => {
              const { icon: Icon, cls } = STAGE_ICON[s.key];
              const days = stageAvg[s.key];
              return (
                <div key={s.key} className="flex flex-1 items-start">
                  <div className="flex flex-1 flex-col items-center">
                    <span className="mb-2 whitespace-nowrap text-[12px] text-slate-500">{days === null ? "—" : `${days} day${days === 1 ? "" : "s"}`}</span>
                    <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${cls}`}>
                      <Icon size={20} strokeWidth={1.9} />
                    </span>
                    <span className="mt-2 text-center text-[11px] leading-tight text-slate-600">{s.label}</span>
                  </div>
                  {i < JOURNEY_STAGES.length - 1 && <ArrowRight size={14} className="mt-[44px] shrink-0 text-slate-300" />}
                </div>
              );
            })}
          </div>

          <div className="mt-3.5 flex items-center gap-4 rounded-xl bg-[#f3f8f5] px-4 py-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fdf3dc] text-[#f59e0b]">
              <Clock size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-slate-600">Average time to get an offer</p>
              <div className="mt-0.5 flex items-baseline gap-3">
                <span className="text-[18px] font-bold text-slate-900">{offerDays === null ? "—" : `${offerDays} days`}</span>
                {offerDelta !== null && (
                  <span className={`flex items-center gap-0.5 text-[12px] font-semibold ${offerDelta <= 0 ? "text-[#15803d]" : "text-[#e11d48]"}`}>
                    {offerDelta <= 0 ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
                    {Math.abs(offerDelta)}%
                  </span>
                )}
              </div>
            </div>
            {trend.filter((t) => t !== null).length >= 2 && <Sparkline points={trend} className="hidden h-12 w-40 shrink-0 sm:block" />}
          </div>
        </Card>
      </div>

      <div id="admin-applications-table" className="scroll-mt-4">
        <ApplicationsTable range={range} tabOverride={tabOverride} />
      </div>

    </div>
  );
}

function StatCard({
  tone, icon, title, value, line1, line2, line2Cls = "text-slate-500", onClick,
}: {
  tone: "rose" | "amber" | "blue" | "green";
  icon: React.ReactNode;
  title: string;
  value: number;
  line1: string;
  line2?: string;
  line2Cls?: string;
  onClick?: () => void;
}) {
  const bg = { rose: "bg-[#fdeef1]", amber: "bg-[#fdf6e3]", blue: "bg-[#eaf2fd]", green: "bg-[#e8f6ee]" }[tone];
  const iconCls = { rose: "bg-white text-[#e11d48]", amber: "bg-white text-[#f59e0b]", blue: "bg-white text-[#2563eb]", green: "bg-white text-[#15803d]" }[tone];
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`flex items-start gap-3 rounded-2xl px-3.5 py-3.5 text-left xl:gap-3.5 xl:px-4 xl:py-4 ${bg} ${onClick ? "transition hover:brightness-[0.98]" : ""}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full xl:h-12 xl:w-12 ${iconCls}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-slate-700">{title}</span>
        <span className="block text-[20px] font-bold leading-tight text-slate-900">{value}</span>
        <span className="block text-[12px] leading-tight text-slate-500">{line1}</span>
        {line2 && <span className={`block text-[12px] leading-tight ${line2Cls}`}>{line2}</span>}
      </span>
      {onClick && <ArrowRight size={16} className="mt-9 hidden shrink-0 text-slate-500 xl:block" />}
    </Wrapper>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function CardLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-[#2563eb] hover:underline">
      {children} <ArrowRight size={13} />
    </button>
  );
}

/** Tiny smoothed line chart of the monthly offer-time series. */
function Sparkline({ points, className }: { points: (number | null)[]; className?: string }) {
  const w = 160;
  const h = 48;
  // Only months that actually had offers are plotted — no interpolation or filler.
  const real = points.map((p, i) => [p, i] as const).filter((x): x is readonly [number, number] => x[0] !== null);
  const values = real.map(([v]) => v);
  const max = Math.max(1, ...values);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const coords = real.map(([p, i]) => [(i / Math.max(1, points.length - 1)) * (w - 4) + 2, h - 6 - ((p - min) / span) * (h - 12)] as const);
  let d = "";
  coords.forEach(([x, y], i) => {
    if (i === 0) { d += `M${x},${y}`; return; }
    const [px, py] = coords[i - 1];
    const cx = (px + x) / 2;
    d += ` C${cx},${py} ${cx},${y} ${x},${y}`;
  });
  const area = `${d} L${coords[coords.length - 1]?.[0] ?? 0},${h} L${coords[0]?.[0] ?? 0},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <path d={area} fill="#22c55e" opacity="0.12" />
      <path d={d} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
