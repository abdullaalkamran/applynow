// One published News & Updates post — readable without logging in.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageMarkdown } from "./PageMarkdown";
import { fetchPublicNewsPost, recordNewsRead, mediaSrc, formatPostDate, type PublicNewsPost } from "../../data/blogApi";
import { PublicHeader } from "./News";
import { setPageMeta } from "../../utils/pageMeta";

export default function NewsPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<PublicNewsPost | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "failed">("loading");

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    let restoreMeta: (() => void) | null = null;
    setState("loading");
    fetchPublicNewsPost(slug, controller.signal)
      .then((p) => {
        // An earlier address of a post whose slug changed: move to the current one, on the same page.
        if (p.slug !== slug) navigate(`/news/${encodeURIComponent(p.slug)}`, { replace: true });
        setPost(p); setState("ready"); restoreMeta = setPageMeta(`${p.seoTitle || p.title} — UnifinderAi`, p.excerpt || p.quickAnswer || p.content.replace(/[#*`>_\[\]()-]+/g, " "));
        recordNewsRead(p.slug);
      })
      .catch((err) => {
        if ((err as Error)?.name === "AbortError") return;
        setState((err as { status?: number })?.status === 404 ? "missing" : "failed");
      });
    return () => { controller.abort(); restoreMeta?.(); };
  }, [slug, navigate]);

  const cover = mediaSrc(post?.coverImageUrl);
  const edited = !!post?.publishedAt && !!post?.updatedAt && new Date(post.updatedAt).getTime() - new Date(post.publishedAt).getTime() > 86_400_000;
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
            <p className="text-[13px] font-medium text-neutral-400">
              {post.category && <span className="mr-2 rounded-full bg-neutral-200/70 px-2 py-0.5 text-neutral-600">{post.category}</span>}
              {formatPostDate(post.publishedAt)}
              {edited && <> · Updated {formatPostDate(post.updatedAt)}</>}
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{post.title}</h1>
            {post.quickAnswer ? (
              <section aria-label="Quick answer" className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">Quick answer</p>
                <p className="mt-1 text-[16px] leading-relaxed text-neutral-700">{post.quickAnswer}</p>
              </section>
            ) : post.excerpt ? <p className="mt-3 text-[17px] leading-relaxed text-neutral-500">{post.excerpt}</p> : null}
            {cover && <img src={cover} alt={post.coverAlt || ""} className="mt-7 w-full rounded-2xl object-cover" />}
            <div className="mt-8 text-[16px] leading-[1.75] text-neutral-700">
              <PageMarkdown text={post.content} />
            </div>
            {!!post.countryLinks?.length && (
              <p className="mt-8 flex flex-wrap gap-x-4 gap-y-1 text-[14px] font-medium">
                {post.countryLinks.map((c) => <Link key={c.slug} to={`/countries/${c.slug}`} className="text-neutral-900 underline underline-offset-2">Study in {c.name} →</Link>)}
              </p>
            )}
            {!!post.sources?.length && (
              <section className="mt-8" aria-label="Sources">
                <h2 className="text-[15px] font-semibold text-neutral-900">Sources</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-neutral-600">
                  {post.sources.map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="nofollow noopener noreferrer" className="underline underline-offset-2">{x.name}</a></li>)}
                </ul>
              </section>
            )}
            {!!post.related?.length && (
              <section className="mt-8" aria-label="Related news">
                <h2 className="text-[15px] font-semibold text-neutral-900">Related news</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px]">
                  {post.related.map((r) => <li key={r.slug}><Link to={`/news/${r.slug}`} className="text-neutral-700 underline underline-offset-2">{r.title}</Link></li>)}
                </ul>
              </section>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
