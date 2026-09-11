import { BarChart3, FileCheck2 } from "lucide-react";
import { loadAssignedStudents } from "../../../data/counsellorStudentsStore";
import { activeApplicationsFor, pipelineBucketFor, docCompletionFor, type PipelineBucket } from "../../../utils/counsellorData";
import type { Student } from "../../../types";

const BUCKET_COLORS: Record<PipelineBucket, string> = {
  "Under Review": "#2955C4",
  "Offer Received": "#0F9D6D",
  "Documents": "#6D3FBF",
  "Visa Process": "#D4A017",
  "Enrolled": "#94A3B8",
};

const RISK_LABEL: Record<NonNullable<Student["riskFlag"]>, string> = { none: "No flag", watch: "Watchlist", high: "High risk" };
const RISK_COLOR: Record<NonNullable<Student["riskFlag"]>, string> = { none: "#94A3B8", watch: "#D4A017", high: "#E4587A" };

function daysSince(dateStr: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000));
}

export default function CounsellorReports() {
  const assigned = loadAssignedStudents();
  const rows = assigned.flatMap((s) => activeApplicationsFor(s.id).map((a) => ({ student: s, app: a })));

  const bucketCounts: Record<PipelineBucket, number> = { "Under Review": 0, "Offer Received": 0, "Documents": 0, "Visa Process": 0, "Enrolled": 0 };
  rows.forEach(({ app }) => {
    const b = pipelineBucketFor(app.status);
    if (b) bucketCounts[b]++;
  });
  const maxBucket = Math.max(1, ...Object.values(bucketCounts));

  const riskCounts: Record<NonNullable<Student["riskFlag"]>, number> = { none: 0, watch: 0, high: 0 };
  assigned.forEach((s) => { riskCounts[s.riskFlag ?? "none"]++; });
  const maxRisk = Math.max(1, ...Object.values(riskCounts));

  const totals = assigned.reduce(
    (acc, s) => {
      const { total, fulfilled } = docCompletionFor(s.id);
      return { total: acc.total + total, fulfilled: acc.fulfilled + fulfilled };
    },
    { total: 0, fulfilled: 0 }
  );
  const completionPct = totals.total > 0 ? Math.round((totals.fulfilled / totals.total) * 100) : 100;

  const avgDaysSinceUpdate = rows.length > 0 ? Math.round(rows.reduce((sum, { app }) => sum + daysSince(app.updatedAt), 0) / rows.length) : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Computed live from your current caseload — no history to fabricate, so every number here is real today.</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ReportStat icon={<FileCheck2 size={16} />} value={`${completionPct}%`} label="Document completion" />
        <ReportStat icon={<BarChart3 size={16} />} value={String(rows.length)} label="Active applications" />
        <ReportStat icon={<BarChart3 size={16} />} value={`${avgDaysSinceUpdate}d`} label="Avg. days since update" />
        <ReportStat icon={<BarChart3 size={16} />} value={String(assigned.length)} label="Students in caseload" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
          <p className="mb-4 text-sm font-semibold text-slate-800">Applications by stage</p>
          <div className="space-y-3">
            {(Object.keys(bucketCounts) as PipelineBucket[]).map((b) => (
              <div key={b}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{b}</span>
                  <span className="font-semibold text-slate-800">{bucketCounts[b]}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${(bucketCounts[b] / maxBucket) * 100}%`, backgroundColor: BUCKET_COLORS[b] }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
          <p className="mb-4 text-sm font-semibold text-slate-800">Student risk distribution</p>
          <div className="space-y-3">
            {(["none", "watch", "high"] as const).map((r) => (
              <div key={r}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{RISK_LABEL[r]}</span>
                  <span className="font-semibold text-slate-800">{riskCounts[r]}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${(riskCounts[r] / maxRisk) * 100}%`, backgroundColor: RISK_COLOR[r] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF1F6] text-[var(--sd-ink)]">{icon}</div>
      <p className="mt-3 text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
