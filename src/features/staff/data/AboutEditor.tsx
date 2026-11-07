// Edit the public About page (unifinderai.com/about): search-result title and description, heading, the page text in Markdown
// with a live preview, the FAQ, company details and social links. Saving updates the page, its search/AI markup and the sitemap.
import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "../../../components/ui";
import { PageMarkdown } from "../../public/PageMarkdown";
import { getAbout, saveAbout, resetAbout, type AboutContent, type AboutEditable } from "../../../data/aboutApi";

const INPUT = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";
const CARD = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label} {hint && <span className="font-normal text-slate-400">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const toContent = (a: AboutEditable): AboutContent => ({ metaTitle: a.metaTitle, metaDescription: a.metaDescription, heading: a.heading, subheading: a.subheading, body: a.body, faqs: a.faqs, company: a.company, social: a.social });

export default function AboutEditor() {
  const [draft, setDraft] = useState<AboutContent | null>(null);
  const [saved, setSaved] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function apply(a: AboutEditable) {
    const c = toContent(a);
    setDraft(c); setSaved(JSON.stringify(c)); setIsDefault(a.isDefault); setUpdatedAt(a.updatedAt);
  }

  useEffect(() => {
    let cancelled = false;
    getAbout().then((a) => { if (!cancelled) apply(a); }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load the page."); });
    return () => { cancelled = true; };
  }, []);

  if (!draft) return error ? <p className="rounded-lg bg-[#f4e4e4] px-3 py-2 text-xs font-medium text-red-700">{error}</p> : <p className="text-sm text-slate-400">Loading…</p>;

  const dirty = JSON.stringify(draft) !== saved;
  const set = <K extends keyof AboutContent>(k: K, v: AboutContent[K]) => { setDraft({ ...draft, [k]: v }); setNotice(""); };
  const setFaq = (i: number, patch: Partial<{ q: string; a: string }>) => set("faqs", draft.faqs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const moveFaq = (i: number, d: number) => {
    const next = [...draft.faqs]; const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]]; set("faqs", next);
  };

  async function save() {
    if (!draft) return;
    setError(""); setNotice("");
    if (!draft.heading.trim()) return setError("The page needs a heading.");
    setBusy(true);
    try { apply(await saveAbout(draft)); setNotice("Saved — the page, its search markup and the sitemap are updated."); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save the page."); }
    finally { setBusy(false); }
  }

  async function reset() {
    if (!window.confirm("Replace everything on the About page with the original text? Your edits will be lost.")) return;
    setError(""); setNotice(""); setBusy(true);
    try { apply(await resetAbout()); setNotice("Back to the original text."); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't reset the page."); }
    finally { setBusy(false); }
  }

  const company = draft.company;
  const social = draft.social;

  return (
    <div className="max-w-3xl pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900">About page</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isDefault ? "Showing the original text — edit and save to make it yours." : `Last saved ${updatedAt ? new Date(updatedAt).toLocaleString() : ""}.`} It is public at <span className="font-medium">/about</span> and listed in the sitemap.
          </p>
        </div>
        <a href="/about" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">View page <ExternalLink size={13} /></a>
      </div>

      <div className="mt-5 space-y-4">
        <section className={`${CARD} space-y-4`}>
          <h2 className="text-sm font-semibold text-slate-900">Search results</h2>
          <Field label="Title" hint={`(${draft.metaTitle.length}/65 — longer titles get cut in Google)`}>
            <input value={draft.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} maxLength={120} className={INPUT} />
          </Field>
          <Field label="Description" hint={`(${draft.metaDescription.length}/160 — longer text gets cut)`}>
            <textarea value={draft.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} maxLength={320} rows={3} className={`${INPUT} resize-none`} />
          </Field>
        </section>

        <section className={`${CARD} space-y-4`}>
          <h2 className="text-sm font-semibold text-slate-900">Page</h2>
          <Field label="Heading"><input value={draft.heading} onChange={(e) => set("heading", e.target.value)} maxLength={120} className={INPUT} /></Field>
          <Field label="Sub-heading"><input value={draft.subheading} onChange={(e) => set("subheading", e.target.value)} maxLength={200} className={INPUT} /></Field>
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">Text</p>
              <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-medium">
                <button onClick={() => setPreview(false)} className={`rounded-md px-2.5 py-1 ${!preview ? "bg-neutral-900 text-white" : "text-slate-500"}`}>Write</button>
                <button onClick={() => setPreview(true)} className={`rounded-md px-2.5 py-1 ${preview ? "bg-neutral-900 text-white" : "text-slate-500"}`}>Preview</button>
              </div>
            </div>
            {preview ? (
              <div className="mt-1 max-h-[32rem] min-h-[16rem] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 text-[15px] leading-[1.7] text-neutral-700">
                {draft.body.trim() ? <PageMarkdown text={draft.body} /> : <p className="text-slate-400">Nothing to preview yet.</p>}
              </div>
            ) : (
              <textarea value={draft.body} onChange={(e) => set("body", e.target.value)} rows={18} className={`${INPUT} mt-1 font-mono text-[13px] leading-relaxed`} />
            )}
            <p className="mt-1.5 text-[11px] text-slate-400">Use ## for a section heading, ### for a smaller one, **bold**, *italic*, - bullets, 1. numbers, [link text](https://…) or [page](/universities), and --- for a divider.</p>
          </div>
        </section>

        <section className={`${CARD} space-y-3`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Frequently asked questions</h2>
            <Button variant="secondary" onClick={() => set("faqs", [...draft.faqs, { q: "", a: "" }])}><Plus size={14} /> Add</Button>
          </div>
          <p className="text-[11px] text-slate-400">Shown on the page and given to Google and AI assistants as FAQ data. A question with no answer is left out when you save.</p>
          {draft.faqs.length === 0 && <p className="text-sm text-slate-400">No questions yet.</p>}
          {draft.faqs.map((f, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <input value={f.q} onChange={(e) => setFaq(i, { q: e.target.value })} maxLength={300} placeholder="Question" className={`${INPUT} font-medium`} />
              <textarea value={f.a} onChange={(e) => setFaq(i, { a: e.target.value })} maxLength={2000} rows={3} placeholder="Answer" className={`${INPUT} resize-none`} />
              <div className="flex justify-end gap-1">
                <button aria-label="Move up" disabled={i === 0} onClick={() => moveFaq(i, -1)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp size={15} /></button>
                <button aria-label="Move down" disabled={i === draft.faqs.length - 1} onClick={() => moveFaq(i, 1)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown size={15} /></button>
                <button aria-label="Delete question" onClick={() => set("faqs", draft.faqs.filter((_, j) => j !== i))} className="rounded-md p-2 text-rose-500 hover:bg-rose-50"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </section>

        <section className={`${CARD} space-y-4`}>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Who we are</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">Only what you fill in is published — empty fields are left out of the page, Google markup and llms.txt. Use real, checkable details.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Registered company name"><input value={company.legalName} onChange={(e) => set("company", { ...company, legalName: e.target.value })} maxLength={300} className={INPUT} /></Field>
            <Field label="Founded (year)"><input value={company.foundedYear} onChange={(e) => set("company", { ...company, foundedYear: e.target.value })} maxLength={300} inputMode="numeric" className={INPUT} /></Field>
            <Field label="Founder(s)"><input value={company.founders} onChange={(e) => set("company", { ...company, founders: e.target.value })} maxLength={300} placeholder="Separate several with commas" className={INPUT} /></Field>
            <Field label="Contact email"><input type="email" value={company.email} onChange={(e) => set("company", { ...company, email: e.target.value })} maxLength={300} className={INPUT} /></Field>
            <Field label="Phone / WhatsApp"><input value={company.phone} onChange={(e) => set("company", { ...company, phone: e.target.value })} maxLength={300} className={INPUT} /></Field>
            <Field label="Office address"><input value={company.address} onChange={(e) => set("company", { ...company, address: e.target.value })} maxLength={300} className={INPUT} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["instagram", "facebook", "linkedin", "youtube"] as const).map((k) => (
              <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} link`}>
                <input value={social[k]} onChange={(e) => set("social", { ...social, [k]: e.target.value })} maxLength={500} placeholder="https://…" className={INPUT} />
              </Field>
            ))}
          </div>
        </section>

        {error && <p className="rounded-lg bg-[#f4e4e4] px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
        {notice && !dirty && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{notice}</p>}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={reset} disabled={busy || isDefault} className="py-2 text-xs font-medium text-slate-500 hover:text-rose-600 disabled:opacity-40 sm:py-0">Reset to original</button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-center text-[11px] text-slate-400 sm:text-right">{dirty ? "Unsaved changes" : ""}</span>
          <Button onClick={save} disabled={busy || !dirty} className="w-full sm:w-auto">{busy ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}
