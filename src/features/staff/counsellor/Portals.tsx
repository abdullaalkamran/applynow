import { NeuSelect } from "../../../components/ui/NeuSelect";
// External portals — saved logins for partner university / B2B agent portals the AI agent can submit to and
// monitor, plus where each submission stands. Passwords are write-only: once saved they are never shown again.
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader, Button, Table, Badge } from "../../../components/ui";
import { getAllApplications } from "../../../data/applicationsStore";
import {
  listPortals, addPortal, removePortal, listSubmissions, confirmSubmission, fetchSubmissionPreview,
  type PortalConnection, type PortalSubmission,
} from "../../../data/portalsStore";

const INPUT = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800";
const STATUS_LABEL: Record<string, string> = {
  queued: "Queued", preparing: "AI agent is filling it in", awaiting_confirm: "Waiting for your confirmation",
  submitted: "Submitted", needs_human: "Needs your help", failed: "Failed",
};

export default function CounsellorPortals() {
  const [portals, setPortals] = useState<PortalConnection[]>([]);
  const [subs, setSubs] = useState<PortalSubmission[]>([]);
  const [form, setForm] = useState<{ name: string; url: string; kind: "b2b" | "university"; username: string; password: string } | null>(null);
  const [preview, setPreview] = useState<{ id: string; src: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [p, s] = await Promise.all([listPortals(), listSubmissions()]);
      setPortals(p); setSubs(s); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load."); }
  }
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, []);

  async function save() {
    if (!form) return;
    setBusy(true);
    try { await addPortal(form); setForm(null); await load(); }
    catch (err) { window.alert(err instanceof Error ? err.message : "Couldn't save the portal."); }
    finally { setBusy(false); }
  }
  async function remove(p: PortalConnection) {
    if (!window.confirm(`Remove "${p.name}" and its saved login?`)) return;
    try { await removePortal(p.id); await load(); } catch (err) { window.alert(err instanceof Error ? err.message : "Couldn't remove it."); }
  }
  async function openPreview(id: string) { setPreview({ id, src: await fetchSubmissionPreview(id) }); }
  async function confirm(id: string) {
    if (!window.confirm("Send the final submit on the external portal? This can't be undone from here.")) return;
    try { await confirmSubmission(id); setPreview(null); await load(); } catch (err) { window.alert(err instanceof Error ? err.message : "Couldn't confirm."); }
  }

  const appName = (id: string) => { const a = getAllApplications().find((x) => x.id === id); return a ? `${a.university} — ${a.course}` : id; };
  const portalName = (id: string) => portals.find((p) => p.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader
        title="External Portals"
        subtitle="Saved logins for university and B2B agent portals. The AI agent uses them to submit applications (you approve, and confirm the final submit) and to check for status changes, comments and required documents."
        action={<Button onClick={() => setForm({ name: "", url: "", kind: "b2b", username: "", password: "" })}><Plus size={15} /> Add Portal</Button>}
      />
      {error && <p className="mb-3 text-xs text-rose-600">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["Portal", "Type", "Last login", ""]}>
          {portals.map((p) => (
            <tr key={p.id}>
              <td className="px-5 py-3"><p className="font-medium text-slate-800">{p.name}</p><p className="max-w-xs truncate text-[11px] text-slate-400">{p.url}</p></td>
              <td className="px-5 py-3 text-xs text-slate-500">{p.kind === "b2b" ? "B2B portal" : "University portal"}</td>
              <td className="px-5 py-3 text-xs">{p.lastLoginOk === undefined ? <span className="text-slate-400">Not used yet</span> : p.lastLoginOk ? <Badge tone="success">Working</Badge> : <Badge tone="danger">Failed — update login</Badge>}</td>
              <td className="px-5 py-3 text-right"><button onClick={() => remove(p)} aria-label={`Remove ${p.name}`} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </Table>
        {portals.length === 0 && <p className="px-5 py-6 text-center text-xs text-slate-400">No portals yet — add the first one.</p>}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-slate-800">Submissions</h2>
      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["Application", "Portal", "Status", "Portal says", ""]}>
          {subs.map((s) => (
            <tr key={s.id}>
              <td className="px-5 py-3 text-xs font-medium text-slate-800">{appName(s.applicationId)}</td>
              <td className="px-5 py-3 text-xs text-slate-500">{portalName(s.portalConnectionId)}</td>
              <td className="px-5 py-3 text-xs text-slate-600">{STATUS_LABEL[s.status] ?? s.status}{s.externalRef ? ` · ref ${s.externalRef}` : ""}{s.lastError ? <span className="block text-rose-600">{s.lastError}</span> : null}</td>
              <td className="px-5 py-3 text-xs text-slate-500">{s.portalStatus ?? "—"}</td>
              <td className="px-5 py-3 text-right">{s.status === "awaiting_confirm" && <button onClick={() => openPreview(s.id)} className="text-xs font-medium text-[var(--brand-600)]">Review &amp; confirm</button>}</td>
            </tr>
          ))}
        </Table>
        {subs.length === 0 && <p className="px-5 py-6 text-center text-xs text-slate-400">Nothing submitted through a portal yet. Ask the AI agent to submit an application.</p>}
      </div>

      {form && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900">Add portal</h3>
            <div className="mt-3 space-y-3">
              <label className="block text-xs font-medium text-slate-500">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. University of Leeds agent portal" className={INPUT} /></label>
              <label className="block text-xs font-medium text-slate-500">Login page URL<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" className={INPUT} /></label>
              <label className="block text-xs font-medium text-slate-500">Type
                <NeuSelect value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "b2b" | "university" })} className="mt-1 w-full text-[13px]">
                  <option value="b2b">B2B / agent portal</option><option value="university">University portal</option>
                </NeuSelect>
              </label>
              <label className="block text-xs font-medium text-slate-500">Username<input autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={INPUT} /></label>
              <label className="block text-xs font-medium text-slate-500">Password<input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={INPUT} /></label>
              <p className="text-[11px] leading-relaxed text-slate-400">I confirm I'm authorised to use this login and that the portal permits automated access. The password is stored encrypted, is never shown again, and is never sent to the AI model.</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button onClick={save} disabled={busy || !form.name.trim() || !form.url.trim() || !form.username || !form.password}>{busy ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900">Review before the final submit</h3>
            <p className="mt-1 text-xs text-slate-500">This is the portal as the AI agent filled it in. Check it carefully, then confirm.</p>
            {preview.src ? <img src={preview.src} alt="Filled-in portal form" className="mt-3 w-full rounded-lg border border-slate-200" /> : <p className="mt-3 text-xs text-slate-400">No preview image was captured.</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPreview(null)}>Close</Button>
              <Button onClick={() => confirm(preview.id)}>Confirm &amp; submit</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
