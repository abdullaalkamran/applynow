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

const SITE_NAME = "UnifinderAi";
const DEFAULT_TITLE = "UnifinderAi — Find your next university";
const DEFAULT_DESCRIPTION =
  "Find universities and courses worldwide, compare fees and entry requirements, and apply with the help of counsellors and an AI assistant. Track your documents and application from offer to enrolment.";
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
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
}
function markdownToHtml(md) {
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
      const level = Math.min(4, Math.max(2, m[1].length + 1)); // the page's own <h1> is the post title
      out.push(`<h${level}>${inlineMd(m[2])}</h${level}>`);
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

/** Plain-text summary of a post, for its description when the author left the summary empty. */
function plainText(md) {
  return String(md || "").replace(/[#*`>_-]+/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
}

// ---- page rendering ----
function jsonLdScript(objects) {
  // "<" is escaped so a stray "</script>" in any text can never end the tag early.
  return objects.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("\n    ");
}

function render({ title, description, path: pagePath, image, type = "website", jsonLd = [], bodyHtml = "", noindex = false, status = 200 }) {
  const html = readTemplate();
  if (!html) return null;
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

const orgJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: siteUrl(),
  logo: absolute("/brand/share.png"),
  description: DEFAULT_DESCRIPTION,
});

const siteJsonLd = () => ({ "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: siteUrl(), description: DEFAULT_DESCRIPTION });

async function publishedPosts(take = 60) {
  return prisma.blogPost.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take,
    select: { slug: true, title: true, excerpt: true, content: true, coverImageUrl: true, authorName: true, publishedAt: true, updatedAt: true },
  });
}

const dateText = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

async function landingPage() {
  const posts = await publishedPosts(3);
  const newsHtml = posts.length
    ? `<section><h2>News &amp; Updates</h2><ul>${posts.map((p) => `<li><a href="/news/${esc(p.slug)}">${esc(p.title)}</a>${p.excerpt ? ` — ${esc(p.excerpt)}` : ""}</li>`).join("")}</ul><p><a href="/news">All news</a></p></section>`
    : "";
  const bodyHtml = `
    <main>
      <h1>Find your next university</h1>
      <p>${esc(DEFAULT_DESCRIPTION)}</p>
      <p><a href="/login">Sign in</a> · <a href="/signup">Create an account</a> · <a href="/news">News &amp; Updates</a></p>
      <section><h2>Frequently asked questions</h2>
        ${faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("\n        ")}
      </section>
      ${newsHtml}
    </main>`;
  return render({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, path: "/", jsonLd: [orgJsonLd(), siteJsonLd(), faqJsonLd()], bodyHtml });
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

async function newsPostPage(slug) {
  const post = await prisma.blogPost.findFirst({ where: { slug, status: "published" } });
  if (!post) {
    return render({ title: `Post not found — ${SITE_NAME}`, description: "This post doesn't exist or is no longer available.", path: `/news/${slug}`, noindex: true, status: 404, bodyHtml: "<main><h1>Post not found</h1></main>" });
  }
  const description = oneLine(post.excerpt || plainText(post.content), 200);
  const url = `${siteUrl()}/news/${post.slug}`;
  const image = absolute(post.coverImageUrl);
  const bodyHtml = `
    <main><article>
      <p><a href="/news">All news</a></p>
      <h1>${esc(post.title)}</h1>
      <p>${esc(dateText(post.publishedAt))} · ${esc(post.authorName)}</p>
      ${post.excerpt ? `<p><strong>${esc(post.excerpt)}</strong></p>` : ""}
      ${image ? `<img src="${esc(image)}" alt="${esc(post.title)}" />` : ""}
      ${markdownToHtml(post.content)}
    </article></main>`;
  return render({
    title: `${post.title} — ${SITE_NAME}`,
    description,
    path: `/news/${post.slug}`,
    image: post.coverImageUrl,
    type: "article",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description,
        image: image ? [image] : undefined,
        datePublished: post.publishedAt?.toISOString(),
        dateModified: post.updatedAt.toISOString(),
        author: { "@type": "Organization", name: SITE_NAME },
        publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: absolute("/brand/mark.png") } },
        mainEntityOfPage: url,
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl() },
          { "@type": "ListItem", position: 2, name: "News & Updates", item: `${siteUrl()}/news` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
    bodyHtml,
  });
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

async function sitemapXml() {
  const posts = await publishedPosts(1000);
  const base = siteUrl();
  const urls = [
    { loc: `${base}/`, changefreq: "weekly", priority: "1.0" },
    { loc: `${base}/news`, changefreq: "daily", priority: "0.8", lastmod: posts[0]?.updatedAt },
    ...posts.map((p) => ({ loc: `${base}/news/${p.slug}`, changefreq: "monthly", priority: "0.6", lastmod: p.updatedAt })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ""}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`)
    .join("\n")}\n</urlset>\n`;
}

async function llmsTxt() {
  const posts = await publishedPosts(20);
  const base = siteUrl();
  return [
    `# ${SITE_NAME}`,
    "",
    `> ${DEFAULT_DESCRIPTION}`,
    "",
    "UnifinderAi is a study-abroad platform for students, partner education agents and counsellors.",
    "",
    "## Key pages",
    `- [Home](${base}/): what UnifinderAi is and common questions`,
    `- [News & Updates](${base}/news): announcements about destinations, intakes and scholarships`,
    "",
    ...(posts.length ? ["## Latest news", ...posts.map((p) => `- [${p.title}](${base}/news/${p.slug})${p.excerpt ? `: ${oneLine(p.excerpt, 140)}` : ""}`), ""] : []),
    "## Frequently asked questions",
    ...faq.map((f) => `- **${f.q}** ${f.a}`),
    "",
  ].join("\n");
}

function textHandler(type, build) {
  return async (_req, res, next) => {
    try {
      const body = await cached(`text:${type}`, async () => ({ html: await build(), status: 200 }));
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
  app.get("/sitemap.xml", textHandler("application/xml", sitemapXml));
  app.get("/llms.txt", textHandler("text/plain", llmsTxt));
  app.get("/", pageHandler(landingPage));
  app.get("/news", pageHandler(newsIndexPage));
  app.get("/news/:slug", pageHandler((req) => newsPostPage(req.params.slug)));
}

module.exports = { registerSeoRoutes, invalidateSeoCache };
