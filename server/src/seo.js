// Search-engine and answer-engine (AEO) support for the public, logged-out pages. The app itself is a client-rendered
// single-page app, so a crawler that does not run JavaScript (most AI crawlers, and Google on its first pass) would see an
// empty shell. For the public routes (/, /news, /news/:slug) the server therefore returns the same index.html with a real
// <title>, description, canonical, Open Graph / Twitter tags, JSON-LD structured data and readable page content already in it;
// React replaces that content when the app starts. It also serves robots.txt, sitemap.xml and llms.txt.
const fs = require("fs");
const path = require("path");
const prisma = require("./prismaClient");
const { getConfig } = require("./config");
const faq = require("../../src/data/landingFaq.json");
const { loadAbout } = require("./aboutPage");
const countryPages = require("./countryPages");
const { indexNowKey } = require("./indexNow");
const { slugify } = require("./slugs");

const SITE_NAME = "UnifinderAi";
const courseSearch = require("./courseSearch");
const siteMeta = require("../../src/data/siteMeta.json");
const DEFAULT_TITLE = siteMeta.title;
const DEFAULT_DESCRIPTION = siteMeta.description;
const CACHE_MS = 5 * 60 * 1000;

// Areas that must never be indexed: everything behind a login, the auth pages, and the API.
const PRIVATE_PREFIXES = ["/student", "/agent", "/staff", "/admin", "/login", "/signup", "/accept-invite", "/messages", "/api", "/uploads/documents"];

const INDEX_HTML = path.join(__dirname, "..", "..", "dist", "index.html");
let template = null;
function readTemplate() {
  if (template) return template;
  try {
    template = fs.readFileSync(INDEX_HTML, "utf8");
  } catch {
    template = null;
  }
  return template;
}

function siteUrl() {
  const fromEnv = (process.env.PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  return fromEnv || getConfig().frontendOrigins[0].replace(/\/+$/, "");
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const absolute = (url) => (!url ? undefined : /^https?:\/\//i.test(url) ? url : `${siteUrl()}${url.startsWith("/") ? "" : "/"}${url}`);
const oneLine = (s, max) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);

// ---- a small, safe Markdown -> HTML (same subset the post editor offers) ----
function inlineMd(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
    // same-site links ("/universities"); "//host" would be a protocol-relative link to another site, so it is left as text
    .replace(/\[([^\]]+)\]\((\/(?!\/)[^)\s]*)\)/g, '<a href="$2">$1</a>');
}
function markdownToHtml(md, headingOffset = 1, withIds = false) {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inlineMd(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
      flushPara(); flushList();
      const level = Math.min(4, Math.max(2, m[1].length + headingOffset)); // the page's own <h1> is the post title
      out.push(`<h${level}${withIds ? ` id="${slugify(plainText(m[2]), "section")}"` : ""}>${inlineMd(m[2])}</h${level}>`);
    } else if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) {
      flushPara();
      if (list !== "ul") { flushList(); out.push("<ul>"); list = "ul"; }
      out.push(`<li>${inlineMd(m[1])}</li>`);
    } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      flushPara();
      if (list !== "ol") { flushList(); out.push("<ol>"); list = "ol"; }
      out.push(`<li>${inlineMd(m[1])}</li>`);
    } else if (/^---+$/.test(line.trim())) {
      flushPara(); flushList(); out.push("<hr>");
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return out.join("\n");
}

/** Fits text into a search-result snippet: one line, cut at a word boundary with an ellipsis. Descriptions over ~160 characters are
 * truncated by search engines anyway, so cut them ourselves at a sensible place. */
function clampText(text, max) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  // Prefer ending on a whole sentence; otherwise on a whole word.
  const upTo = t.slice(0, max);
  const sentence = upTo.search(/[.!?](?=[^.!?]*$)/);
  if (sentence >= max * 0.6) return upTo.slice(0, sentence + 1);
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}
const DESCRIPTION_MAX = 160;
const TITLE_MAX = 65;
/** A page title: the site name is dropped from the end when it would push the title past what results display. */
function fitTitle(title) {
  if (title.length <= TITLE_MAX) return title;
  const bare = title.replace(new RegExp(`\\s+[—-]\\s+${SITE_NAME}$`), "");
  return clampText(bare, TITLE_MAX);
}

/** Plain-text summary of a post, for its description when the author left the summary empty. */
function plainText(md) {
  return String(md || "").replace(/[#*`>_-]+/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
}

// ---- page rendering ----
function jsonLdScript(objects) {
  // "<" is escaped so a stray "</script>" in any text can never end the tag early.
  return objects.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("\n    ");
}

function render({ title: rawTitle, description: rawDescription, path: pagePath, image, type = "website", jsonLd = [], bodyHtml = "", noindex = false, status = 200 }) {
  const html = readTemplate();
  if (!html) return null;
  const title = fitTitle(rawTitle);
  const description = clampText(rawDescription, DESCRIPTION_MAX);
  const url = `${siteUrl()}${pagePath}`;
  // Default preview is the square (1:1) brand image; a post with its own cover uses that instead.
  const img = absolute(image) || absolute("/brand/share.png");
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta name="robots" content="${noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1"}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    ...(image ? [] : [`<meta property="og:image:width" content="1200" />`, `<meta property="og:image:height" content="1200" />`, `<meta property="og:image:alt" content="${SITE_NAME} logo" />`]),
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    `<link rel="alternate" type="application/rss+xml" title="${SITE_NAME} — News &amp; Updates" href="/rss.xml" />`,
    jsonLdScript(jsonLd),
  ].filter(Boolean).join("\n    ");

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<meta\s+name="robots"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    // The landing page's structured data and <noscript> copy are baked into the built index.html (see vite.config.ts);
    // other routes get their own, so remove them here.
    .replace(/<script[^>]*data-landing-seo[^>]*>[\s\S]*?<\/script>\s*/gi, "")
    .replace(/<noscript[^>]*data-landing-seo[^>]*>[\s\S]*?<\/noscript>\s*/gi, "")
    .replace(/<meta\s+property="og:[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^>]*>/gi, "")
    .replace("</head>", `    ${head}\n  </head>`);
  // Readable content for crawlers that don't run scripts; React replaces it as soon as the app mounts.
  if (bodyHtml) out = out.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
  return { html: out, status };
}

const faqJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});

const socialLinks = (about) => Object.values(about?.social || {}).filter(Boolean);
// The home page and the About page describe the same organisation: same @id, same sameAs list.
const orgJsonLd = (about) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl()}/#organization`,
  name: SITE_NAME,
  url: siteUrl(),
  logo: absolute("/brand/share.png"),
  description: DEFAULT_DESCRIPTION,
  ...(socialLinks(about).length ? { sameAs: socialLinks(about) } : {}),
});

const siteJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: siteUrl(),
  description: DEFAULT_DESCRIPTION,
  // Lets search engines offer a search box for the university catalogue straight from the results page.
  potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${siteUrl()}/universities?q={search_term_string}` }, "query-input": "required name=search_term_string" },
});

async function publishedPosts(take = 60) {
  return prisma.blogPost.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take,
    select: { slug: true, title: true, excerpt: true, quickAnswer: true, content: true, coverImageUrl: true, publishedAt: true, updatedAt: true },
  });
}

const dateText = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

// ---- direct answers (AEO) -------------------------------------------------------------------------------------------------
// Short, factual answers built ONLY from what is stored for the university/course — nothing is invented; a question is left out
// when the data to answer it isn't there. They appear as readable text on the page and as FAQPage structured data, which is what
// search engines and AI answer engines quote.
const joinList = (items, max = 6) => {
  const list = items.filter(Boolean);
  const shown = list.slice(0, max);
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : shown[0] || "";
};
const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : []);
const money = (symbol, amount) => `${(symbol || "").trim()}${Math.round(amount).toLocaleString("en-US")}`;
const plural = (n, one, many) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

function universityFacts(u) {
  const where = [u.city, u.state, u.country].filter(Boolean).join(", ");
  const rank = u.qsRanking ? `QS #${String(u.qsRanking).replace(/^#/, "")}` : u.timesHigherRanking ? `THE #${String(u.timesHigherRanking).replace(/^#/, "")}` : "";
  const intakes = strings(u.intakes);
  const courseCount = u.courseCount ?? 0;
  const summary = [
    `${u.name} is a university in ${where}${rank ? `, ranked ${rank}` : ""}.`,
    courseCount > 0 ? `${plural(courseCount, "course", "courses")} listed${u.scholarshipsAvailable ? ", scholarships available" : ""}.` : "",
    intakes.length ? `Intakes: ${joinList(intakes)}.` : "",
  ].filter(Boolean).join(" ");

  const faqs = [{ q: `Where is ${u.name} located?`, a: `${u.name} is in ${where}.` }];
  const names = strings(u.courseNames);
  if (courseCount > 0) faqs.push({ q: `What courses does ${u.name} offer?`, a: `${u.name} lists ${plural(courseCount, "course", "courses")} on ${SITE_NAME}${names.length ? `, such as ${joinList(names, 5)}` : ""}. You can filter them by level, intake and fee.` });
  const fees = (Array.isArray(u.fees) ? u.fees : []).filter((f) => f && typeof f.label === "string" && Number.isFinite(f.amount) && f.amount > 0).slice(0, 6);
  if (fees.length) faqs.push({ q: `What are the tuition fees at ${u.name}?`, a: `Published fees at ${u.name}: ${fees.map((f) => `${f.label} ${money(u.currencySymbol, f.amount)}`).join("; ")}. The exact annual fee depends on the course — check each course's page.` });
  const tests = [...new Set([...(u.englishRequirements?.undergraduate ?? []), ...(u.englishRequirements?.postgraduate ?? [])].map((e) => e && e.testName).filter(Boolean))];
  if (u.minIELTS > 0 || tests.length) {
    faqs.push({ q: `What English language score do I need for ${u.name}?`, a: `${u.minIELTS > 0 ? `The minimum is an IELTS overall score of ${u.minIELTS}. ` : ""}${tests.length ? `Accepted English tests include ${joinList(tests)}.` : ""}`.trim() });
  }
  if (intakes.length) faqs.push({ q: `When are the intakes at ${u.name}?`, a: `${u.name} runs intakes in ${joinList(intakes, 12)}.${u.openIntake ? ` The intake currently open for applications is ${u.openIntake}.` : ""}` });
  if (u.scholarshipsAvailable) {
    const named = (Array.isArray(u.scholarships) ? u.scholarships : []).filter((s) => s && s.name).slice(0, 3);
    faqs.push({ q: `Does ${u.name} offer scholarships?`, a: `Yes.${named.length ? ` For example: ${named.map((s) => `${s.name}${s.amount ? ` (${s.amount})` : ""}`).join("; ")}.` : ""}` });
  }
  const steps = strings(u.admissionSteps).slice(0, 8);
  faqs.push({ q: `How do I apply to ${u.name}?`, a: steps.length ? `The steps are: ${steps.map((s, i) => `${i + 1}. ${s}`).join(" ")}` : `Create a free ${SITE_NAME} account, shortlist the courses you want and apply with the help of a counsellor.` });
  return { summary, faqs };
}

function courseFacts(c, u) {
  const where = [u.city, u.country].filter(Boolean).join(", ");
  const fee = feeSentence(c, u);
  const intakes = strings(c.intakes).length ? strings(c.intakes) : strings(u.intakes);
  const kind = [c.level && c.level.toLowerCase(), c.subject].filter(Boolean).join(" ");
  const clauses = [c.duration && `takes ${c.duration}`, fee && (fee === "Free" ? "is free" : `costs ${fee}`), intakes.length && `starts in ${joinList(intakes, 6)}`].filter(Boolean);
  const summary = `${c.name} is ${kind ? `a ${kind} course` : "a course"} at ${u.name}, ${where}.${clauses.length ? ` It ${joinList(clauses, 3)}.` : ""}`;
  // The meta description: the same facts, tighter, so duration / fee / start survive the ~160-character limit.
  const quick = [c.duration, fee && (fee === "Free" ? "free" : fee), intakes.length && `starts ${joinList(intakes, 3)}`].filter(Boolean).join(", ");
  const snippet = `${c.name} — ${kind ? `${kind} course` : "course"} at ${u.name}, ${u.country}.${quick ? ` ${quick}.` : ""}`;

  const faqs = [];
  if (c.duration) faqs.push({ q: `How long is ${c.name} at ${u.name}?`, a: `${c.name} takes ${c.duration}${c.studyMode ? ` (${c.studyMode})` : ""}.` });
  if (fee) faqs.push({ q: `How much does ${c.name} at ${u.name} cost?`, a: fee === "Free" ? "It is listed as free." : `The listed tuition fee is ${fee}. Fees can change, so confirm the current amount before you apply.` });
  if (intakes.length) faqs.push({ q: `When does ${c.name} start?`, a: `Intakes: ${joinList(intakes, 12)}.` });
  if (c.level) faqs.push({ q: `What level is ${c.name}?`, a: `It is a ${c.level.toLowerCase()} course${c.subject ? ` in ${c.subject}` : ""}.` });
  const modules = strings(c.modules);
  if (modules.length) faqs.push({ q: `What will I study on ${c.name}?`, a: `Modules include ${joinList(modules, 6)}.` });
  const careers = strings(c.careers);
  if (careers.length) faqs.push({ q: `What careers can ${c.name} lead to?`, a: `Typical roles include ${joinList(careers, 6)}.` });
  return { summary, snippet, faqs };
}

const faqHtml = (faqs) => (faqs.length ? `<section><h2>Frequently asked questions</h2>${faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}</section>` : "");
const faqLd = (faqs) => (faqs.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []);

async function landingPage() {
  const posts = await publishedPosts(3);
  const { content: about } = await loadAbout();
  const newsHtml = posts.length
    ? `<section><h2>News &amp; Updates</h2><ul>${posts.map((p) => `<li><a href="/news/${esc(p.slug)}">${esc(p.title)}</a>${p.excerpt ? ` — ${esc(p.excerpt)}` : ""}</li>`).join("")}</ul><p><a href="/news">All news</a></p></section>`
    : "";
  const bodyHtml = `
    <main>
      <h1>${esc(DEFAULT_TITLE)}</h1>
      <p>${esc(DEFAULT_DESCRIPTION)}</p>
      <p><a href="/universities">Universities</a> · <a href="/courses">Courses</a> · <a href="/countries">Countries</a> · <a href="/about">About</a> · <a href="/login">Sign in</a> · <a href="/signup">Create an account</a> · <a href="/news">News &amp; Updates</a></p>
      <section><h2>Frequently asked questions</h2>
        ${faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("\n        ")}
      </section>
      ${newsHtml}
    </main>`;
  return render({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, path: "/", jsonLd: [orgJsonLd(about), siteJsonLd(), faqJsonLd()], bodyHtml });
}

/** Plain-text list of the company details that were actually filled in (nothing is shown or published for an empty field). */
function companyRows(about) {
  const c = about.company || {};
  return [["Registered company", c.legalName], ["Founded", c.foundedYear], ["Founders", c.founders], ["Office", c.address], ["Email", c.email], ["Phone / WhatsApp", c.phone]].filter(([, v]) => v);
}

async function aboutPage() {
  const { content: a } = await loadAbout();
  const base = siteUrl();
  const rows = companyRows(a);
  const social = socialLinks(a);
  const whoHtml = rows.length || social.length
    ? `<section><h2>Who we are</h2>${rows.length ? `<ul>${rows.map(([k, v]) => `<li><strong>${esc(k)}:</strong> ${esc(v)}</li>`).join("")}</ul>` : ""}${social.length ? `<p>Follow us: ${social.map((u) => `<a href="${esc(u)}" rel="noopener noreferrer">${esc(u.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>`).join(" · ")}</p>` : ""}</section>`
    : "";
  const bodyHtml = `
    <main>
      <h1>${esc(a.heading)}</h1>
      ${a.subheading ? `<p>${esc(a.subheading)}</p>` : ""}
      ${markdownToHtml(a.body, 0)}
      ${whoHtml}
      ${faqHtml(a.faqs)}
      <p><a href="/">Home</a> · <a href="/universities">Universities</a> · <a href="/courses">Courses</a> · <a href="/news">News &amp; Updates</a></p>
    </main>`;
  const c = a.company;
  const org = {
    "@type": "EducationalOrganization",
    "@id": `${base}/#organization`,
    name: SITE_NAME,
    url: base,
    logo: absolute("/brand/share.png"),
    description: a.metaDescription || DEFAULT_DESCRIPTION,
    ...(c.legalName ? { legalName: c.legalName } : {}),
    ...(c.foundedYear ? { foundingDate: c.foundedYear } : {}),
    ...(c.founders ? { founder: c.founders.split(/\s*(?:,|&|\band\b)\s*/i).filter(Boolean).map((name) => ({ "@type": "Person", name })) } : {}),
    ...(c.address ? { address: { "@type": "PostalAddress", streetAddress: c.address } } : {}),
    ...(c.email ? { email: c.email } : {}),
    ...(c.phone ? { telephone: c.phone } : {}),
    ...(social.length ? { sameAs: social } : {}),
  };
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "AboutPage", "@id": `${base}/about#webpage`, url: `${base}/about`, name: a.metaTitle || a.heading, about: { "@id": `${base}/#organization` }, inLanguage: "en" },
      org,
      ...(a.faqs.length ? [{ "@type": "FAQPage", mainEntity: a.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
    ],
  };
  return render({ title: a.metaTitle || `${a.heading} — ${SITE_NAME}`, description: a.metaDescription || DEFAULT_DESCRIPTION, path: "/about", jsonLd: [graph], bodyHtml });
}

async function newsIndexPage() {
  const posts = await publishedPosts(60);
  const bodyHtml = `
    <main>
      <h1>News &amp; Updates</h1>
      <p>The latest from ${SITE_NAME} — study destinations, intakes, scholarships and product news.</p>
      <ul>${posts.map((p) => `<li><h2><a href="/news/${esc(p.slug)}">${esc(p.title)}</a></h2><p>${esc(dateText(p.publishedAt))}${p.excerpt ? ` — ${esc(p.excerpt)}` : ""}</p></li>`).join("")}</ul>
    </main>`;
  return render({
    title: `News & Updates — ${SITE_NAME}`,
    description: "News and updates from UnifinderAi: study destinations, intakes, scholarships and product news for students and agents.",
    path: "/news",
    jsonLd: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "News & Updates", url: `${siteUrl()}/news` }],
    bodyHtml,
  });
}

// ---- public university catalogue pages (/universities, /universities/:slug, /universities/:slug/courses/:slug, /courses) ----
// Addresses use readable names (see slugs.js). The old id-style addresses still work and redirect to the readable one. The slugs
// come from the search index; if it can't be built the pages fall back to ids rather than failing.
async function catalog() {
  try { return await courseSearch.getIndex(); } catch (err) { console.warn("SEO pages: search index unavailable, using ids:", err.message); return null; }
}
const universityPath = (u) => `/universities/${encodeURIComponent(u.slug ?? u.id)}`;
const coursePathOf = (u, c) => `${universityPath(u)}/courses/${encodeURIComponent(c.slug ?? c.id)}`;
const publicImage = (v) => (typeof v === "string" && (v.startsWith("/uploads/") || /^https?:\/\//i.test(v)) ? v : undefined);

const KEY_INFO = [["popularIntakes", "Popular intakes"], ["avgTuitionFeeRange", "Average tuition fees"], ["costOfLivingRange", "Cost of living"], ["postStudyWorkVisa", "Post-study work visa"], ["dependentsAllowed", "Dependents allowed"], ["partTimeWork", "Part-time work"], ["applicationProcessingTime", "Application processing time"]];

async function countriesIndexPage() {
  const all = (await countryPages.listCountries()).sort((a, b) => b.universityCount - a.universityCount || a.name.localeCompare(b.name));
  const bodyHtml = `
    <main>
      <h1>Study abroad destinations</h1>
      <p>Choose a country to see why students study there, key facts on fees, living costs and work rights, and the partner universities and courses on ${SITE_NAME}.</p>
      <ul>${all.map((c) => `<li><h2><a href="/countries/${esc(c.slug)}">Study in ${esc(c.name)}</a></h2><p>${plural(c.universityCount, "university", "universities")} · ${plural(c.courseCount, "course", "courses")}</p></li>`).join("")}</ul>
    </main>`;
  return render({
    title: `Study Abroad Destinations — ${SITE_NAME}`,
    description: `Explore ${all.length ? `${all.length} ` : ""}study destinations: fees, living costs, work rights, intakes, and the universities and courses available in each country.`,
    path: "/countries",
    jsonLd: [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: "Study abroad destinations", url: `${siteUrl()}/countries` },
      { "@context": "https://schema.org", "@type": "ItemList", name: "Study destinations", numberOfItems: all.length, itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: `${siteUrl()}/countries/${c.slug}` })) },
    ],
    bodyHtml,
  });
}

/** Direct answers about a country, from what Data Management entered and the catalogue only — a question is left out when its data isn't there. */
function countryFacts(name, row, sum) {
  const faqs = [];
  const ki = row.keyInfo || {};
  if (sum.universityCount > 0) faqs.push({ q: `How many universities can I choose from in ${name}?`, a: `${SITE_NAME} lists ${plural(sum.universityCount, "partner university", "partner universities")} in ${name}, with ${plural(sum.courseCount, "course", "courses")} between them.` });
  if (ki.avgTuitionFeeRange) faqs.push({ q: `How much does it cost to study in ${name}?`, a: `Average tuition fees in ${name}: ${ki.avgTuitionFeeRange}.${ki.costOfLivingRange ? ` Cost of living: ${ki.costOfLivingRange}.` : ""}` });
  else if (ki.costOfLivingRange) faqs.push({ q: `What is the cost of living in ${name}?`, a: `${ki.costOfLivingRange}.` });
  if (ki.popularIntakes) faqs.push({ q: `When can I start studying in ${name}?`, a: `Popular intakes: ${ki.popularIntakes}.` });
  if (ki.postStudyWorkVisa) faqs.push({ q: `Can I work after studying in ${name}?`, a: `Post-study work visa: ${ki.postStudyWorkVisa}.` });
  if (ki.partTimeWork) faqs.push({ q: `Can international students work part-time in ${name}?`, a: `${ki.partTimeWork}.` });
  if (sum.subjectCounts.length) faqs.push({ q: `What can I study in ${name}?`, a: `Popular study areas include ${joinList(sum.subjectCounts.slice(0, 6).map((x) => x.subject), 6)}.` });
  return faqs;
}

async function countryPage(param) {
  const hit = await countryPages.resolveCountry(param);
  const row = hit ? await prisma.country.findUnique({ where: { id: hit.id } }) : null;
  if (!hit || !row) {
    return render({ title: `Country not found — ${SITE_NAME}`, description: "This country doesn't exist or is no longer available.", path: `/countries/${encodeURIComponent(param)}`, noindex: true, status: 404, bodyHtml: "<main><h1>Country not found</h1></main>" });
  }
  // An id- or name-style address goes to the readable one.
  if (decodeURIComponent(param) !== hit.slug) return { redirect: `/countries/${encodeURIComponent(hit.slug)}` };
  const sum = countryPages.summarize(hit);
  const name = hit.name;
  const base = siteUrl();
  const faqs = countryFacts(name, row, sum);
  const ki = row.keyInfo || {};
  const keyRows = KEY_INFO.filter(([k]) => ki[k]);
  const highlights = Array.isArray(row.whyStudyHighlights) ? row.whyStudyHighlights.filter((h) => h && h.title) : [];
  const summary = clampText(
    [row.tagline, row.whyThisCountry ? plainText(row.whyThisCountry) : "", sum.universityCount ? `${plural(sum.universityCount, "partner university", "partner universities")} and ${plural(sum.courseCount, "course", "courses")} on ${SITE_NAME}.` : ""].filter(Boolean).join(" "),
    DESCRIPTION_MAX,
  ) || `Study in ${name}: universities, courses, fees and entry requirements on ${SITE_NAME}.`;
  const image = publicImage(row.photoUrl) || (row.photoUrl ? `${base}/api/public/photo/country/${encodeURIComponent(row.id)}` : undefined);
  const bodyHtml = `
    <main>
      <h1>Study in ${esc(name)}</h1>
      ${row.tagline ? `<p>${esc(row.tagline)}</p>` : ""}
      <p>${sum.universityCount ? `${esc(plural(sum.universityCount, "partner university", "partner universities"))} · ${esc(plural(sum.courseCount, "course", "courses"))} on ${SITE_NAME}.` : `Universities in ${esc(name)} are being added.`}${row.internationalStudentStat ? ` International students: ${esc(row.internationalStudentStat)}.` : ""}</p>
      ${row.whyThisCountry ? `<section><h2>Why study in ${esc(name)}?</h2>${markdownToHtml(row.whyThisCountry, 0)}</section>` : ""}
      ${highlights.length ? `<section><h2>Highlights</h2><ul>${highlights.map((h) => `<li><strong>${esc(h.title)}</strong>${h.description ? ` — ${esc(h.description)}` : ""}</li>`).join("")}</ul></section>` : ""}
      ${keyRows.length ? `<section><h2>Key facts</h2><ul>${keyRows.map(([k, label]) => `<li><strong>${esc(label)}:</strong> ${esc(ki[k])}</li>`).join("")}</ul></section>` : ""}
      ${sum.universities.length ? `<section><h2>Universities in ${esc(name)}</h2><ul>${sum.universities.slice(0, 200).map((u) => `<li><a href="${esc(universityPath(u))}">${esc(u.name)}</a>${u.city ? ` — ${esc(u.city)}` : ""}</li>`).join("")}</ul></section>` : ""}
      ${sum.subjectCounts.length ? `<section><h2>Popular study areas</h2><ul>${sum.subjectCounts.slice(0, 12).map((x) => `<li>${esc(x.subject)} (${x.count})</li>`).join("")}</ul></section>` : ""}
      ${faqHtml(faqs)}
      <p><a href="/countries">All countries</a> · <a href="/universities">Universities</a> · <a href="/courses">Courses</a></p>
    </main>`;
  return render({
    title: `Study in ${name}: Universities, Fees & Courses — ${SITE_NAME}`,
    description: summary,
    path: `/countries/${hit.slug}`,
    image,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "WebPage", name: `Study in ${name}`, url: `${base}/countries/${hit.slug}`, description: summary, about: { "@type": "Country", name } },
      {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
          { "@type": "ListItem", position: 2, name: "Countries", item: `${base}/countries` },
          { "@type": "ListItem", position: 3, name, item: `${base}/countries/${hit.slug}` },
        ],
      },
      ...(sum.universities.length ? [{ "@context": "https://schema.org", "@type": "ItemList", name: `Universities in ${name}`, numberOfItems: sum.universities.length, itemListElement: sum.universities.slice(0, 100).map((u, i) => ({ "@type": "ListItem", position: i + 1, name: u.name, url: `${base}${universityPath(u)}` })) }] : []),
      ...faqLd(faqs),
    ],
    bodyHtml,
  });
}

async function universitiesIndexPage() {
  const idx = await catalog();
  const rows = idx
    ? [...idx.universities].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 500)
    : await prisma.university.findMany({ select: { id: true, name: true, city: true, country: true }, orderBy: { name: "asc" }, take: 500 });
  const bodyHtml = `
    <main>
      <h1>Explore universities</h1>
      <p>Browse partner universities worldwide: where they are, what they offer, fees and entry requirements.</p>
      <ul>${rows.map((u) => `<li><h2><a href="${esc(universityPath(u))}">${esc(u.name)}</a></h2><p>${esc(u.city)}, ${esc(u.country)}</p></li>`).join("")}</ul>
    </main>`;
  return render({
    title: `Explore Universities Worldwide — ${SITE_NAME}`,
    description: `Browse ${rows.length ? `${rows.length.toLocaleString("en-US")} partner` : "partner"} universities worldwide: location, courses, fees, intakes, scholarships and entry requirements.`,
    path: "/universities",
    jsonLd: [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: "Explore universities", url: `${siteUrl()}/universities` },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Partner universities",
        numberOfItems: rows.length,
        itemListElement: rows.slice(0, 100).map((u, i) => ({ "@type": "ListItem", position: i + 1, name: u.name, url: `${siteUrl()}${universityPath(u)}` })),
      },
    ],
    bodyHtml,
  });
}

async function coursesIndexPage() {
  const bodyHtml = `
    <main>
      <h1>Explore courses</h1>
      <p>Search thousands of courses at partner universities worldwide and compare level, duration, fees and intakes.</p>
      <p><a href="/universities">Browse universities</a></p>
    </main>`;
  return render({
    title: `Explore Courses Worldwide — ${SITE_NAME}`,
    description: "Search courses at partner universities worldwide and compare level, duration, fees and intakes. Filter by country, subject and budget.",
    path: "/courses",
    jsonLd: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Explore courses", url: `${siteUrl()}/courses` }],
    bodyHtml,
  });
}

async function universityPage(param) {
  const idx = await catalog();
  const hit = idx ? courseSearch.resolveUniversity(idx, param) : null;
  if (idx && !hit) {
    return render({ title: `University not found — ${SITE_NAME}`, description: "This university doesn't exist or is no longer available.", path: `/universities/${encodeURIComponent(param)}`, noindex: true, status: 404, bodyHtml: "<main><h1>University not found</h1></main>" });
  }
  // An old id-style (or differently cased) address: send visitors and crawlers to the readable one.
  if (hit && param !== hit.slug) return { redirect: universityPath(hit) };
  const id = hit ? hit.id : param;
  const u = await prisma.university.findUnique({
    where: { id },
    select: {
      id: true, name: true, city: true, state: true, country: true, description: true, highlights: true, website: true, logoUrl: true, coverPhotoUrl: true,
      fees: true, currencySymbol: true, intakes: true, openIntake: true, minIELTS: true, englishRequirements: true, scholarshipsAvailable: true,
      scholarships: true, admissionSteps: true, qsRanking: true, timesHigherRanking: true,
      courses: { select: { id: true, name: true, level: true, duration: true }, orderBy: { id: "asc" }, take: 40 },
      _count: { select: { courses: true } },
    },
  });
  if (!u) {
    return render({ title: `University not found — ${SITE_NAME}`, description: "This university doesn't exist or is no longer available.", path: `/universities/${encodeURIComponent(param)}`, noindex: true, status: 404, bodyHtml: "<main><h1>University not found</h1></main>" });
  }
  const uPath = hit ? universityPath(hit) : `/universities/${encodeURIComponent(u.id)}`;
  const where = `${u.city}, ${u.country}`;
  const facts = universityFacts({ ...u, courseCount: u._count.courses, courseNames: u.courses.map((c) => c.name) });
  // The meta description is the direct-answer summary (name, place, ranking, courses, intakes) — what a result snippet should say.
  const description = facts.summary;
  const image = publicImage(u.coverPhotoUrl) || publicImage(u.logoUrl);
  const highlights = Array.isArray(u.highlights) ? u.highlights.filter((h) => typeof h === "string") : [];
  const bodyHtml = `
    <main><article>
      <p><a href="/universities">All universities</a></p>
      <h1>${esc(u.name)}</h1>
      <p>${esc(where)}</p>
      <p><strong>${esc(facts.summary)}</strong></p>
      ${u.description ? `<p>${esc(u.description)}</p>` : ""}
      ${highlights.length ? `<ul>${highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
      ${u.courses.length ? `<h2>Courses (${u._count.courses})</h2><ul>${u.courses.map((c) => `<li><a href="${esc(`${uPath}/courses/${encodeURIComponent(hit?.courseById.get(c.id)?.slug ?? c.id)}`)}">${esc(c.name)}</a> — ${esc(c.level)}, ${esc(c.duration)}</li>`).join("")}</ul>` : ""}
      ${faqHtml(facts.faqs)}
    </article></main>`;
  return render({
    title: `${u.name} — ${where} — ${SITE_NAME}`,
    description,
    path: uPath,
    image,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollegeOrUniversity",
        name: u.name,
        description,
        url: `${siteUrl()}${uPath}`,
        sameAs: u.website ? [`https://${String(u.website).replace(/^https?:\/\//i, "")}`] : undefined,
        logo: absolute(publicImage(u.logoUrl)),
        image: image ? [absolute(image)] : undefined,
        address: { "@type": "PostalAddress", addressLocality: u.city, addressCountry: u.country },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl() },
          { "@type": "ListItem", position: 2, name: "Universities", item: `${siteUrl()}/universities` },
          { "@type": "ListItem", position: 3, name: u.name, item: `${siteUrl()}${uPath}` },
        ],
      },
      ...faqLd(facts.faqs),
    ],
    bodyHtml,
  });
}

const feeSentence = (course, uni) => {
  if (course.feeStatus === "free") return "Free";
  if (course.feeStatus !== "unknown" && Number.isFinite(course.feeUSD) && course.feeUSD > 0) {
    const symbol = (course.currencySymbol && course.currencySymbol.trim() ? course.currencySymbol : uni.currencySymbol) || "";
    return `${symbol}${Math.round(course.feeUSD).toLocaleString("en-US")} per year`;
  }
  return "";
};

async function coursePage(universityParam, courseParam) {
  const idx = await catalog();
  const uHit = idx ? courseSearch.resolveUniversity(idx, universityParam) : null;
  const cHit = uHit ? courseSearch.resolveCourse(uHit, courseParam) : null;
  const notFound = () => render({ title: `Course not found — ${SITE_NAME}`, description: "This course doesn't exist or is no longer available.", path: `/universities/${encodeURIComponent(universityParam)}/courses/${encodeURIComponent(courseParam)}`, noindex: true, status: 404, bodyHtml: "<main><h1>Course not found</h1></main>" });
  if (idx && !cHit) return notFound();
  // Old id-style addresses redirect to the readable one.
  if (uHit && cHit && (universityParam !== uHit.slug || courseParam !== cHit.slug)) return { redirect: coursePathOf(uHit, cHit) };
  const universityId = uHit ? uHit.id : universityParam;
  const courseId = cHit ? cHit.id : courseParam;
  const c = await prisma.course.findFirst({
    where: { id: courseId, universityId },
    select: {
      id: true, name: true, level: true, duration: true, subject: true, feeUSD: true, feeStatus: true, currencySymbol: true, description: true,
      studyMode: true, intakes: true, modules: true, careers: true,
      university: { select: { id: true, name: true, city: true, country: true, currencySymbol: true, logoUrl: true, coverPhotoUrl: true, website: true, intakes: true } },
    },
  });
  if (!c) return notFound();
  const path = uHit && cHit ? coursePathOf(uHit, cHit) : `/universities/${encodeURIComponent(universityId)}/courses/${encodeURIComponent(courseId)}`;
  const u = c.university;
  const where = `${u.city}, ${u.country}`;
  const fee = feeSentence(c, u);
  const facts = [c.level, c.duration, c.studyMode, c.subject].filter(Boolean).join(" · ");
  const answers = courseFacts(c, u);
  // Direct-answer summary (level, subject, university, place, duration, fee, start) — what a result snippet should say.
  const description = answers.snippet;
  const image = publicImage(u.coverPhotoUrl) || publicImage(u.logoUrl);
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  const modules = list(c.modules);
  const careers = list(c.careers);
  const intakes = list(c.intakes);
  const uniPath = uHit ? universityPath(uHit) : `/universities/${encodeURIComponent(u.id)}`;
  const uniUrl = `${siteUrl()}${uniPath}`;
  const bodyHtml = `
    <main><article>
      <p><a href="/universities">Universities</a> › <a href="${esc(uniPath)}">${esc(u.name)}</a></p>
      <h1>${esc(c.name)}</h1>
      <p>${esc(u.name)} — ${esc(where)}</p>
      <p><strong>${esc(answers.summary)}</strong></p>
      <p>${esc(facts)}${fee ? ` · ${esc(fee)}` : ""}</p>
      ${intakes.length ? `<p>Intakes: ${esc(intakes.join(", "))}</p>` : ""}
      ${c.description ? `<p>${esc(c.description)}</p>` : ""}
      ${modules.length ? `<h2>Modules</h2><ul>${modules.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
      ${careers.length ? `<h2>Careers</h2><ul>${careers.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
      ${faqHtml(answers.faqs)}
    </article></main>`;
  return render({
    title: `${c.name} at ${u.name} — ${SITE_NAME}`,
    description,
    path,
    image,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Course",
        name: c.name,
        description,
        url: `${siteUrl()}${path}`,
        educationalLevel: c.level || undefined,
        about: c.subject || undefined,
        provider: { "@type": "CollegeOrUniversity", name: u.name, url: uniUrl, address: { "@type": "PostalAddress", addressLocality: u.city, addressCountry: u.country } },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl() },
          { "@type": "ListItem", position: 2, name: "Universities", item: `${siteUrl()}/universities` },
          { "@type": "ListItem", position: 3, name: u.name, item: uniUrl },
          { "@type": "ListItem", position: 4, name: c.name, item: `${siteUrl()}${path}` },
        ],
      },
      ...faqLd(answers.faqs),
    ],
    bodyHtml,
  });
}

/** Up to `n` other published posts on the same country or category, newest first. */
async function relatedPosts(post, n = 3) {
  const countries = Array.isArray(post.countries) ? post.countries.map(norm1) : [];
  const rows = await prisma.blogPost.findMany({
    where: { status: "published", id: { not: post.id } }, orderBy: { publishedAt: "desc" }, take: 60,
    select: { slug: true, title: true, category: true, countries: true },
  });
  const score = (r) => (Array.isArray(r.countries) && r.countries.some((c) => countries.includes(norm1(c))) ? 2 : 0) + (post.category && r.category === post.category ? 1 : 0);
  return rows.map((r) => ({ r, s: score(r) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.r);
}
const norm1 = (v) => String(v ?? "").trim().toLowerCase();

async function newsPostPage(slug) {
  const post = await prisma.blogPost.findFirst({ where: { slug, status: "published" } });
  if (!post) {
    // An earlier address of a post whose slug was changed: send visitors and search engines to the current one.
    const rows = await prisma.blogPost.findMany({ where: { status: "published" }, select: { slug: true, oldSlugs: true }, take: 5000 });
    const moved = rows.find((r) => Array.isArray(r.oldSlugs) && r.oldSlugs.includes(slug));
    if (moved) return { redirect: `/news/${encodeURIComponent(moved.slug)}` };
    return render({ title: `Post not found — ${SITE_NAME}`, description: "This post doesn't exist or is no longer available.", path: `/news/${slug}`, noindex: true, status: 404, bodyHtml: "<main><h1>Post not found</h1></main>" });
  }
  const base = siteUrl();
  const description = oneLine(post.excerpt || post.quickAnswer || plainText(post.content), 200);
  const url = `${base}/news/${post.slug}`;
  const image = absolute(post.coverImageUrl);
  const faqs = (Array.isArray(post.faqJson) ? post.faqJson : []).filter((f) => f && f.q && f.a);
  const sources = (Array.isArray(post.sources) ? post.sources : []).filter((x) => x && x.name && x.url);
  const countryNames = Array.isArray(post.countries) ? post.countries : [];
  const all = countryNames.length ? await countryPages.listCountries() : [];
  const countryLinks = countryNames.map((n) => all.find((c) => norm1(c.name) === norm1(n))).filter(Boolean);
  const related = await relatedPosts(post);
  const headings = [...String(post.content).matchAll(/^##\s+(.+)$/gm)].map((m) => plainText(m[1])).filter((h) => !/frequently asked|\bfaqs?\b/i.test(h));
  const edited = post.publishedAt && post.updatedAt.getTime() - post.publishedAt.getTime() > 86_400_000;
  const bodyHtml = `
    <main><article>
      <p><a href="/news">All news</a>${post.category ? ` · ${esc(post.category)}` : ""}</p>
      <h1>${esc(post.title)}</h1>
      <p>${esc(dateText(post.publishedAt))}${edited ? ` · Updated ${esc(dateText(post.updatedAt))}` : ""}</p>
      ${post.quickAnswer ? `<section><h2>Quick answer</h2><p>${esc(post.quickAnswer)}</p></section>` : post.excerpt ? `<p><strong>${esc(post.excerpt)}</strong></p>` : ""}
      ${image ? `<img src="${esc(image)}" alt="${esc(post.coverAlt || post.title)}" />` : ""}
      ${headings.length >= 4 ? `<nav aria-label="Contents"><h2>Contents</h2><ol>${headings.map((h) => `<li><a href="#${slugify(h, "section")}">${esc(h)}</a></li>`).join("")}</ol></nav>` : ""}
      ${markdownToHtml(post.content, 1, true)}
      ${countryLinks.length ? `<p>${countryLinks.map((c) => `<a href="/countries/${esc(c.slug)}">Study in ${esc(c.name)}</a>`).join(" · ")}</p>` : ""}
      ${sources.length ? `<section><h2>Sources</h2><ul>${sources.map((x) => `<li><a href="${esc(x.url)}" rel="nofollow noopener noreferrer">${esc(x.name)}</a></li>`).join("")}</ul></section>` : ""}
      ${related.length ? `<section><h2>Related news</h2><ul>${related.map((r) => `<li><a href="/news/${esc(r.slug)}">${esc(r.title)}</a></li>`).join("")}</ul></section>` : ""}
    </article></main>`;
  return render({
    title: `${post.seoTitle || post.title} — ${SITE_NAME}`,
    description,
    path: `/news/${post.slug}`,
    image: post.coverImageUrl,
    type: "article",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: clampText(post.title, 110),
        description,
        image: image ? [image] : undefined,
        datePublished: post.publishedAt?.toISOString(),
        dateModified: post.updatedAt.toISOString(),
        articleSection: post.category || undefined,
        inLanguage: "en",
        about: countryNames.length ? countryNames.map((name) => ({ "@type": "Country", name })) : undefined,
        citation: sources.length ? sources.map((x) => ({ "@type": "CreativeWork", name: x.name, url: x.url })) : undefined,
        // The organisation is the author: posts never carry a writer's name.
        author: { "@type": "Organization", name: SITE_NAME },
        publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: absolute("/brand/mark.png") } },
        mainEntityOfPage: url,
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: base },
          { "@type": "ListItem", position: 2, name: "News & Updates", item: `${base}/news` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
      ...faqLd(faqs),
    ],
    bodyHtml,
  });
}

async function rssXml() {
  const base = siteUrl();
  const posts = await publishedPosts(50);
  const x = (v) => esc(v).replace(/'/g, "&apos;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${x(SITE_NAME)} — News &amp; Updates</title>
<link>${base}/news</link>
<description>${x(DEFAULT_DESCRIPTION)}</description>
<language>en</language>
${posts.map((p) => `<item>
  <title>${x(p.title)}</title>
  <link>${base}/news/${x(p.slug)}</link>
  <guid isPermaLink="true">${base}/news/${x(p.slug)}</guid>
  ${p.publishedAt ? `<pubDate>${p.publishedAt.toUTCString()}</pubDate>` : ""}
  <description>${x(oneLine(p.quickAnswer || p.excerpt || plainText(p.content), 300))}</description>
</item>`).join("\n")}
</channel></rss>
`;
}

// ---- cache + handlers ----
const cache = new Map(); // key -> { at, page }
function invalidateSeoCache() { cache.clear(); }

async function cached(key, build) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.page;
  const page = await build();
  if (page) cache.set(key, { at: Date.now(), page });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return page;
}

function pageHandler(build) {
  return async (req, res, next) => {
    try {
      const page = await cached(req.originalUrl.split("?")[0], () => build(req));
      if (!page) return next(); // no built frontend (local dev) — let the normal handlers answer
      if (page.redirect) return res.redirect(301, page.redirect);
      res.status(page.status).set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" }).send(page.html);
    } catch (err) {
      next(err);
    }
  };
}

function robotsTxt() {
  return [
    "User-agent: *",
    "Allow: /",
    // The landing and news pages load their content from these public JSON endpoints; Googlebot has to be able to fetch
    // them to render the page. (The more specific Allow wins over the broader Disallow of /api/ below.)
    "Allow: /api/public/",
    ...["/student", "/agent", "/staff", "/admin", "/login", "/signup", "/accept-invite", "/messages", "/api/", "/uploads/documents/"].map((p) => `Disallow: ${p}`),
    "",
    `Sitemap: ${siteUrl()}/sitemap.xml`,
    "",
  ].join("\n");
}

// The sitemap is an index: one file for the fixed pages, news posts and universities, plus the courses split into files of
// COURSES_PER_SITEMAP (a sitemap file may hold at most 50,000 URLs, and courses keep being added).
const COURSES_PER_SITEMAP = 20000;
const urlsetXml = (urls) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ""}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`)
  .join("\n")}\n</urlset>\n`;

async function sitemapIndexXml() {
  const base = siteUrl();
  const idx = await catalog();
  const courseCount = idx ? idx.universities.reduce((n, u) => n + u.courses.length, 0) : await prisma.course.count();
  const files = ["sitemap-pages.xml", ...Array.from({ length: Math.ceil(courseCount / COURSES_PER_SITEMAP) }, (_v, i) => `sitemap-courses-${i + 1}.xml`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map((f) => `  <sitemap><loc>${esc(`${base}/${f}`)}</loc></sitemap>`).join("\n")}\n</sitemapindex>\n`;
}

async function sitemapPagesXml() {
  const posts = await publishedPosts(1000);
  const about = await loadAbout();
  const countries = await countryPages.listCountries();
  const rows = await prisma.university.findMany({ select: { id: true, updatedAt: true }, orderBy: { name: "asc" }, take: 40000 });
  const idx = await catalog();
  const base = siteUrl();
  return urlsetXml([
    { loc: `${base}/`, changefreq: "weekly", priority: "1.0" },
    { loc: `${base}/universities`, changefreq: "weekly", priority: "0.9" },
    { loc: `${base}/courses`, changefreq: "weekly", priority: "0.8" },
    { loc: `${base}/countries`, changefreq: "weekly", priority: "0.8" },
    ...countries.map((c) => ({ loc: `${base}/countries/${c.slug}`, changefreq: "weekly", priority: "0.8", lastmod: c.updatedAt })),
    { loc: `${base}/about`, changefreq: "monthly", priority: "0.6", lastmod: about.updatedAt || undefined },
    { loc: `${base}/news`, changefreq: "daily", priority: "0.8", lastmod: posts[0]?.updatedAt },
    ...rows.map((r) => ({ loc: `${base}${universityPath(idx?.byId.get(r.id) ?? r)}`, changefreq: "monthly", priority: "0.7", lastmod: r.updatedAt })),
    ...posts.map((p) => ({ loc: `${base}/news/${p.slug}`, changefreq: "monthly", priority: "0.6", lastmod: p.updatedAt })),
  ]);
}

/** One file of course URLs (null when n is past the last file). Courses carry no timestamp of their own, so lastmod is the
 * university's. Addresses are the readable ones; if the index can't be built it falls back to ids. */
async function sitemapCoursesXml(n) {
  const idx = await catalog();
  const modified = new Map((await prisma.university.findMany({ select: { id: true, updatedAt: true } })).map((u) => [u.id, u.updatedAt]));
  const base = siteUrl();
  let entries;
  if (idx) {
    entries = idx.universities.flatMap((u) => u.courses.map((c) => ({ path: coursePathOf(u, c), at: modified.get(u.id) })));
  } else {
    const rows = await prisma.course.findMany({ select: { id: true, universityId: true }, orderBy: { id: "asc" } });
    entries = rows.map((c) => ({ path: coursePathOf({ id: c.universityId }, c), at: modified.get(c.universityId) }));
  }
  if (!Number.isInteger(n) || n < 1 || n > Math.max(1, Math.ceil(entries.length / COURSES_PER_SITEMAP))) return null;
  return urlsetXml(entries.slice((n - 1) * COURSES_PER_SITEMAP, n * COURSES_PER_SITEMAP).map((e) => ({ loc: `${base}${e.path}`, changefreq: "monthly", priority: "0.5", lastmod: e.at })));
}

async function llmsTxt() {
  const posts = await publishedPosts(20);
  const { content: about } = await loadAbout();
  const who = companyRows(about).map(([k, v]) => `- ${k}: ${v}`);
  const base = siteUrl();
  return [
    `# ${SITE_NAME}`,
    "",
    `> ${DEFAULT_DESCRIPTION}`,
    "",
    "UnifinderAi is a study-abroad platform for students, partner education agents and counsellors.",
    "",
    "## Key facts",
    "- What it does: search partner universities and courses worldwide, compare fees, intakes and entry requirements, shortlist programs and apply with a counsellor's help.",
    "- Who it is for: international students, and the education agents and counsellors who support them.",
    "- Browsing universities, courses, entry requirements and news is free and needs no account; applying needs a free account.",
    "- Every university page and course page states its location, fees, intakes, English requirements and how to apply.",
    "",
    ...(who.length ? ["## Who we are", ...who, "- UnifinderAi (unifinderai.com) is independent and not affiliated with unifinder.ai, myunifinder.com, unifinder.org or Charlie Group.", ""] : ["## Who we are", "- UnifinderAi (unifinderai.com) is independent and not affiliated with unifinder.ai, myunifinder.com, unifinder.org or Charlie Group.", ""]),
    "## Key pages",
    `- [Home](${base}/): what UnifinderAi is and common questions`,
    `- [Universities](${base}/universities): partner universities worldwide, with courses, fees, intakes and entry requirements`,
    `- [Courses](${base}/courses): search courses at partner universities`,
    `- [Countries](${base}/countries): study destinations with fees, living costs, work rights and the universities in each`,
    `- [About](${base}/about): who UnifinderAi is, what the AI voice assistant does, and how it differs from similarly named sites`,
    `- [News & Updates](${base}/news): announcements about destinations, intakes and scholarships`,
    `- [Sitemap](${base}/sitemap.xml): every university and course page`,
    "",
    ...(posts.length ? ["## Latest news", ...posts.map((p) => `- [${p.title}](${base}/news/${p.slug})${p.quickAnswer || p.excerpt ? `: ${oneLine(p.quickAnswer || p.excerpt, 140)}` : ""}`), ""] : []),
    "## Frequently asked questions",
    ...faq.map((f) => `- **${f.q}** ${f.a}`),
    "",
  ].join("\n");
}

function textHandler(type, build, key = type) {
  return async (_req, res, next) => {
    try {
      const body = await cached(`text:${key}`, async () => ({ html: await build(), status: 200 }));
      res.status(200).set({ "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "public, max-age=600" }).send(body.html);
    } catch (err) {
      next(err);
    }
  };
}

/** Express middleware: tells crawlers not to index anything behind a login (a header, so it also covers the SPA fallback). */
function noindexPrivate(req, res, next) {
  if (PRIVATE_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
    res.set("X-Robots-Tag", "noindex, nofollow");
  }
  next();
}

function registerSeoRoutes(app) {
  app.use(noindexPrivate);
  app.get("/robots.txt", (_req, res) => res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(robotsTxt()));
  app.get("/sitemap.xml", textHandler("application/xml", sitemapIndexXml, "sitemap-index"));
  app.get("/sitemap-pages.xml", textHandler("application/xml", sitemapPagesXml, "sitemap-pages"));
  app.get("/sitemap-courses-:n.xml", async (req, res, next) => {
    try {
      const n = Number(req.params.n);
      const body = await cached(`sitemap:courses:${n}`, async () => ({ xml: await sitemapCoursesXml(n) }));
      if (!body.xml) return res.status(404).type("text/plain").send("Not found");
      res.status(200).set({ "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" }).send(body.xml);
    } catch (err) {
      next(err);
    }
  });
  app.get("/llms.txt", textHandler("text/plain", llmsTxt, "llms"));
  app.get("/rss.xml", textHandler("application/rss+xml", rssXml, "rss"));
  // IndexNow ownership proof: the key itself, served at /<key>.txt (only when INDEXNOW_KEY is set).
  app.get(/^\/([A-Za-z0-9-]{8,128})\.txt$/, (req, res, next) => {
    const key = indexNowKey();
    if (!key || req.params[0] !== key) return next();
    res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(key);
  });
  app.get("/", pageHandler(landingPage));
  app.get("/universities", pageHandler(universitiesIndexPage));
  app.get("/universities/:id", pageHandler((req) => universityPage(req.params.id)));
  app.get("/universities/:id/courses/:courseId", pageHandler((req) => coursePage(req.params.id, req.params.courseId)));
  app.get("/courses", pageHandler(coursesIndexPage));
  app.get("/countries", pageHandler(countriesIndexPage));
  app.get("/countries/:slug", pageHandler((req) => countryPage(req.params.slug)));
  app.get("/about", pageHandler(aboutPage));
  app.get("/news", pageHandler(newsIndexPage));
  app.get("/news/:slug", pageHandler((req) => newsPostPage(req.params.slug)));
}

module.exports = { registerSeoRoutes, invalidateSeoCache, siteUrl, clampText, fitTitle, universityFacts, courseFacts };
