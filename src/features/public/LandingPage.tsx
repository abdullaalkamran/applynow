import { Logo } from "../../components/Logo";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { BACKEND_BASE } from "../../utils/backendBase";
import RealGlobe from "./RealGlobe";
import { fetchPublicNews, mediaSrc, formatPostDate, type PublicNewsItem } from "../../data/blogApi";
import "./LandingPage.css";

type Destination = { id: string; name: string; universityCount?: number; photoUrl?: string };
type PartnerLogo = { id: string; name: string; logoUrl: string };

// Shown only if the server can't deliver the real list (offline / empty) — never while it's still loading, since
// that flashed four fake country cards before the real ones replaced them.
const PLACEHOLDER_DESTINATIONS: Destination[] = [
  { id: "uk", name: "UK" },
  { id: "canada", name: "Canada" },
  { id: "australia", name: "Australia" },
  { id: "usa", name: "USA" },
];

/** Study destinations (and partner-university logos) from the server's public landing endpoint (no login needed).
 * `destinations` is `null` while still loading. */
function useLanding() {
  const [destinations, setDestinations] = useState<Destination[] | null>(null);
  const [logos, setLogos] = useState<PartnerLogo[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${BACKEND_BASE}/api/public/landing`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: { countries?: Destination[]; universities?: PartnerLogo[] }) => {
        setLogos(Array.isArray(data.universities) ? data.universities.filter((u) => u.logoUrl) : []);
        setDestinations(Array.isArray(data.countries) && data.countries.length > 0 ? data.countries.slice(0, 4) : PLACEHOLDER_DESTINATIONS);
      })
      .catch((err) => {
        // offline / server down: show the placeholders instead of skeletons forever (an abort is just unmount)
        if ((err as Error)?.name !== "AbortError") setDestinations(PLACEHOLDER_DESTINATIONS);
      });
    return () => controller.abort();
  }, []);

  return { destinations, logos };
}

/** Photo URLs from the server are root-relative (/uploads/…, /api/public/photo/…); prefix the API host when it differs. */
function photoSrc(url?: string) {
  if (!url) return undefined;
  return url.startsWith("/") ? `${BACKEND_BASE}${url}` : url;
}

function Header() {
  return (
    <header className="landing-header">
      <a className="brand-mark" href="/" aria-label="UnifinderAi home">
        <Logo className="h-9" />
      </a>

      <nav aria-label="Main navigation">
        <Link to="/login">Programs</Link>
        <Link to="/login">Universities</Link>
        <Link to="/login">Countries</Link>
        <Link to="/news">News &amp; Updates</Link>
      </nav>

      <div className="header-actions">
        <Link className="signin-pill" to="/login">
          Sign in
          <ArrowRight size={18} strokeWidth={1.7} />
        </Link>
      </div>
    </header>
  );
}

/** The latest published News & Updates posts (no login needed). Renders nothing while loading, on error, or when there are
 * none, so an empty blog never leaves a blank section on the landing page. */
function NewsSection() {
  const [posts, setPosts] = useState<PublicNewsItem[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetchPublicNews(controller.signal)
      .then((rows) => setPosts(rows.slice(0, 3)))
      .catch(() => { /* offline or no news yet: keep the section hidden */ });
    return () => controller.abort();
  }, []);
  if (posts.length === 0) return null;
  return (
    <section className="news-section" aria-label="News and updates">
      <div className="news-head">
        <div>
          <p className="news-kicker">News &amp; Updates</p>
          <h2>What's new at UnifinderAi</h2>
        </div>
        <Link className="news-all" to="/news">
          View all <ArrowRight size={18} strokeWidth={1.6} />
        </Link>
      </div>
      <div className="news-grid">
        {posts.map((p) => {
          const cover = mediaSrc(p.coverImageUrl);
          return (
            <Link className="news-card" to={`/news/${p.slug}`} key={p.id}>
              <div className="news-cover" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} />
              <div className="news-body">
                <span>{formatPostDate(p.publishedAt)}</span>
                <h3>{p.title}</h3>
                {p.excerpt && <p>{p.excerpt}</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Partner universities' logos drifting sideways in an endless loop. The row is rendered twice and slid by exactly
 * half its width, so the loop has no visible jump; it pauses on hover and stays still for reduced-motion users. */
function LogoMarquee({ logos }: { logos: PartnerLogo[] }) {
  // Too few logos would leave gaps in the loop — repeat the set until a half is comfortably wider than a screen.
  const repeats = Math.max(1, Math.ceil(14 / logos.length));
  const half = Array.from({ length: repeats }, () => logos).flat();
  const seconds = Math.max(24, half.length * 3.2);
  return (
    <section className="logo-marquee" aria-label="Partner universities">
      <p className="logo-marquee-title">Trusted by leading universities</p>
      <div className="logo-marquee-viewport">
        <ul className="logo-marquee-track" style={{ animationDuration: `${seconds}s` }}>
          {[0, 1].flatMap((copy) =>
            half.map((u, i) => (
              <li key={`${copy}-${i}`} aria-hidden={copy === 1 || undefined}>
                <img src={photoSrc(u.logoUrl)} alt={copy === 0 ? u.name : ""} title={u.name} loading="lazy" draggable={false} />
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const goToLogin = (event: FormEvent) => {
    event.preventDefault();
    navigate("/login");
  };
  const { destinations, logos } = useLanding();

  return (
    <main className="ai-landing" aria-label="UnifinderAi landing page">
      <section className="landing-hero">
        <Header />

        <div className="hero-copy">
          <span className="fine-rule" aria-hidden="true" />
          <h1>
            <span>Find</span>
            Your Next
            <br />
            University
          </h1>

          <form className="search-pill" aria-label="Search programs, universities or countries" onSubmit={goToLogin}>
            <Search size={27} strokeWidth={1.7} aria-hidden="true" />
            <input aria-label="Search" placeholder="Search programs, universities or countries" />
            <button type="submit" aria-label="Search">
              <ArrowRight size={25} strokeWidth={1.6} />
            </button>
          </form>
        </div>

        <div className="hero-globe">
          <RealGlobe />
        </div>
      </section>

      <section className="destination-grid" aria-label="Study destinations">
        {destinations === null && [0, 1, 2, 3].map((i) => <div className="destination-card is-skeleton" key={i} aria-hidden="true" />)}
        {(destinations ?? []).map((item) => {
          const photo = photoSrc(item.photoUrl);
          return (
            <Link className="destination-card" to="/login" key={item.id} aria-label={`Explore ${item.name}`}>
              <div
                className="destination-image"
                style={{
                  backgroundImage: photo ? `url("${photo}")` : "linear-gradient(160deg, rgba(111, 146, 255, 0.65), rgba(17, 24, 39, 0.8))",
                }}
              />
              <div className="destination-shade" />
              <div className="destination-meta">
                <div>
                  <h2>{item.name}</h2>
                  {item.universityCount ? (
                    <p className="destination-count">
                      {item.universityCount} {item.universityCount === 1 ? "university" : "universities"}
                    </p>
                  ) : null}
                </div>
                <span className="destination-go" aria-hidden="true">
                  <ArrowRight size={20} strokeWidth={1.4} />
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      {logos.length > 0 && <LogoMarquee logos={logos} />}

      <NewsSection />

      <section className="guidance-section" aria-label="AI guidance">
        <div className="guidance-copy">
          <span>
            <i />
            AI Guidance
          </span>
          <h2>
            A Smarter
            <br />
            Way Forward
          </h2>
          <button aria-label="Explore AI guidance">
            <ArrowRight size={22} strokeWidth={1.4} />
          </button>
        </div>
      </section>
    </main>
  );
}
