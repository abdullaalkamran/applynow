import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { BACKEND_BASE } from "../../utils/backendBase";
import RealGlobe from "./RealGlobe";
import "./LandingPage.css";

type Destination = { id: string; name: string; universityCount?: number; photoUrl?: string };

// Shown only if the server can't deliver the real list (offline / empty) — never while it's still loading, since
// that flashed four fake country cards before the real ones replaced them.
const PLACEHOLDER_DESTINATIONS: Destination[] = [
  { id: "uk", name: "UK" },
  { id: "canada", name: "Canada" },
  { id: "australia", name: "Australia" },
  { id: "usa", name: "USA" },
];

/** Study destinations from the server's public landing endpoint (no login needed). `null` = still loading. */
function useDestinations() {
  const [destinations, setDestinations] = useState<Destination[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${BACKEND_BASE}/api/public/landing`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: { countries?: Destination[] }) => {
        setDestinations(Array.isArray(data.countries) && data.countries.length > 0 ? data.countries.slice(0, 4) : PLACEHOLDER_DESTINATIONS);
      })
      .catch((err) => {
        // offline / server down: show the placeholders instead of skeletons forever (an abort is just unmount)
        if ((err as Error)?.name !== "AbortError") setDestinations(PLACEHOLDER_DESTINATIONS);
      });
    return () => controller.abort();
  }, []);

  return destinations;
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
        <span aria-hidden="true">
          <i />
          <i />
        </span>
        UnifinderAi
      </a>

      <nav aria-label="Main navigation">
        <Link to="/login">Programs</Link>
        <Link to="/login">Universities</Link>
        <Link to="/login">Countries</Link>
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

export default function LandingPage() {
  const navigate = useNavigate();
  const goToLogin = (event: FormEvent) => {
    event.preventDefault();
    navigate("/login");
  };
  const destinations = useDestinations();

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
