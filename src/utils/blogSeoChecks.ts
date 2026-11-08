// The writer's live checklist in the News editor: what to fix for the post to read well in search results and to AI assistants.
// An "error" blocks Publish; a "warning" never does. (The server finds the FAQ itself; `faqCount` is what it found on the last save.)
export interface SeoCheck { ok: boolean; level: "error" | "warn"; msg: string }

export interface SeoFields {
  title: string; seoTitle: string; excerpt: string; quickAnswer: string; content: string;
  coverImageUrl: string; coverAlt: string; countries: string[]; sources: { name: string; url: string }[]; slug: string;
}

const LOOKALIKES = /unifinder\.ai|myunifinder|unifinder\.org|charlie\s?group/i;

/** FAQ questions in the text, counted the way the server counts them: a "Frequently asked questions" heading, then a deeper heading or bold "…?" line per question. */
export function countFaqQuestions(content: string): number {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const head = (l: string) => /^(#{1,6})\s+(.*)$/.exec(l.trim());
  let start = -1; let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = head(lines[i]);
    if (m && m[1].length <= 3 && /frequently asked|\bfaqs?\b/i.test(m[2])) { start = i + 1; level = m[1].length; break; }
  }
  if (start < 0) return 0;
  let n = 0; let q = false; let answered = false;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trim();
    const h = head(line);
    if (h && h[1].length <= level) break;
    if (h || /^\*\*(.+?\?)\*\*\s*$/.test(line)) { if (q && answered) n++; q = true; answered = false; }
    else if (line && q) answered = true;
  }
  if (q && answered) n++;
  return n;
}

export function seoChecks(f: SeoFields): SeoCheck[] {
  const title = (f.seoTitle || f.title).trim();
  const summary = (f.excerpt || "").trim();
  const words = f.content.trim() ? f.content.trim().split(/\s+/).length : 0;
  const faqs = countFaqQuestions(f.content);
  return [
    { ok: !f.coverImageUrl || !!f.coverAlt.trim(), level: "error", msg: "The cover image needs a short description (alt text)." },
    { ok: title.length > 0 && title.length <= 60, level: "warn", msg: `Search title is ${title.length} characters — keep it to 60 or less so Google doesn't cut it.` },
    { ok: summary.length >= 110 && summary.length <= 160, level: "warn", msg: `Short summary is ${summary.length} characters — 110 to 160 reads best in search results.` },
    { ok: f.quickAnswer.trim().length >= 40, level: "warn", msg: "Add a quick answer: 2–3 sentences that directly answer the main question. AI assistants quote it." },
    { ok: words >= 600, level: "warn", msg: `Only ${words} words — fuller guides (600+) tend to rank better.` },
    { ok: faqs >= 3, level: "warn", msg: `${faqs} FAQ question${faqs === 1 ? "" : "s"} found — add a "Frequently asked questions" heading with a ### heading per question (aim for 3 or more).` },
    { ok: f.sources.length > 0, level: "warn", msg: "Add at least one source link (official sites build trust)." },
    { ok: f.countries.length > 0, level: "warn", msg: "Pick the countries this is about, so it links to their pages." },
    { ok: !/Unifinder\s?AI\b/.test(`${f.title} ${f.content}`.replace(/UnifinderAi/g, "")), level: "warn", msg: 'Spell the brand "UnifinderAi".' },
    { ok: !LOOKALIKES.test(f.content), level: "warn", msg: "Mentions a look-alike company name or website." },
    { ok: !/-[a-f0-9]{6}$/.test(f.slug), level: "warn", msg: "The address ends in a random code — shorten it." },
  ];
}
