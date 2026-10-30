// Public "News & Updates" — every published post, no login needed.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Logo } from "../../components/Logo";
import { fetchPublicNews, mediaSrc, formatPostDate, type PublicNewsItem } from "../../data/blogApi";

export function PublicHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
      <Link to="/" aria-label="UnifinderAi home"><Logo className="h-8" /></Link>
      <nav className="flex items-center gap-5 text-[14px] font-medium text-neutral-600">
        <Link to="/news" className="text-neutral-900">News &amp; Updates</Link>
        <Link to="/login" className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-4 py-1.5 text-neutral-900 hover:bg-neutral-100">
          Sign in <ArrowRight size={15} />
        </Link>
      </nav>
    </header>
  );
}

export function NewsCard({ post }: { post: PublicNewsItem }) {
  const cover = mediaSrc(post.coverImageUrl);
  return (
    <Link to={`/news/${post.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:shadow-lg">
      <div className="aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-neutral-200 to-neutral-100">
        {cover && <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[12px] font-medium text-neutral-400">{formatPostDate(post.publishedAt)}</p>
        <h2 className="mt-1.5 text-[17px] font-semibold leading-snug text-neutral-900">{post.title}</h2>
        {post.excerpt && <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-neutral-500">{post.excerpt}</p>}
        <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-neutral-900">Read more <ArrowRight size={14} /></span>
      </div>
    </Link>
  );
}

export default function News() {
  const [posts, setPosts] = useState<PublicNewsItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicNews(controller.signal)
      .then(setPosts)
      .catch((err) => { if ((err as Error)?.name !== "AbortError") setFailed(true); });
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-dvh bg-[#f8f8f7] text-neutral-900">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">News &amp; Updates</h1>
        <p className="mt-2 max-w-xl text-[15px] text-neutral-500">The latest from UnifinderAi — study destinations, intakes, scholarships and product news.</p>

        {failed ? (
          <p className="mt-10 text-neutral-500">We couldn't load the news right now. Please try again in a moment.</p>
        ) : posts === null ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-neutral-200/70" />)}
          </div>
        ) : posts.length === 0 ? (
          <p className="mt-10 text-neutral-500">No news yet — check back soon.</p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => <NewsCard key={p.id} post={p} />)}
          </div>
        )}
      </main>
    </div>
  );
}
