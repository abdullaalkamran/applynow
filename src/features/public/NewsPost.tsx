// One published News & Updates post — readable without logging in.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ChatMarkdown } from "../../components/ChatMarkdown";
import { fetchPublicNewsPost, mediaSrc, formatPostDate, type PublicNewsPost } from "../../data/blogApi";
import { PublicHeader } from "./News";

export default function NewsPost() {
  const { slug } = useParams();
  const [post, setPost] = useState<PublicNewsPost | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "failed">("loading");

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setState("loading");
    fetchPublicNewsPost(slug, controller.signal)
      .then((p) => { setPost(p); setState("ready"); document.title = `${p.title} — UnifinderAi`; })
      .catch((err) => {
        if ((err as Error)?.name === "AbortError") return;
        setState((err as { status?: number })?.status === 404 ? "missing" : "failed");
      });
    return () => { controller.abort(); document.title = "UnifinderAi"; };
  }, [slug]);

  const cover = mediaSrc(post?.coverImageUrl);
  return (
    <div className="min-h-dvh bg-[#f8f8f7] text-neutral-900">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-4">
        <Link to="/news" className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-900">
          <ArrowLeft size={14} /> All news
        </Link>

        {state === "loading" && <div className="h-64 animate-pulse rounded-2xl bg-neutral-200/70" />}
        {state === "missing" && <p className="text-neutral-500">This post doesn't exist or is no longer available.</p>}
        {state === "failed" && <p className="text-neutral-500">We couldn't load this post right now. Please try again in a moment.</p>}

        {state === "ready" && post && (
          <article>
            <p className="text-[13px] font-medium text-neutral-400">{formatPostDate(post.publishedAt)} · {post.authorName}</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{post.title}</h1>
            {post.excerpt && <p className="mt-3 text-[17px] leading-relaxed text-neutral-500">{post.excerpt}</p>}
            {cover && <img src={cover} alt="" className="mt-7 w-full rounded-2xl object-cover" />}
            <div className="mt-8 text-[16px] leading-[1.75] text-neutral-700">
              <ChatMarkdown text={post.content} />
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
