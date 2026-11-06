import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

process.env.DATABASE_URL ||= "mysql://test:test@localhost:3306/test";
const require = createRequire(import.meta.url);
const { makeCatalog } = require("./fixtures.js");
const server = require("../src/courseSearch.js");

const catalog = makeCatalog(7, 60);
const index = { universities: catalog.map((u) => ({ ...server.slimUniversity(u), courses: u.courses.map((c) => server.slimCourse(c)) })) };
const allCourses = catalog.flatMap((u) => u.courses.map((c) => ({ u, c })));
const run = (params) => server.runSearch(index, params);

describe("course search: pagination", () => {
  it("defaults to 20 per page and reports the total", () => {
    const r = run({});
    expect(r.limit).toBe(20);
    expect(r.page).toBe(1);
    expect(r.total).toBe(allCourses.length);
    expect(r.items).toHaveLength(20);
  });

  it("pages are consecutive, non-overlapping and cover everything", () => {
    const first = run({ limit: 25, page: 1 });
    const seen = [];
    for (let p = 1; p <= Math.ceil(first.total / 25); p++) seen.push(...run({ limit: 25, page: p }).items.map((i) => `${i.university.id}/${i.course.id}`));
    expect(seen).toHaveLength(first.total);
    expect(new Set(seen).size).toBe(first.total);
  });

  it("caps the page size at 100 and never returns less than 1", () => {
    expect(run({ limit: 5000 }).limit).toBe(100);
    expect(run({ limit: 5000 }).items.length).toBeLessThanOrEqual(100);
    expect(run({ limit: 0 }).limit).toBe(1);
    expect(run({ limit: "abc" }).limit).toBe(20);
  });

  it("an out-of-range page falls back to the nearest real page", () => {
    const r = run({ limit: 20, page: 9999 });
    expect(r.page).toBe(Math.ceil(r.total / 20));
    expect(r.items.length).toBeGreaterThan(0);
    expect(run({ page: -3 }).page).toBe(1);
  });
});

describe("course search: filters", () => {
  it("returns an empty page, not an error, when nothing matches", () => {
    const r = run({ q: "zzzzzz-no-such-course" });
    expect(r).toMatchObject({ items: [], total: 0, page: 1 });
  });

  it("narrows by level", () => {
    const r = run({ filters: { level: ["Postgraduate"] }, limit: 100 });
    expect(r.total).toBe(allCourses.filter(({ c }) => c.level === "Postgraduate" || (c.programLevel ?? []).includes("Postgraduate")).length);
    expect(r.items.every((i) => i.course.level === "Postgraduate")).toBe(true);
  });

  it("narrows by country and free text together", () => {
    const r = run({ q: "advanced", filters: { destination: ["Canada"] }, limit: 100 });
    expect(r.items.every((i) => i.university.country === "Canada")).toBe(true);
    expect(r.items.every((i) => /advanced/i.test(i.course.name) || /advanced/i.test(i.university.name))).toBe(true);
  });

  it("the university view returns one card per university, without courses", () => {
    const r = run({ view: "universities", limit: 100 });
    expect(r.total).toBe(catalog.filter((u) => u.courses.length > 0).length + catalog.filter((u) => u.courses.length === 0).length);
    expect(r.items[0]).not.toHaveProperty("courses");
    expect(r.items[0]).toHaveProperty("name");
  });

  it("returns only card-sized fields, never descriptions or requirement lists", () => {
    const { item } = { item: run({}).items[0] };
    expect(Object.keys(item.course).sort()).toEqual(["currencySymbol", "duration", "feeStatus", "feeUSD", "id", "intakes", "level", "name", "studyMode", "subject"].sort());
    expect(item.university).not.toHaveProperty("courses");
    expect(JSON.stringify(item).length).toBeLessThan(1500);
  });

  it("restricts to the browser-held shortlist when given its keys", () => {
    const pick = allCourses.slice(3, 6).map(({ u, c }) => `${u.id}::${c.name}`);
    const r = run({ shortlistKeys: pick, limit: 100 });
    expect(r.total).toBe(3);
    expect(run({ shortlistKeys: [] }).total).toBe(0);
  });
});

describe("course search: sorting", () => {
  it("sorts by name A-Z", () => {
    const names = run({ sort: "name", limit: 100 }).items.map((i) => i.course.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("sorts by fee low to high in the chosen currency, putting uncomparable fees last", () => {
    const r = run({ sort: "feeLow", sortCurrency: "£", limit: 100, filters: {} });
    const fees = r.items.map((i) => (i.course.feeStatus === "amount" && (i.course.currencySymbol || i.university.currencySymbol).trim() === "£" ? i.course.feeUSD : null));
    const real = fees.filter((f) => f !== null);
    expect(real).toEqual([...real].sort((a, b) => a - b));
    const firstNull = fees.indexOf(null);
    if (firstNull !== -1) expect(fees.slice(firstNull).every((f) => f === null)).toBe(true);
  });

  it("an unknown sort falls back to catalog order", () => {
    expect(run({ sort: "bogus", limit: 10 }).items.map((i) => i.course.id)).toEqual(run({ sort: "best", limit: 10 }).items.map((i) => i.course.id));
  });

  it("is deterministic: the same request twice returns the same page", () => {
    expect(run({ sort: "rank", page: 2 })).toEqual(run({ sort: "rank", page: 2 }));
  });
});
