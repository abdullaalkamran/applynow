import { useNavigate } from "react-router-dom";
import { Table, PageHeader, StatTile, EmptyState } from "../../../components/ui";
import { getAllUniversities } from "../../../data/universityCatalogStore";

export default function DataCatalog() {
  const navigate = useNavigate();
  const universities = getAllUniversities();
  const courseCount = universities.reduce((sum, u) => sum + u.courses.length, 0);
  const countries = new Set(universities.map((u) => u.country));

  return (
    <div>
      <PageHeader title="Data Management — Catalog" subtitle="Everything currently published in the partner catalog." />
      <div className="mb-6 flex gap-4">
        <StatTile label="Universities" value={String(universities.length)} />
        <StatTile label="Courses" value={String(courseCount)} tone="green" />
        <StatTile label="Countries" value={String(countries.size)} />
      </div>

      {universities.length === 0 ? (
        <EmptyState title="The catalog is empty" subtitle="Add a university from Data Management to get started." />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Table head={["University", "Country", "Courses", ""]}>
            {universities.slice(0, 200).map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{u.name}</td>
                <td className="px-5 py-3 text-slate-600">{u.country}</td>
                <td className="px-5 py-3 text-slate-600">{u.courses.length}</td>
                <td className="px-5 py-3">
                  <button onClick={() => navigate(`/staff/data/universities/${u.id}`)} className="text-xs font-medium text-[var(--brand-600)]">Open</button>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
