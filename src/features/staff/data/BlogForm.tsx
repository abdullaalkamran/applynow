// Write / edit a News & Updates post: title, short summary, cover image, and the body in Markdown with a live preview.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../../components/ui";
import { ChatMarkdown } from "../../../components/ChatMarkdown";
import { apiPostForm } from "../../../utils/apiClient";
import { getPost, createPost, updatePost, mediaSrc, type BlogStatus, type BlogSource } from "../../../data/blogApi";
import { getAllCountries } from "../../../data/countryRegistry";
import { seoChecks } from "../../../utils/blogSeoChecks";
import { Plus, Trash2 } from "lucide-react";

const INPUT = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800";

export default function DataBlogForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [quickAnswer, setQuickAnswer] = useState("");
  const [coverAlt, setCoverAlt] = useState("");
  const [category, setCategory] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [sources, setSources] = useState<BlogSource[]>([]);
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<BlogStatus>("draft");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getPost(id)
      .then((p) => {
        if (cancelled) return;
        setTitle(p.title); setExcerpt(p.excerpt); setContent(p.content); setCoverImageUrl(p.coverImageUrl ?? ""); setStatus(p.status);
        setSeoTitle(p.seoTitle); setQuickAnswer(p.quickAnswer); setCoverAlt(p.coverAlt); setCategory(p.category); setCountries(p.countries); setSources(p.sources); setSlug(p.slug);
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load this post."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  async function uploadCover(file: File) {
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const { url } = await apiPostForm<{ url: string }>("/api/universities/cover", body);
      setCoverImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The image couldn't be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function save(nextStatus: BlogStatus) {
    setError("");
    if (!title.trim()) return setError("Add a title first.");
    if (!content.trim()) return setError("Write something in the post first.");
    // A missing cover description blocks publishing (drafts can still be saved); everything else in the checklist is advice.
    const blocking = checks.find((c) => !c.ok && c.level === "error");
    if (nextStatus === "published" && blocking) return setError(blocking.msg);
    setSaving(true);
    try {
      const input = { title, excerpt, content, coverImageUrl, status: nextStatus, seoTitle, quickAnswer, coverAlt, category, countries, sources, slug };
      if (isNew) await createPost(input);
      else await updatePost(id!, input);
      navigate("/staff/data/blog");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the post.");
    } finally {
      setSaving(false);
    }
  }

  const checks = seoChecks({ title, seoTitle, excerpt, quickAnswer, content, coverImageUrl, coverAlt, countries, sources, slug });
  const countryOptions = getAllCountries().map((c) => c.name).sort((a, b) => a.localeCompare(b));
  const toggleCountry = (name: string) => setCountries((cur) => (cur.includes(name) ? cur.filter((c) => c !== name) : [...cur, name]));
  const setSource = (i: number, patch: Partial<BlogSource>) => setSources((cur) => cur.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate("/staff/data/blog")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
        <ArrowLeft size={14} /> Back to News & Updates
      </button>
      <h1 className="text-xl font-semibold text-slate-900">{isNew ? "New post" : "Edit post"}</h1>
      <p className="mb-5 mt-1 text-sm text-slate-500">
        {status === "published" ? "This post is live on the landing page." : "Drafts are only visible here until you publish them."}
      </p>

      <div className="space-y-4">
        <label className="block text-xs font-medium text-slate-500">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. UK January 2027 intake now open" className={`${INPUT} mt-1`} />
        </label>

        <label className="block text-xs font-medium text-slate-500">
          Short summary <span className="font-normal text-slate-400">(shown on the news cards — {excerpt.length}/300)</span>
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={300} rows={2} className={`${INPUT} mt-1 resize-none`} />
        </label>

        <div>
          <p className="text-xs font-medium text-slate-500">Cover image</p>
          <div className="mt-1 flex items-center gap-3">
            <div className="flex h-20 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-[11px] text-slate-400">
              {coverImageUrl ? <img src={mediaSrc(coverImageUrl)} alt="Cover preview" className="h-full w-full object-cover" /> : "No image"}
            </div>
            <div className="space-y-1.5">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCover(f); e.target.value = ""; }} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "Uploading…" : coverImageUrl ? "Replace image" : "Upload image"}
              </Button>
              {coverImageUrl && <button onClick={() => setCoverImageUrl("")} className="block text-[11px] font-medium text-rose-500">Remove image</button>}
            </div>
          </div>
          {coverImageUrl && (
            <label className="mt-2 block text-xs font-medium text-slate-500">
              Describe the image <span className="font-normal text-slate-400">(alt text — for screen readers and search)</span>
              <input value={coverAlt} onChange={(e) => setCoverAlt(e.target.value)} maxLength={190} placeholder="e.g. Students walking on a university campus in Canada" className={`${INPUT} mt-1`} />
            </label>
          )}
        </div>

        <label className="block text-xs font-medium text-slate-500">
          Quick answer <span className="font-normal text-slate-400">(2–3 sentences that directly answer the main question — shown at the top and quoted by AI assistants · {quickAnswer.length}/600)</span>
          <textarea value={quickAnswer} onChange={(e) => setQuickAnswer(e.target.value)} maxLength={600} rows={3} className={`${INPUT} mt-1 resize-none`} />
        </label>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Post</p>
            <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-medium">
              <button onClick={() => setPreview(false)} className={`rounded-md px-2.5 py-1 ${!preview ? "bg-neutral-900 text-white" : "text-slate-500"}`}>Write</button>
              <button onClick={() => setPreview(true)} className={`rounded-md px-2.5 py-1 ${preview ? "bg-neutral-900 text-white" : "text-slate-500"}`}>Preview</button>
            </div>
          </div>
          {preview ? (
            <div className="mt-1 min-h-[16rem] rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
              {content.trim() ? <ChatMarkdown text={content} /> : <p className="text-slate-400">Nothing to preview yet.</p>}
            </div>
          ) : (
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={16} placeholder={"Write the post here.\n\nYou can use ## headings, **bold**, *italic*, - bullet lists and [links](https://…)."}
              className={`${INPUT} mt-1 font-mono text-[13px] leading-relaxed`} />
          )}
        </div>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Search &amp; sharing</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-500">
              Search title <span className="font-normal text-slate-400">({(seoTitle || title).length}/60 — blank uses the title)</span>
              <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={70} className={`${INPUT} mt-1`} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${INPUT} mt-1`}>
                <option value="">None</option>
                {["Destination guide", "Visa news", "Scholarships", "Product news"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-500">
            Web address <span className="font-normal text-slate-400">(blank = made from the title. Changing it keeps the old address working as a redirect.)</span>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="shrink-0 text-xs text-slate-400">/news/</span>
              <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} maxLength={80} placeholder="made-from-the-title" className={INPUT} />
            </div>
          </label>
          <div>
            <p className="text-xs font-medium text-slate-500">Countries this is about <span className="font-normal text-slate-400">(links the post to their country pages)</span></p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {countryOptions.length === 0 && <span className="text-xs text-slate-400">No countries added yet.</span>}
              {countryOptions.map((c) => (
                <button key={c} type="button" onClick={() => toggleCountry(c)} className={`rounded-full border px-3 py-1 text-xs font-medium ${countries.includes(c) ? "border-neutral-900 bg-neutral-900 text-white" : "border-slate-200 text-slate-600"}`}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">Sources <span className="font-normal text-slate-400">(official links the post relies on)</span></p>
              <Button variant="secondary" onClick={() => setSources((cur) => [...cur, { name: "", url: "" }])}><Plus size={14} /> Add</Button>
            </div>
            {sources.map((src, i) => (
              <div key={i} className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input value={src.name} onChange={(e) => setSource(i, { name: e.target.value })} placeholder="Name (e.g. IRCC)" maxLength={160} className={INPUT} />
                <input value={src.url} onChange={(e) => setSource(i, { url: e.target.value })} placeholder="https://…" className={INPUT} />
                <button type="button" aria-label="Remove source" onClick={() => setSources((cur) => cur.filter((_, j) => j !== i))} className="self-end rounded-md p-2 text-rose-500 hover:bg-rose-50 sm:self-center"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">Checklist <span className="font-normal text-slate-400">· {checks.filter((c) => c.ok).length}/{checks.length} done</span></p>
            {checks.every((c) => c.ok) ? (
              <p className="mt-1.5 text-xs text-emerald-700">✓ Everything looks good.</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {checks.filter((c) => !c.ok).map((c, i) => (
                  <li key={i} className={`flex gap-1.5 text-xs ${c.level === "error" ? "font-medium text-red-700" : "text-slate-600"}`}>
                    <span aria-hidden>{c.level === "error" ? "✕" : "!"}</span><span>{c.msg}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {error && <p className="rounded-lg bg-[#f4e4e4] px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={() => navigate("/staff/data/blog")}>Cancel</Button>
          <Button variant="secondary" onClick={() => save("draft")} disabled={saving}>{status === "published" ? "Unpublish & save" : "Save draft"}</Button>
          <Button onClick={() => save("published")} disabled={saving}>{saving ? "Saving…" : status === "published" ? "Save changes" : "Publish"}</Button>
        </div>
      </div>
    </div>
  );
}
