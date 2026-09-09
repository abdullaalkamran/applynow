import { Card, CardBody, CardHeader, PageHeader, Button, Badge } from "../../components/ui";

const RULES = [
  { name: "UK Postgraduate — Standard", type: "Percentage", value: "15% of tuition (yr 1)", scope: "All UK universities unless overridden" },
  { name: "Australia — Tiered", type: "Tiered", value: "12% (0-20 students) / 15% (21+)", scope: "Per agent agreement" },
  { name: "Referral Bonus", type: "Fixed", value: "$150 per successful referral", scope: "Student & agent referral program" },
];

export default function AdminCommissionRules() {
  return (
    <div>
      <PageHeader title="Commission Rules" subtitle="A rules engine, never a hard-coded percentage." action={<Button>+ New rule</Button>} />
      <div className="space-y-3">
        {RULES.map((r) => (
          <Card key={r.name}>
            <CardHeader title={r.name} action={<Badge tone="blue">{r.type}</Badge>} />
            <CardBody className="text-sm text-slate-600">
              <p><span className="text-slate-400">Value: </span>{r.value}</p>
              <p className="mt-1"><span className="text-slate-400">Scope: </span>{r.scope}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
