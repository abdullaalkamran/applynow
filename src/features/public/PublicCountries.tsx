// Public "Countries" page — every study destination Data Management has added (new ones appear on their own).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Globe2, ChevronRight } from "lucide-react";
import { PublicShell } from "./PublicPages";
import { setPageMeta } from "../../utils/pageMeta";
import { fetchPublicCountries, type PublicCountryCard } from "../../data/countryPagesApi";
import { mediaSrc } from "../../data/blogApi";

export default function PublicCountries() {
  useEffect(() => setPageMeta("Study Abroad Destinations — UnifinderAi", "Explore study destinations: fees, living costs, work rights, intakes, and the universities and courses available in each country.", "/countries"), []);
  const [countries, setCountries] = useState<PublicCountryCard[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicCountries(controller.signal).then(setCountries).catch((e) => { if ((e as Error)?.name !== "AbortError") setFailed(true); });
    return () => controller.abort();
  }, []);

  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Study abroad destinations</h1>
        <p className="mt-2 max-w-xl text-[14px] text-neutral-500">Choose a country to see why students study there, key facts on fees and living costs, and the universities and courses on UnifinderAi.</p>

        {failed ? (
          <p className="mt-8 text-neutral-500">We couldn't load the countries right now. Please try again in a moment.</p>
        ) : countries === null ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-200/70" />)}</div>
        ) : countries.length === 0 ? (
          <p className="mt-8 text-neutral-500">No countries yet — check back soon.</p>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {countries.map((c) => (
              <Link key={c.id} to={`/countries/${encodeURIComponent(c.slug)}`} className="flex items-center gap-3 rounded-2xl bg-[var(--sd-card)] p-3 shadow-neu transition hover:-translate-y-0.5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100 text-neutral-400">
                  {c.photoUrl ? <img src={mediaSrc(c.photoUrl)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Globe2 size={22} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">{c.name}</p>
                  {c.tagline && <p className="truncate text-xs text-neutral-500">{c.tagline}</p>}
                  <p className="mt-0.5 text-[11px] text-neutral-400">{c.universityCount} {c.universityCount === 1 ? "university" : "universities"} · {c.courseCount.toLocaleString("en-US")} {c.courseCount === 1 ? "course" : "courses"}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-neutral-300" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </PublicShell>
  );
}
