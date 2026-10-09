import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { getAllCountries } from "../../data/countryRegistry";
import RealGlobe from "./RealGlobe";
import "./LandingPage.css";

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
  const countries = getAllCountries();
  const destinations = countries.length > 0 ? countries.slice(0, 4) : [
    { id: "uk", name: "UK", photoUrl: "" },
    { id: "canada", name: "Canada", photoUrl: "" },
    { id: "australia", name: "Australia", photoUrl: "" },
    { id: "usa", name: "USA", photoUrl: "" },
  ];

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
        {destinations.map((item) => (
          <article className="destination-card" key={item.id ?? item.name}>
            <div
              className="destination-image"
              style={{
                backgroundImage: item.photoUrl ? `url(${item.photoUrl})` : "linear-gradient(160deg, rgba(111, 146, 255, 0.65), rgba(17, 24, 39, 0.8))",
              }}
            />
            <div className="destination-shade" />
            <div className="destination-meta">
              <h2>{item.name}</h2>
              <button aria-label={`Explore ${item.name}`}>
                <ArrowRight size={20} strokeWidth={1.4} />
              </button>
            </div>
          </article>
        ))}
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
