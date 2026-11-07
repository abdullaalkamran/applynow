import { describe, it, expect, beforeAll } from "vitest";
import { createRequire } from "node:module";

process.env.DATABASE_URL ||= "mysql://test:test@localhost:3306/test";
const require = createRequire(import.meta.url);
const prisma = require("../src/prismaClient");
const seo = require("../src/seo.js");
const courseSearch = require("../src/courseSearch.js");
const siteMeta = require("../../src/data/siteMeta.json");

const UNI = {
  id: "u1", name: "University of Leeds", city: "Leeds", state: "West Yorkshire", country: "United Kingdom",
  description: "A large research university.", highlights: ["Russell Group"], website: "leeds.ac.uk", logoUrl: "/uploads/l.png", coverPhotoUrl: null,
  fees: [{ label: "Tuition (PG)", amount: 24500 }], currencySymbol: "£", intakes: ["January", "September"], openIntake: "September 2027", minIELTS: 6.5,
  englishRequirements: { undergraduate: [{ testName: "IELTS" }], postgraduate: [{ testName: "PTE Academic" }] }, scholarshipsAvailable: true,
  scholarships: [{ name: "Vice-Chancellor's Award", amount: "Up to £5,000" }], admissionSteps: ["Apply online", "Receive offer"], qsRanking: "#75", timesHigherRanking: null,
  courses: [{ id: "c1", name: "MSc Data Science and Analytics for Business", level: "Postgraduate", duration: "1 year" }], _count: { courses: 214 },
};
const COURSE = {
  id: "c1", name: "MSc Data Science", level: "Postgraduate", duration: "1 year", subject: "Data Science", feeUSD: 24500, feeStatus: "amount", currencySymbol: null,
  description: "", studyMode: "Full-time", intakes: ["September"], modules: ["Statistics", "Machine Learning"], careers: ["Data analyst"],
  university: { id: "u1", name: "University of Leeds", city: "Leeds", country: "United Kingdom", currencySymbol: "£", logoUrl: null, coverPhotoUrl: null, website: "leeds.ac.uk", intakes: ["January"] },
};

describe("clampText / fitTitle", () => {
  it("leaves short text alone and cuts long text at a word boundary with an ellipsis", () => {
    expect(seo.clampText("Short and sweet.", 160)).toBe("Short and sweet.");
    const long = "word ".repeat(80);
    const out = seo.clampText(long, 160);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\bwor…$/);
  });
  it("prefers to end on a whole sentence when one fits", () => {
    const text = "First sentence is here and it is quite long indeed, about eighty characters or so. Second sentence runs on and on past the limit of the snippet.";
    const out = seo.clampText(text, 120);
    expect(out).toBe("First sentence is here and it is quite long indeed, about eighty characters or so.");
  });
  it("collapses whitespace and newlines", () => {
    expect(seo.clampText("a\n\n  b   c", 50)).toBe("a b c");
  });
  it("drops the site name from the end of a title that would be too long, keeps short titles whole", () => {
    expect(seo.fitTitle("Explore Courses — UnifinderAi")).toBe("Explore Courses — UnifinderAi");
    const title = seo.fitTitle("MSc Data Science and Analytics for Business at University of Leeds — UnifinderAi");
    expect(title.length).toBeLessThanOrEqual(65);
    expect(title).not.toContain("— UnifinderAi");
  });
});

describe("home page meta", () => {
  it("has a title and a description that fit a search result", () => {
    expect(siteMeta.title.length).toBeLessThanOrEqual(65);
    expect(siteMeta.description.length).toBeGreaterThanOrEqual(120);
    expect(siteMeta.description.length).toBeLessThanOrEqual(160);
  });
});

describe("universityFacts", () => {
  const f = seo.universityFacts({ ...UNI, courseCount: 214, courseNames: UNI.courses.map((c) => c.name) });
  it("writes a direct-answer summary from stored data only", () => {
    expect(f.summary).toContain("University of Leeds is a university in Leeds, West Yorkshire, United Kingdom, ranked QS #75.");
    expect(f.summary).toContain("214 courses listed, scholarships available.");
    expect(f.summary).toContain("Intakes: January and September.");
  });
  it("answers the questions people ask, with the real numbers", () => {
    const answer = (q) => f.faqs.find((x) => x.q.includes(q))?.a ?? "";
    expect(answer("Where is")).toBe("University of Leeds is in Leeds, West Yorkshire, United Kingdom.");
    expect(answer("tuition fees")).toContain("Tuition (PG) £24,500");
    expect(answer("English language score")).toContain("IELTS overall score of 6.5");
    expect(answer("English language score")).toContain("PTE Academic");
    expect(answer("intakes")).toContain("September 2027");
    expect(answer("scholarships")).toContain("Vice-Chancellor's Award (Up to £5,000)");
    expect(answer("How do I apply")).toContain("1. Apply online 2. Receive offer");
  });
  it("leaves a question out when there is nothing to answer it with — never makes data up", () => {
    const bare = seo.universityFacts({ name: "Bare Uni", city: "Town", country: "Land", courseCount: 0 });
    const qs = bare.faqs.map((x) => x.q);
    expect(qs).toEqual(["Where is Bare Uni located?", "How do I apply to Bare Uni?"]);
    expect(bare.summary).toBe("Bare Uni is a university in Town, Land.");
  });
  it("does not claim a university has no scholarships just because none are listed", () => {
    const none = seo.universityFacts({ name: "X", city: "A", country: "B", scholarshipsAvailable: false });
    expect(none.faqs.some((q) => /scholarship/i.test(q.q))).toBe(false);
  });
});

describe("courseFacts", () => {
  const f = seo.courseFacts(COURSE, COURSE.university);
  it("summarises level, subject, university, place, length, fee and start", () => {
    expect(f.summary).toBe("MSc Data Science is a postgraduate Data Science course at University of Leeds, Leeds, United Kingdom. It takes 1 year, costs £24,500 per year and starts in September.");
  });
  it("has a tight snippet for the meta description that keeps duration, fee and start", () => {
    expect(f.snippet).toBe("MSc Data Science — postgraduate Data Science course at University of Leeds, United Kingdom. 1 year, £24,500 per year, starts September.");
    expect(f.snippet.length).toBeLessThanOrEqual(160);
  });
  it("answers duration, cost, start, level, modules and careers", () => {
    expect(f.faqs.map((x) => x.q)).toEqual([
      "How long is MSc Data Science at University of Leeds?", "How much does MSc Data Science at University of Leeds cost?", "When does MSc Data Science start?",
      "What level is MSc Data Science?", "What will I study on MSc Data Science?", "What careers can MSc Data Science lead to?",
    ]);
  });
  it("falls back to the university's intakes, and skips cost when the fee isn't published", () => {
    const g = seo.courseFacts({ ...COURSE, intakes: [], feeStatus: "unknown", feeUSD: 0 }, COURSE.university);
    expect(g.summary).toContain("starts in January");
    expect(g.summary).not.toContain("costs");
    expect(g.faqs.some((x) => /cost/.test(x.q))).toBe(false);
  });
  it("reads a free course as free", () => {
    expect(seo.courseFacts({ ...COURSE, feeStatus: "free", feeUSD: 0 }, COURSE.university).summary).toContain("is free");
  });
});

// ---- the rendered pages --------------------------------------------------------------------------------------------------
const routes = {};
async function page(pattern, url, params = {}) {
  let body = "", status = 0;
  await routes[pattern]({ originalUrl: url, params }, { status(s) { status = s; return this; }, set() { return this; }, type() { return this; }, send(b) { body = String(b); } }, () => { body = "NEXT"; });
  return { status, body };
}
const metaOf = (html, re) => (html.match(re) || [])[1] || "";
const jsonLdTypes = (html) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => [].concat(JSON.parse(m[1].replace(/\\u003c/g, "<")))).map((o) => o["@type"]);

// What the search index holds for the test catalogue (slugs are assigned by the real code).
const INDEX_UNI = { id: "u1", name: "University of Leeds", city: "Leeds", country: "United Kingdom", courses: [{ id: "c1", name: "MSc Data Science", level: "Postgraduate" }] };
const INDEX = { universities: [INDEX_UNI], byId: new Map([["u1", INDEX_UNI]]), bySlug: courseSearch.assignSlugs([INDEX_UNI]) };

const stored = { row: null };
beforeAll(() => {
  courseSearch.getIndex = async () => INDEX;
  prisma.university.findMany = async () => [{ id: "u1", name: "University of Leeds", city: "Leeds", country: "United Kingdom", updatedAt: new Date() }];
  prisma.university.findUnique = async ({ where }) => (where.id === "u1" ? UNI : null);
  prisma.blogPost.findMany = async () => [];
  prisma.course.findFirst = async ({ where }) => (where.id === "c1" ? COURSE : null);
  prisma.course.count = async () => 3;
  prisma.sitePage = { findUnique: async () => stored.row, upsert: async () => null, deleteMany: async () => null };
  seo.registerSeoRoutes({ use() {}, get(p, h) { routes[p] = h; } });
});

describe("rendered pages", () => {
  const cases = [
    ["home", "/", "/"], ["universities", "/universities", "/universities"], ["courses", "/courses", "/courses"],
    ["about", "/about", "/about"],
    ["university", "/universities/:id", "/universities/university-of-leeds", { id: "university-of-leeds" }], ["course", "/universities/:id/courses/:courseId", "/universities/university-of-leeds/courses/msc-data-science", { id: "university-of-leeds", courseId: "msc-data-science" }],
  ];
  for (const [name, pattern, url, params] of cases) {
    it(`${name}: one h1, a canonical link, a title ≤65 and a description ≤160`, async () => {
      const { status, body } = await page(pattern, url, params);
      expect(status).toBe(200);
      expect(body).not.toBe("NEXT");
      expect((body.match(/<h1[ >]/g) || []).length).toBe(1);
      expect(metaOf(body, /<link rel="canonical" href="([^"]+)"/)).toMatch(new RegExp(`${url.replace(/\//g, "\\/")}$`));
      expect(metaOf(body, /<title>([\s\S]*?)<\/title>/).length).toBeLessThanOrEqual(65 + 20); // escaped entities add a few characters
      const desc = metaOf(body, /<meta name="description" content="([^"]*)"/);
      expect(desc.length).toBeGreaterThan(40);
      expect(desc.replace(/&[a-z]+;/g, "x").length).toBeLessThanOrEqual(160);
      expect(metaOf(body, /<meta property="og:description" content="([^"]*)"/)).toBe(desc);
    });
  }

  it("the home page uses the shared title and description, and offers a site-search schema", async () => {
    const { body } = await page("/", "/");
    expect(metaOf(body, /<meta name="description" content="([^"]*)"/)).toBe(siteMeta.description);
    expect(body).toContain("search_term_string");
    expect(jsonLdTypes(body)).toEqual(expect.arrayContaining(["Organization", "WebSite", "FAQPage"]));
  });

  it("university and course pages carry FAQ markup that matches the answers shown on the page", async () => {
    for (const [pattern, url, params] of [["/universities/:id", "/universities/university-of-leeds", { id: "university-of-leeds" }], ["/universities/:id/courses/:courseId", "/universities/university-of-leeds/courses/msc-data-science", { id: "university-of-leeds", courseId: "msc-data-science" }]]) {
      const { body } = await page(pattern, url, params);
      expect(jsonLdTypes(body)).toEqual(expect.arrayContaining(["FAQPage", "BreadcrumbList"]));
      const faq = JSON.parse([...body.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1].replace(/\\u003c/g, "<")).find((j) => j.includes("FAQPage")));
      for (const q of faq.mainEntity) {
        // every question and answer in the markup is also readable text on the page
        const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        expect(body).toContain(esc(q.name));
        expect(body).toContain(esc(q.acceptedAnswer.text));
      }
    }
  });

  it("the universities page lists the universities as structured data too", async () => {
    const { body } = await page("/universities", "/universities");
    expect(jsonLdTypes(body)).toEqual(expect.arrayContaining(["CollectionPage", "ItemList"]));
  });

  it("an unknown university or course is a 404 and not indexed", async () => {
    const u = await page("/universities/:id", "/universities/nope", { id: "nope" });
    const c = await page("/universities/:id/courses/:courseId", "/universities/university-of-leeds/courses/nope", { id: "university-of-leeds", courseId: "nope" });
    for (const r of [u, c]) { expect(r.status).toBe(404); expect(r.body).toContain("noindex"); }
  });
});

describe("readable addresses", () => {
  it("the university and course pages name themselves by slug in canonical, structured data and links", async () => {
    const u = await page("/universities/:id", "/universities/university-of-leeds", { id: "university-of-leeds" });
    expect(metaOf(u.body, /<link rel="canonical" href="([^"]+)"/)).toMatch(/\/universities\/university-of-leeds$/);
    expect(u.body).toContain("/universities/university-of-leeds/courses/msc-data-science");
    expect(u.body).not.toContain("/universities/u1");
    const c = await page("/universities/:id/courses/:courseId", "/universities/university-of-leeds/courses/msc-data-science", { id: "university-of-leeds", courseId: "msc-data-science" });
    expect(metaOf(c.body, /<link rel="canonical" href="([^"]+)"/)).toMatch(/\/universities\/university-of-leeds\/courses\/msc-data-science$/);
    expect(c.body).toContain("/universities/university-of-leeds");
  });

  it("an old id-style address redirects (301) to the readable one", async () => {
    const calls = [];
    const run = async (pattern, url, params) => {
      await routes[pattern]({ originalUrl: url, params }, { redirect: (code, to) => calls.push([code, to]), status() { return this; }, set() { return this; }, send() {} }, () => {});
    };
    await run("/universities/:id", "/universities/u1", { id: "u1" });
    await run("/universities/:id/courses/:courseId", "/universities/u1/courses/c1", { id: "u1", courseId: "c1" });
    await run("/universities/:id/courses/:courseId", "/universities/University-Of-Leeds/courses/c1", { id: "University-Of-Leeds", courseId: "c1" });
    expect(calls).toEqual([
      [301, "/universities/university-of-leeds"],
      [301, "/universities/university-of-leeds/courses/msc-data-science"],
      [301, "/universities/university-of-leeds/courses/msc-data-science"],
    ]);
  });

  it("the sitemaps list the readable addresses", async () => {
    const pages = await page("/sitemap-pages.xml", "/sitemap-pages.xml");
    expect(pages.body).toContain("/universities/university-of-leeds<");
    expect(pages.body).not.toContain("/universities/u1<");
    const courses = await page("/sitemap-courses-:n.xml", "/sitemap-courses-1.xml", { n: "1" });
    expect(courses.body).toContain("/universities/university-of-leeds/courses/msc-data-science<");
  });
});

describe("About page", () => {
  const about = require("../src/aboutPage.js");
  const text = (body) => body.replace(/<script[\s\S]*?<\/script>/g, "");

  it("shows the built-in text, with the AI assistant, FAQ and independence notice, and no empty details", async () => {
    const { body } = await page("/about", "/about");
    expect(body).toContain("<h1>About UnifinderAi</h1>");
    expect(body).toContain("AI voice assistant");
    expect(body).toContain("not affiliated");
    expect(text(body)).not.toContain("Registered company"); // no company details filled in -> none shown
    expect(text(body)).toContain("instagram.com/unifinderai.official");
    expect(text(body)).not.toMatch(/\[[A-Z ]+\]/); // no leftover [PLACEHOLDER]
    const ld = JSON.parse(body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, "<"));
    expect(ld["@graph"].map((o) => o["@type"])).toEqual(["AboutPage", "EducationalOrganization", "FAQPage"]);
  });

  it("uses what the data manager saved, and publishes only the details that were filled in", async () => {
    stored.row = { data: JSON.stringify(about.normalize({ heading: "About us", body: "## Hello\n\nSee [courses](/courses) and [evil](javascript:alert(1)).", company: { legalName: "Acme Ltd", email: "hi@acme.test" }, social: { facebook: "https://facebook.com/acme" }, faqs: [{ q: "Q?", a: "A." }, { q: "", a: "dropped" }] })) , updatedAt: new Date("2026-11-08"), updatedBy: "x" };
    seo.invalidateSeoCache();
    const { body } = await page("/about", "/about");
    expect(body).toContain("<h1>About us</h1>");
    expect(body).toContain('<h2>Hello</h2>');
    expect(body).toContain('<a href="/courses">courses</a>');
    expect(body).not.toMatch(/href="javascript/i);
    expect(body).toContain("Acme Ltd");
    expect(body).not.toContain("Founded");
    expect(body).toContain("facebook.com/acme");
    expect(body).toContain('"legalName":"Acme Ltd"');
    expect(body).toContain('"sameAs":["https://facebook.com/acme"]');
    expect((body.match(/Q\?/g) || []).length).toBeGreaterThan(0);
    expect(body).not.toContain("dropped");
    const llms = await page("/llms.txt", "/llms.txt");
    expect(llms.body).toContain("Registered company: Acme Ltd");
    stored.row = null;
    seo.invalidateSeoCache();
  });

  it("is in the sitemap and in llms.txt", async () => {
    const pages = await page("/sitemap-pages.xml", "/sitemap-pages.xml");
    expect(pages.body).toMatch(/<loc>[^<]*\/about<\/loc>/);
    expect((await page("/llms.txt", "/llms.txt")).body).toContain("/about)");
  });

  it("rejects bad input on save but never breaks reading", () => {
    expect(() => about.normalize({ heading: "" }, { strict: true })).toThrow(/heading/);
    expect(() => about.normalize({ social: { instagram: "javascript:alert(1)" } }, { strict: true })).toThrow(/https/);
    expect(() => about.normalize({ company: { email: "nope" } }, { strict: true })).toThrow(/email/);
    expect(() => about.normalize({ body: "x".repeat(70000) }, { strict: true })).toThrow(/too long/);
    expect(about.normalize({ social: { instagram: "javascript:alert(1)" } }).social.instagram).toBe("");
    expect(about.normalize(null).heading).toBe("About UnifinderAi");
  });

  it("a damaged saved row falls back to the built-in text", async () => {
    stored.row = { data: "{not json", updatedAt: new Date(), updatedBy: null };
    const loaded = await about.loadAbout();
    expect(loaded.isDefault).toBe(true);
    expect(loaded.content.heading).toBe("About UnifinderAi");
    stored.row = null;
  });
});
