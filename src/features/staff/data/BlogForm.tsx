// Write / edit a News & Updates post: title, short summary, cover image, and the body in Markdown with a live preview.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../../components/ui";
import { ChatMarkdown } from "../../../components/ChatMarkdown";
import { apiPostForm } from "../../../utils/apiClient";
import { getPost, createPost, updatePost, mediaSrc, type BlogStatus } from "../../../data/blogApi";

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
    setSaving(true);
    try {
      const input = { title, excerpt, content, coverImageUrl, status: nextStatus };
      if (isNew) await createPost(input);
      else await updatePost(id!, input);
      navigate("/staff/data/blog");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the post.");
    } finally {
      setSaving(false);
    }
  }

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
        </div>

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
