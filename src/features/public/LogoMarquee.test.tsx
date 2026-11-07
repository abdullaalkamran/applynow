// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("./RealGlobe", () => ({ default: () => null }));
vi.mock("../../data/blogApi", () => ({ fetchPublicNews: () => Promise.resolve([]), mediaSrc: (u?: string) => u, formatPostDate: () => "" }));

import { LogoMarquee, logoInitials } from "./LandingPage";

const logos = [
  { id: "u1", slug: "bpp-university", name: "BPP University", logoUrl: "/uploads/a.webp" },
  { id: "u2", name: "University of Westminster", logoUrl: "/uploads/b.webp" },
];
const renderMarquee = () => render(<MemoryRouter><LogoMarquee logos={logos} /></MemoryRouter>);

describe("logoInitials", () => {
  it("uses the first letters of the first two words, or two letters of a single word", () => {
    expect(logoInitials("BPP University")).toBe("BU");
    expect(logoInitials("Anglia Ruskin University")).toBe("AR");
    expect(logoInitials("University of Westminster")).toBe("WE");
    expect(logoInitials("Arden")).toBe("AR");
    expect(logoInitials("")).toBe("");
  });
});

describe("partner university strip", () => {
  it("shows each university's name next to its logo", () => {
    cleanup();
    renderMarquee();
    expect(screen.getAllByText("BPP University").length).toBeGreaterThan(0);
    expect(screen.getAllByText("University of Westminster").length).toBeGreaterThan(0);
  });

  it("links each card to the university's page — by readable name when it has one, else by id", () => {
    cleanup();
    const { container } = renderMarquee();
    const hrefs = [...container.querySelectorAll(".logo-marquee-track li:not([aria-hidden]) a")].map((a) => a.getAttribute("href"));
    // (a short list is repeated to fill the strip, so the pair cycles)
    expect(hrefs.length).toBeGreaterThanOrEqual(2);
    hrefs.forEach((h, i) => expect(h).toBe(i % 2 === 0 ? "/universities/bpp-university" : "/universities/u2"));
  });

  it("repeats the set for the endless loop, but keeps the repeat out of the tab order and away from screen readers", () => {
    cleanup();
    const { container } = renderMarquee();
    const items = [...container.querySelectorAll(".logo-marquee-track li")];
    const hiddenCopies = items.filter((li) => li.getAttribute("aria-hidden") === "true");
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(hiddenCopies.length).toBe(items.length / 2);
    for (const li of hiddenCopies) expect(li.querySelector("a")?.getAttribute("tabindex")).toBe("-1");
  });

  it("shows initials behind each logo, so a slot is never empty while the image loads", () => {
    cleanup();
    const { container } = renderMarquee();
    const first = container.querySelector(".logo-chip-mark");
    expect(first?.querySelector("b")?.textContent).toBe("BU");
    expect(first?.querySelector("img")?.className).not.toContain("is-loaded");
  });

  it("reveals the logo once it has loaded", () => {
    cleanup();
    const { container } = renderMarquee();
    const img = container.querySelector(".logo-chip-mark img") as HTMLImageElement;
    fireEvent.load(img);
    expect(img.className).toContain("is-loaded");
  });

  it("falls back to the initials alone when a logo can't be loaded (no broken-image icon)", () => {
    cleanup();
    const { container } = renderMarquee();
    const mark = container.querySelector(".logo-chip-mark") as HTMLElement;
    fireEvent.error(mark.querySelector("img") as HTMLImageElement);
    expect(mark.querySelector("img")).toBeNull();
    expect(mark.querySelector("b")?.textContent).toBe("BU");
  });
});
