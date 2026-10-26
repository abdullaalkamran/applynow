import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Card, CardBody, CardHeader, Badge, StatTile, PageHeader, EmptyState } from "../../../components/ui";
import { getAllApplications } from "../../../data/applicationsStore";
import { getAllStudents } from "../../../data/allStudentsStore";

const riskTone: Record<string, "green" | "amber" | "red"> = { low: "green", medium: "amber", high: "red" };

interface RiskCase {
  id: string;
  subjectType: "Student" | "Application";
  subjectName: string;
  reason: string;
  riskLevel: "low" | "medium" | "high";
  status: string;
  evidence: string[];
}

/** Cases are derived from live records — a student flagged "watch"/"high" and any application on
 * Compliance Hold — rather than from a seeded list. */
function buildCases(): RiskCase[] {
  const students = getAllStudents();
  const cases: RiskCase[] = [];
  students.filter((s) => s.riskFlag === "watch" || s.riskFlag === "high").forEach((s) => {
    cases.push({
      id: `student-${s.id}`, subjectType: "Student", subjectName: s.name,
      reason: s.riskFlag === "high" ? "Student is flagged as high risk." : "Student is on the watchlist.",
      riskLevel: s.riskFlag === "high" ? "high" : "medium", status: "Open",
      evidence: [`Country: ${s.country}`, `Email: ${s.email}`],
    });
  });
  getAllApplications().filter((a) => a.status === "Compliance Hold").forEach((a) => {
    const student = students.find((s) => s.id === a.studentId);
    cases.push({
      id: `app-${a.id}`, subjectType: "Application", subjectName: `${student?.name ?? "Student"} — ${a.university}`,
      reason: "Application is on Compliance Hold.", riskLevel: "high", status: "On hold",
      evidence: [`${a.course} · ${a.intake}`, `Next action: ${a.nextAction}`],
    });
  });
  return cases;
}

export default function ComplianceRiskQueue() {
  const cases = buildCases();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = cases.find((c) => c.id === selectedId) ?? cases[0];

  return (
    <div>
      <PageHeader title="Risk & Fraud Queue" subtitle="Flag, investigate and freeze. No academic or financial edit rights." />
      <div className="mb-6 flex gap-4">
        <StatTile label="Open Cases" value={String(cases.length)} tone="red" />
        <StatTile label="High Risk" value={String(cases.filter((c) => c.riskLevel === "high").length)} />
        <StatTile label="On Hold" value={String(cases.filter((c) => c.status === "On hold").length)} tone="amber" />
      </div>

      {!selected ? (
        <EmptyState title="No open cases" subtitle="Flagged students and applications on Compliance Hold will appear here." />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-1">
            <CardHeader title="Case queue" />
            <CardBody className="space-y-2 p-2">
              {cases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 ${selected.id === c.id ? "bg-[var(--brand-50)]" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800">{c.subjectName}</p>
                    <Badge tone={riskTone[c.riskLevel]}>{c.riskLevel}</Badge>
                  </div>
                  <p className="text-xs text-slate-400">{c.subjectType} · {c.status}</p>
                </button>
              ))}
            </CardBody>
          </Card>

          <Card className="col-span-2">
            <CardHeader
              title={selected.subjectName}
              subtitle={selected.subjectType}
              action={<Badge tone={riskTone[selected.riskLevel]}>{selected.riskLevel} risk</Badge>}
            />
            <CardBody className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><ShieldAlert size={13} /> REASON</p>
                <p className="mt-1 text-sm text-slate-700">{selected.reason}</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Details</p>
                <ul className="space-y-1.5">
                  {selected.evidence.map((e, i) => (
                    <li key={i} className="rounded-md border border-slate-100 px-3 py-2 text-sm text-slate-600">{e}</li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
