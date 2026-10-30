// News & Updates — posts shown on the public landing page. Drafts stay private; "Published" ones appear on /news and the
// landing page for anyone, no login needed.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ExternalLink } from "lucide-react";
import { PageHeader, Button, Table, Badge, EmptyState } from "../../../components/ui";
import { listPosts, updatePost, deletePost, formatPostDate, type BlogPost } from "../../../data/blogApi";

export default function DataBlog() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPosts()
      .then((rows) => { if (!cancelled) setPosts(rows); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load the posts."); });
    return () => { cancelled = true; };
  }, []);

  async function toggle(post: BlogPost) {
    setBusyId(post.id);
    setError("");
    try {
      const updated = await updatePost(post.id, { status: post.status === "published" ? "draft" : "published" });
      setPosts((prev) => prev?.map((p) => (p.id === post.id ? updated : p)) ?? prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the post.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(post: BlogPost) {
    if (!window.confirm(`Delete "${post.title}"? This can't be undone.`)) return;
    setBusyId(post.id);
    setError("");
    try {
      await deletePost(post.id);
      setPosts((prev) => prev?.filter((p) => p.id !== post.id) ?? prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the post.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="News & Updates"
        subtitle="Write posts for the public landing page. Published posts are visible to everyone, no login needed."
        action={<Button onClick={() => navigate("/staff/data/blog/new")}><Plus size={15} /> New post</Button>}
      />
      {error && <p className="mb-3 rounded-lg bg-[#f4e4e4] px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

      {posts === null && !error ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : posts && posts.length === 0 ? (
        <EmptyState title="No posts yet" subtitle='Click "New post" to write the first one.' />
      ) : posts ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Table head={["Title", "Status", "Published", "Author", ""]}>
            {posts.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="max-w-sm px-5 py-3">
                  <p className="truncate font-medium text-slate-800">{p.title}</p>
                  {p.excerpt && <p className="truncate text-xs text-slate-400">{p.excerpt}</p>}
                </td>
                <td className="px-5 py-3"><Badge tone={p.status === "published" ? "green" : "amber"}>{p.status === "published" ? "Published" : "Draft"}</Badge></td>
                <td className="px-5 py-3 text-xs text-slate-500">{formatPostDate(p.publishedAt) || "—"}</td>
                <td className="px-5 py-3 text-xs text-slate-500">{p.authorName}</td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-xs font-medium">
                  <button onClick={() => navigate(`/staff/data/blog/${p.id}`)} className="mr-3 text-[var(--brand-600)]">Edit</button>
                  <button onClick={() => toggle(p)} disabled={busyId === p.id} className="mr-3 text-slate-600 disabled:opacity-40">
                    {p.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  {p.status === "published" && (
                    <a href={`/news/${p.slug}`} target="_blank" rel="noreferrer" className="mr-3 inline-flex items-center gap-1 text-slate-600">
                      View <ExternalLink size={11} />
                    </a>
                  )}
                  <button onClick={() => remove(p)} disabled={busyId === p.id} className="text-rose-500 disabled:opacity-40">Delete</button>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      ) : null}
    </div>
  );
}
