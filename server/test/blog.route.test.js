import { describe, it, expect, beforeAll } from "vitest";
import { createRequire } from "node:module";
import http from "node:http";

process.env.DATABASE_URL ||= "mysql://test:test@localhost:3306/test";
const require = createRequire(import.meta.url);

// Auth is not what is under test: let every request through as a data manager.
const pass = (req, _res, next) => { req.authUser = { name: "Data Manager", roleUserId: "d1", role: "data" }; next(); };
for (const rel of ["../src/middleware/requireAuth.js"]) { const id = require.resolve(rel); require.cache[id] = { id, filename: id, loaded: true, exports: pass }; }
const accessId = require.resolve("../src/middleware/access.js");
require(accessId);
require.cache[accessId].exports.requireDataRole = pass;

const prisma = require("../src/prismaClient");
const express = require("express");

let rows = [];
let n = 0;
beforeAll(() => {
  prisma.blogPost = {
    findMany: async () => rows.map((r) => ({ ...r })),
    findUnique: async ({ where }) => rows.find((r) => r.id === where.id) ?? null,
    create: async ({ data }) => { const r = { id: `p${++n}`, viewCount: 0, createdAt: new Date(), updatedAt: new Date(), publishedAt: null, oldSlugs: null, ...data }; rows.push(r); return r; },
    update: async ({ where, data }) => { const r = rows.find((x) => x.id === where.id); Object.assign(r, data, { updatedAt: new Date() }); return r; },
    delete: async ({ where }) => { rows = rows.filter((r) => r.id !== where.id); },
  };
});

async function call(method, path, body) {
  const app = express();
  app.use(express.json());
  app.use("/api/blog", require("../src/routes/blog.js"));
  const server = http.createServer(app).listen(0);
  try {
    const res = await fetch(`http://localhost:${server.address().port}/api/blog${path}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  } finally { server.close(); }
}

const BODY = { title: "Canada Study Permit Cap 2027: What the New Plan Means", content: "## Frequently asked questions\n\n### Is there a cap?\n\nYes.", excerpt: "x" };

describe("News save: slug, history and SEO fields", () => {
  it("a new post gets a clean address (no random code), the FAQ and the SEO fields", async () => {
    const { status, json } = await call("POST", "", { ...BODY, status: "published", seoTitle: " Canada cap ", countries: ["Canada", "Canada"], sources: [{ name: "IRCC", url: "https://www.canada.ca" }, { name: "", url: "" }], category: "Visa news" });
    expect(status).toBe(201);
    expect(json.slug).toBe("canada-study-permit-cap-2027-new-plan-means");
    expect(json.faqCount).toBe(1);
    expect(json.seoTitle).toBe("Canada cap");
    expect(json.countries).toEqual(["Canada"]);
    expect(json.sources).toEqual([{ name: "IRCC", url: "https://www.canada.ca" }]);
    expect(json).not.toHaveProperty("authorId");
  });

  it("the same title again gets a number, not a code", async () => {
    const { json } = await call("POST", "", BODY);
    expect(json.slug).toBe("canada-study-permit-cap-2027-new-plan-means-2");
  });

  it("changing the address keeps the old one for redirects; taking another post's address (or an old one) is refused", async () => {
    const first = rows[0];
    const ok = await call("PATCH", `/${first.id}`, { slug: "canada-cap" });
    expect(ok.status).toBe(200);
    expect(ok.json.slug).toBe("canada-cap");
    expect(rows[0].oldSlugs).toEqual(["canada-study-permit-cap-2027-new-plan-means"]);
    expect((await call("PATCH", `/${rows[1].id}`, { slug: "canada-cap" })).status).toBe(400);
    expect((await call("PATCH", `/${rows[1].id}`, { slug: "canada-study-permit-cap-2027-new-plan-means" })).status).toBe(400);
    // the same address sent again is not a change
    expect((await call("PATCH", `/${first.id}`, { slug: "canada-cap", title: "Canada Study Permit Cap 2027: What the New Plan Means" })).status).toBe(200);
    expect(rows[0].oldSlugs).toHaveLength(1);
  });

  it("editing the text refreshes the FAQ; a status-only change leaves everything else alone", async () => {
    const id = rows[0].id;
    await call("PATCH", `/${id}`, { content: "No questions now." });
    expect(rows[0].faqJson).toEqual([]);
    const keep = rows[0].content;
    expect((await call("PATCH", `/${id}`, { status: "draft" })).status).toBe(200);
    expect(rows[0].content).toBe(keep);
  });

  it("rejects bad input", async () => {
    for (const bad of [
      { slug: "Bad Slug!" }, { sources: [{ name: "x", url: "javascript:alert(1)" }] }, { sources: [{ name: "", url: "https://x.test" }] },
      { countries: "Canada" }, { quickAnswer: "x".repeat(601) }, { seoTitle: "x".repeat(71) },
    ]) expect((await call("POST", "", { ...BODY, ...bad })).status).toBe(400);
  });
});
