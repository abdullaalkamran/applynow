import { describe, it, expect } from "vitest";
import { seoChecks, countFaqQuestions, type SeoFields } from "./blogSeoChecks";

const good: SeoFields = {
  title: "Canada study permit cap 2027", seoTitle: "", excerpt: "x".repeat(130), quickAnswer: "Canada caps new study permits for 2027, so apply early and plan ahead.",
  content: "word ".repeat(650) + "\n\n## Frequently asked questions\n\n### One?\n\nYes.\n\n### Two?\n\nYes.\n\n### Three?\n\nYes.",
  coverImageUrl: "/uploads/c.png", coverAlt: "Campus", countries: ["Canada"], sources: [{ name: "IRCC", url: "https://x.test" }], slug: "canada-study-permit-cap-2027",
};
const failing = (f: SeoFields) => seoChecks(f).filter((c) => !c.ok);

describe("News editor checklist", () => {
  it("passes a complete post", () => expect(failing(good)).toEqual([]));
  it("a cover without a description is the only blocking error", () => {
    const bad = failing({ ...good, coverAlt: "" });
    expect(bad).toHaveLength(1);
    expect(bad[0].level).toBe("error");
    expect(failing({ ...good, coverImageUrl: "", coverAlt: "" })).toEqual([]); // no cover, nothing to describe
  });
  it("everything else is advice only", () => {
    const bad = failing({ ...good, seoTitle: "t".repeat(80), excerpt: "short", quickAnswer: "", content: "tiny", countries: [], sources: [], slug: "a-b-e4f155" });
    expect(bad.length).toBeGreaterThanOrEqual(7);
    expect(bad.every((c) => c.level === "warn")).toBe(true);
  });
  it("flags brand spelling and look-alike names", () => {
    expect(failing({ ...good, content: good.content + " UnifinderAI is great" }).map((c) => c.msg).join()).toContain("UnifinderAi");
    expect(failing({ ...good, content: good.content + " see myunifinder.com" }).map((c) => c.msg).join()).toContain("look-alike");
    expect(failing({ ...good, content: good.content + " UnifinderAi is fine" })).toEqual([]);
  });
  it("counts FAQ questions like the server does", () => {
    expect(countFaqQuestions("## FAQ\n\n**A?**\n\nyes\n\n### B?\n\nyes\n\n### C?\n")).toBe(2);
    expect(countFaqQuestions("no faq")).toBe(0);
  });
});
