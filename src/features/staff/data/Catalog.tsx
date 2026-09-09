import { useState } from "react";
import { Plus } from "lucide-react";
import { Table, StatusBadge, Button, PageHeader, StatTile, Card, CardBody, CardHeader } from "../../../components/ui";
import { CATALOG_RECORDS } from "../../../data/mockData";

export default function DataCatalog() {
  const [editing, setEditing] = useState<string | null>(null);
  const record = CATALOG_RECORDS.find((r) => r.id === editing);
  const stale = CATALOG_RECORDS.filter((r) => r.status === "Stale");

  return (
    <div>
      <PageHeader
        title="Data Management — Catalog"
        subtitle="Universities, courses, intakes, requirements and scholarships. Publish requires a second approver."
        action={<Button><Plus size={15} /> New record</Button>}
      />
      <div className="mb-6 flex gap-4">
        <StatTile label="Total Records" value={String(CATALOG_RECORDS.length)} />
        <StatTile label="In Review" value={String(CATALOG_RECORDS.filter((r) => r.status === "In Review").length)} tone="green" />
        <StatTile label="Stale — Needs Re-verification" value={String(stale.length)} tone="red" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["Record", "Type", "Source", "Verified", "Status", ""]}>
          {CATALOG_RECORDS.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-medium text-slate-800">{r.name}</td>
              <td className="px-5 py-3 text-slate-600">{r.type}</td>
              <td className="px-5 py-3 text-slate-500 text-xs">{r.source}</td>
              <td className="px-5 py-3 text-slate-500 text-xs">{r.verificationDate}</td>
              <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
              <td className="px-5 py-3"><button onClick={() => setEditing(r.id)} className="text-sm font-medium text-[var(--brand-600)]">Edit</button></td>
            </tr>
          ))}
        </Table>
      </div>

      {record && (
        <Card className="mt-6">
          <CardHeader title={`Edit — ${record.name}`} subtitle="Draft → Review → Publish. Direct-to-production edits are not permitted." />
          <CardBody className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-400">Source</span>
              <input defaultValue={record.source} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-400">Effective date</span>
              <input defaultValue={record.effectiveDate} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-400">Verification date</span>
              <input defaultValue={record.verificationDate} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-400">Owner</span>
              <input defaultValue={record.owner} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <div className="col-span-2 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="secondary">Save draft</Button>
              <Button>Submit for review</Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
