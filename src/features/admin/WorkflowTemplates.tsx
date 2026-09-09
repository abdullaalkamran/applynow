import { Table, Badge, PageHeader, Button } from "../../components/ui";
import { WORKFLOW_TEMPLATES } from "../../data/mockData";

export default function AdminWorkflowTemplates() {
  return (
    <div>
      <PageHeader
        title="Workflow Templates"
        subtitle="Workflow Template → Version → Instance → Stages → Steps → Conditions. Historical versions stay intact."
        action={<Button>+ New template</Button>}
      />
      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["Template", "Country", "Version", "Stages", "Status", "Updated"]}>
          {WORKFLOW_TEMPLATES.map((w) => (
            <tr key={w.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-medium text-slate-800">{w.name}</td>
              <td className="px-5 py-3 text-slate-600">{w.country}</td>
              <td className="px-5 py-3 text-slate-600">{w.version}</td>
              <td className="px-5 py-3 text-slate-600">{w.stages}</td>
              <td className="px-5 py-3"><Badge tone={w.status === "Active" ? "green" : w.status === "Draft" ? "amber" : "neutral"}>{w.status}</Badge></td>
              <td className="px-5 py-3 text-xs text-slate-400">{w.lastUpdated}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
