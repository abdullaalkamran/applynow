import { useState } from "react";
import { ShieldAlert, Lock } from "lucide-react";
import { Card, CardBody, CardHeader, Badge, Button, StatTile, PageHeader } from "../../../components/ui";
import { COMPLIANCE_CASES } from "../../../data/mockData";

const riskTone: Record<string, "green" | "amber" | "red"> = { low: "green", medium: "amber", high: "red" };

export default function ComplianceRiskQueue() {
  const [selectedId, setSelectedId] = useState(COMPLIANCE_CASES[0].id);
  const selected = COMPLIANCE_CASES.find((c) => c.id === selectedId)!;

  return (
    <div>
      <PageHeader title="Risk & Fraud Queue" subtitle="Flag, investigate and freeze. No academic or financial edit rights." />
      <div className="mb-6 flex gap-4">
        <StatTile label="Open Cases" value={String(COMPLIANCE_CASES.filter((c) => c.status !== "Cleared").length)} tone="red" />
        <StatTile label="High Risk" value={String(COMPLIANCE_CASES.filter((c) => c.riskLevel === "high").length)} />
        <StatTile label="Cleared (30d)" value="6" tone="green" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-1">
          <CardHeader title="Case queue" />
          <CardBody className="space-y-2 p-2">
            {COMPLIANCE_CASES.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 ${selectedId === c.id ? "bg-[var(--brand-50)]" : ""}`}
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
            subtitle={`${selected.subjectType} · opened ${selected.openedAt}`}
            action={<Badge tone={riskTone[selected.riskLevel]}>{selected.riskLevel} risk</Badge>}
          />
          <CardBody className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><ShieldAlert size={13} /> REASON</p>
              <p className="mt-1 text-sm text-slate-700">{selected.reason}</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Evidence</p>
              <ul className="space-y-1.5">
                {selected.evidence.map((e, i) => (
                  <li key={i} className="rounded-md border border-slate-100 px-3 py-2 text-sm text-slate-600">{e}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <Button variant="secondary">Request more evidence</Button>
              <Button variant="danger"><Lock size={14} /> Freeze pending review</Button>
              <Button>Clear case</Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
