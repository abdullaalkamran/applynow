// Subjects — the field-of-study catalog Data Management can write real content for: a "why this
// subject" blurb, curriculum modules, and accrediting bodies (see subjectCatalogStore.ts). The
// underlying name taxonomy (subjectsStore.ts, used by the university form's "Subjects offered"
// picklist) is broader than what's authored here — a built-in subject with no extra content yet
// shows up below with an "Add details" link instead of being hidden.
import { useNavigate } from "react-router-dom";
import { Plus, BookOpen } from "lucide-react";
import { PageHeader, Button, Table } from "../../../components/ui";
import { getSubjectCatalog } from "../../../data/subjectCatalogStore";
import { getAllSubjects } from "../../../data/subjectsStore";

export default function DataSubjects() {
  const navigate = useNavigate();
  const authored = getSubjectCatalog();
  const authoredNames = new Set(authored.map((s) => s.name.toLowerCase()));
  const notYetAuthored = getAllSubjects().filter((name) => !authoredNames.has(name.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Data Management — Subjects"
        subtitle="Why-this-subject descriptions, curriculum modules and accreditation, shown on every course page in that field."
        action={<Button onClick={() => navigate("/staff/data/subjects/new")}><Plus size={15} /> Add Subject</Button>}
      />

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["Subject", "Description", "Modules", "Accreditation", ""]}>
          {authored.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-medium text-slate-800">{s.name}</td>
              <td className="max-w-xs truncate px-5 py-3 text-xs text-slate-500">{s.description || "—"}</td>
              <td className="px-5 py-3 text-xs text-slate-500">{s.modules.length}</td>
              <td className="px-5 py-3 text-xs text-slate-500">{s.accreditations.length}</td>
              <td className="px-5 py-3">
                <button onClick={() => navigate(`/staff/data/subjects/${s.id}`)} className="text-xs font-medium text-[var(--brand-600)]">
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </Table>
        {authored.length === 0 && (
          <p className="px-5 py-6 text-center text-xs text-slate-400">No subjects have content yet — click "Add Subject" to write the first one.</p>
        )}
      </div>

      {notYetAuthored.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <BookOpen size={13} /> Built-in fields of study without content yet
          </p>
          <div className="flex flex-wrap gap-1.5">
            {notYetAuthored.map((name) => (
              <button
                key={name}
                onClick={() => navigate(`/staff/data/subjects/new?name=${encodeURIComponent(name)}`)}
                className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-[11.5px] font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              >
                {name} · Add details
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
