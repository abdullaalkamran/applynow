// Training Knowledge — notes from counsellor/agent training (British Council, ICEF, in-house playbooks)
// that the staff-facing AI assistants search through `search_knowledge` (see knowledgeAssistantTools.ts).
// Only paste material you have the right to use: write it up in your own words or use public/licensed text.
import { useEffect, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { PageHeader, Button, Table, Modal } from "../../../components/ui";
import { apiGet, apiPost, apiPatch, apiDelete, apiPostForm } from "../../../utils/apiClient";

interface DocSummary { id: string; title: string; source?: string; category?: string; length: number; updatedAt: string }
interface DocFull extends DocSummary { content: string }
interface Draft { id?: string; title: string; source: string; category: string; content: string }

const CATEGORIES = ["Counselling technique", "Objection handling", "Ethics & compliance", "Country / market", "Process & operations", "Other"];
const INPUT = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800";
const EMPTY: Draft = { title: "", source: "", category: "", content: "" };

export default function DataKnowledge() {
  const [docs, setDocs] = useState<DocSummary[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try { setDocs(await apiGet<DocSummary[]>("/api/knowledge")); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load documents."); setDocs([]); }
  }
  useEffect(() => { void load(); }, []);

  async function edit(id: string) {
    try {
      const d = await apiGet<DocFull>(`/api/knowledge/${id}`);
      setDraft({ id: d.id, title: d.title, source: d.source ?? "", category: d.category ?? "", content: d.content });
    } catch (err) { window.alert(err instanceof Error ? err.message : "Failed to open document."); }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const body = { title: draft.title, source: draft.source, category: draft.category, content: draft.content };
      if (draft.id) await apiPatch(`/api/knowledge/${draft.id}`, body);
      else await apiPost("/api/knowledge", body);
      setDraft(null);
      await load();
    } catch (err) { window.alert(err instanceof Error ? err.message : "Failed to save."); }
    finally { setSaving(false); }
  }

  async function remove(d: DocSummary) {
    if (!window.confirm(`Delete "${d.title}"? The assistants will stop using it.`)) return;
    try { await apiDelete(`/api/knowledge/${d.id}`); await load(); }
    catch (err) { window.alert(err instanceof Error ? err.message : "Failed to delete."); }
  }

  async function readFile(file: File | undefined) {
    if (!file || !draft) return;
    let text: string;
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
      setReading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await apiPostForm<{ text: string; truncated: boolean; pages: number }>("/api/knowledge/extract-pdf", form);
        text = res.text;
        if (res.truncated) window.alert("This PDF is very long, so only the first part was loaded. Split it into several documents for full coverage.");
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Couldn't read that PDF.");
        return;
      } finally {
        setReading(false);
      }
    } else {
      text = await file.text();
    }
    setDraft((p) => p && { ...p, content: text, title: p.title || file.name.replace(/\.[^.]+$/, "") });
  }

  return (
    <div>
      <PageHeader
        title="Data Management — Training Knowledge"
        subtitle="Counselling and agent-training material the AI assistants (agent, counsellor, admin and other staff roles) search when answering. Students' assistant doesn't see it."
        action={<Button onClick={() => setDraft({ ...EMPTY })}><Plus size={15} /> Add Document</Button>}
      />
      {error && <p className="mb-3 text-xs text-rose-600">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["Title", "Category", "Source", "Size", ""]}>
          {(docs ?? []).map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-medium text-slate-800">{d.title}</td>
              <td className="px-5 py-3 text-xs text-slate-500">{d.category || "—"}</td>
              <td className="max-w-xs truncate px-5 py-3 text-xs text-slate-500">{d.source || "—"}</td>
              <td className="px-5 py-3 text-xs text-slate-500">{Math.ceil(d.length / 1000)}k chars</td>
              <td className="space-x-3 whitespace-nowrap px-5 py-3">
                <button onClick={() => edit(d.id)} className="text-xs font-medium text-[var(--brand-600)]">Edit</button>
                <button onClick={() => remove(d)} className="text-xs font-medium text-rose-600">Delete</button>
              </td>
            </tr>
          ))}
        </Table>
        {docs && docs.length === 0 && (
          <p className="px-5 py-6 text-center text-xs text-slate-400">No documents yet — click "Add Document" and paste your first training notes.</p>
        )}
      </div>

      {draft && (
        <Modal title={draft.id ? "Edit document" : "Add document"} onClose={() => setDraft(null)}>
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-500">
              Title
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Handling cost objections" className={INPUT} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-slate-500">
                Category
                <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={INPUT}>
                  <option value="">—</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-500">
                Source (course / link)
                <input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} placeholder="e.g. ICEF Agent Training, module 3" className={INPUT} />
              </label>
            </div>
            <label className="block text-xs font-medium text-slate-500">
              Content
              <textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} rows={12} placeholder="Paste or write the training notes here. Separate topics with blank lines." className={INPUT} />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
              <Upload size={13} /> {reading ? "Reading file…" : "Load from a PDF, .txt or .md file"}
              <input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" className="hidden" onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
              <Button onClick={save} disabled={saving || reading || !draft.title.trim() || !draft.content.trim()}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
