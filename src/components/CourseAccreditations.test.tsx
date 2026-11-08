// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CourseAccreditations, normalizeAccreditations } from "./CourseAccreditations";
import { SectionBoundary } from "./SectionBoundary";

afterEach(cleanup);

describe("CourseAccreditations", () => {
  it("renders plain-string accreditations (what the API returns) instead of crashing", () => {
    render(<CourseAccreditations accreditations={["Institution of Engineering", "IET"]} />);
    expect(screen.getByText("Accredited by")).toBeTruthy();
    expect(screen.getByText("Institution of Engineering")).toBeTruthy();
    expect(screen.getByText("IET")).toBeTruthy();
    expect(screen.getByText("IN")).toBeTruthy(); // initials chip
  });

  it("renders object accreditations, with a logo when there is one", () => {
    render(<CourseAccreditations accreditations={[{ name: "AACSB", logoUrl: "https://x.test/a.png" }, { name: "CMI" }]} />);
    expect(screen.getByAltText("AACSB logo")).toBeTruthy();
    expect(screen.getByText("CMI")).toBeTruthy();
  });

  it("handles a mix of both", () => {
    render(<CourseAccreditations accreditations={["IET", { name: "CMI", logoUrl: "https://x.test/c.png" }]} />);
    expect(screen.getByText("IET")).toBeTruthy();
    expect(screen.getByAltText("CMI logo")).toBeTruthy();
  });

  it.each([[[]], [null], [undefined], ["IET"], [{}], [[{ name: "" }, "  ", null, undefined, 5, {}]]])("renders nothing for %j", (value) => {
    const { container } = render(<CourseAccreditations accreditations={value} />);
    expect(container.innerHTML).toBe("");
  });

  it("skips empty names and repeats, and trims", () => {
    expect(normalizeAccreditations(["  IET ", "iet", "", { name: " CMI ", logoUrl: " " }, { name: "" }])).toEqual([{ name: "IET" }, { name: "CMI" }]);
  });
});

describe("SectionBoundary", () => {
  it("hides only the section that throws", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const Bad = () => { throw new Error("boom"); };
    render(<div><SectionBoundary name="x"><Bad /></SectionBoundary><p>rest of page</p></div>);
    expect(screen.getByText("rest of page")).toBeTruthy();
    err.mockRestore();
  });
});
