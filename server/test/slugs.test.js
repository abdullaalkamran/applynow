import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

process.env.DATABASE_URL ||= "mysql://test:test@localhost:3306/test";
const require = createRequire(import.meta.url);
const { slugify, slugClaimer } = require("../src/slugs.js");
const cs = require("../src/courseSearch.js");

describe("slugify", () => {
  it("makes readable lower-case addresses from names", () => {
    expect(slugify("University of Leeds")).toBe("university-of-leeds");
    expect(slugify("BPP University")).toBe("bpp-university");
    expect(slugify("MSc Management with Data Analytics and AI")).toBe("msc-management-with-data-analytics-and-ai");
  });
  it("folds accents, spells out &, and drops punctuation and emoji", () => {
    expect(slugify("Zürich & Co. — École")).toBe("zurich-and-co-ecole");
    expect(slugify("  MBA (Executive)!! ")).toBe("mba-executive");
  });
  it("never returns an empty slug", () => {
    expect(slugify("")).toBe("item");
    expect(slugify("🎓")).toBe("item");
    expect(slugify("???", "university")).toBe("university");
  });
  it("keeps long names to a sensible length, cut at a word", () => {
    const s = slugify("Master of Science in International Business Management and Entrepreneurship with Professional Placement Year");
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
    expect(s.startsWith("master-of-science-in-international-business")).toBe(true);
  });
});

describe("slugClaimer", () => {
  it("gives the first name the plain slug, then adds the place, then a number", () => {
    const claim = slugClaimer();
    expect(claim("bpp-university", "London")).toBe("bpp-university");
    expect(claim("bpp-university", "London")).toBe("bpp-university-london");
    expect(claim("bpp-university", "Leeds")).toBe("bpp-university-leeds");
    expect(claim("bpp-university", "London")).toBe("bpp-university-london-2");
  });
});

// A tiny catalogue to run the real slug assignment and the lookups the pages use.
function catalogue() {
  const mk = (id, name, city, courses) => ({ id, name, city, courses: courses.map(([cid, cname, level]) => ({ id: cid, name: cname, level })) });
  const universities = [
    mk("u-custom-1", "BPP University", "London", [["crs-1", "MSc Data Science", "Postgraduate"], ["crs-2", "MSc Data Science", "Postgraduate"], ["crs-3", "MSc Data Science", "Undergraduate"]]),
    mk("u-custom-2", "BPP University", "Leeds", [["crs-9", "MBA", "Postgraduate"]]),
    mk("u-custom-3", "University of Leeds", "Leeds", []),
  ];
  const byId = new Map(universities.map((u) => [u.id, u]));
  return { universities, byId, bySlug: cs.assignSlugs(universities) };
}

describe("catalogue slugs and lookups", () => {
  const idx = catalogue();
  const [bppLondon, bppLeeds, leeds] = idx.universities;

  it("gives every university its own readable slug, even with the same name", () => {
    expect(bppLondon.slug).toBe("bpp-university");
    expect(bppLeeds.slug).toBe("bpp-university-leeds");
    expect(leeds.slug).toBe("university-of-leeds");
    expect(new Set(idx.universities.map((u) => u.slug)).size).toBe(3);
  });
  it("gives courses with the same name distinct slugs within their university", () => {
    expect(bppLondon.courses.map((c) => c.slug)).toEqual(["msc-data-science", "msc-data-science-postgraduate", "msc-data-science-undergraduate"]);
  });
  it("finds a university by slug, or by the old id, or in any letter case", () => {
    expect(cs.resolveUniversity(idx, "bpp-university-leeds")).toBe(bppLeeds);
    expect(cs.resolveUniversity(idx, "u-custom-2")).toBe(bppLeeds);
    expect(cs.resolveUniversity(idx, "BPP-University")).toBe(bppLondon);
    expect(cs.resolveUniversity(idx, "nope")).toBeNull();
  });
  it("finds a course by slug or by the old id, only within its own university", () => {
    expect(cs.resolveCourse(bppLondon, "msc-data-science-postgraduate").id).toBe("crs-2");
    expect(cs.resolveCourse(bppLondon, "crs-3").slug).toBe("msc-data-science-undergraduate");
    expect(cs.resolveCourse(bppLeeds, "crs-1")).toBeNull();
    expect(cs.resolveCourse(bppLeeds, "mba").id).toBe("crs-9");
  });
  it("a university added later with a taken name never changes an existing address", () => {
    const more = catalogue();
    more.universities.push({ id: "u-custom-4", name: "BPP University", city: "London", courses: [] });
    cs.assignSlugs(more.universities);
    expect(more.universities[0].slug).toBe("bpp-university");
    expect(more.universities[3].slug).toBe("bpp-university-london");
  });
});
