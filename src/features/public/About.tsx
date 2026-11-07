// Public "About" page — what UnifinderAi is, the AI voice assistant, who runs it. The text is edited by Data Management
// (Staff → About page); the server also renders it, with structured data, for search and answer engines (server/src/seo.js).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PublicHeader } from "./News";
import { PageMarkdown } from "./PageMarkdown";
import { setPageMeta } from "../../utils/pageMeta";
import { fetchPublicAbout, companyRows, DEFAULT_ABOUT, type AboutContent } from "../../data/aboutApi";

const SOCIAL_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", youtube: "YouTube" };

export default function About() {
  // Show the built-in text immediately (and if the server can't be reached); swap in the saved text when it arrives.
  const [about, setAbout] = useState<AboutContent>(DEFAULT_ABOUT);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicAbout(controller.signal).then(setAbout).catch(() => { /* keep the built-in text */ });
    return () => controller.abort();
  }, []);

  useEffect(() => setPageMeta(about.metaTitle || `${about.heading} — UnifinderAi`, about.metaDescription, "/about"), [about]);

  const rows = companyRows(about.company);
  const social = Object.entries(about.social).filter(([, url]) => url);

  return (
    <div className="min-h-dvh bg-[#f8f8f7] text-neutral-900">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{about.heading}</h1>
        {about.subheading && <p className="mt-3 text-[18px] leading-relaxed text-neutral-500">{about.subheading}</p>}

        <div className="text-[16px] leading-[1.75] text-neutral-700">
          <PageMarkdown text={about.body} />
        </div>

        {(rows.length > 0 || social.length > 0) && (
          <section aria-label="Who we are">
            <h2 className="mt-12 text-2xl font-bold tracking-tight">Who we are</h2>
            {rows.length > 0 && (
              <dl className="mt-4 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white text-[15px]">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:gap-6">
                    <dt className="w-44 shrink-0 font-medium text-neutral-500">{label}</dt>
                    <dd className="text-neutral-900">{label === "Email" ? <a className="underline underline-offset-2" href={`mailto:${value}`}>{value}</a> : value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {social.length > 0 && (
              <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
                <span className="text-neutral-500">Follow us:</span>
                {social.map(([k, url]) => <a key={k} href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-neutral-900 underline underline-offset-2">{SOCIAL_LABEL[k] ?? k}</a>)}
              </p>
            )}
          </section>
        )}

        {about.faqs.length > 0 && (
          <section aria-label="Frequently asked questions">
            <h2 className="mt-12 text-2xl font-bold tracking-tight">Frequently asked questions</h2>
            <div className="mt-4 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
              {about.faqs.map((f, i) => (
                <details key={i} className="group px-5 py-4">
                  <summary className="cursor-pointer list-none text-[16px] font-semibold text-neutral-900 marker:hidden [&::-webkit-details-marker]:hidden">{f.q}</summary>
                  <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <div className="mt-12 flex flex-wrap gap-3">
          <Link to="/courses" className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-neutral-700">Search courses <ArrowRight size={15} /></Link>
          <Link to="/signup" className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-5 py-2.5 text-[14px] font-semibold text-neutral-900 hover:bg-neutral-100">Create a free account</Link>
        </div>
      </main>
    </div>
  );
}
