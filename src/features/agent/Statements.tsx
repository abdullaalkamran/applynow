import { Download } from "lucide-react";
import { Card, CardBody, PageHeader, Button, Badge } from "../../components/ui";

const STATEMENTS = [
  { id: "inv-2026-08", period: "August 2026", total: 4200, status: "Paid" },
  { id: "inv-2026-09", period: "September 2026", total: 3050, status: "Issued" },
];

export default function AgentStatements() {
  return (
    <div>
      <PageHeader title="Statements & Invoices" subtitle="Monthly commission statements generated automatically from approved transactions." />
      <div className="space-y-3">
        {STATEMENTS.map((s) => (
          <Card key={s.id}>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">{s.period}</p>
                <p className="text-sm text-slate-500">${s.total.toLocaleString()} total</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={s.status === "Paid" ? "green" : "amber"}>{s.status}</Badge>
                <Button variant="secondary"><Download size={14} /> Download PDF</Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
