// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const store = vi.hoisted(() => ({
  universities: [] as unknown[],
  error: "",
}));
vi.mock("../../../data/universityCatalogStore", () => ({
  getAllUniversities: () => store.universities,
  getUniversitiesLoadError: () => store.error,
  retryUniversities: () => Promise.resolve(),
  courseCountOf: (u: { courses?: unknown[]; coursesLoaded?: boolean; courseCount?: number }) => (u.coursesLoaded === false ? u.courseCount ?? 0 : (u.courses ?? []).length),
}));
vi.mock("../../../data/countryRegistry", () => ({
  getAllCountries: () => [{ id: "c1", name: "Norway" }],
  getCountryByName: () => undefined,
  getCountryId: (n: string) => n,
  deleteCountry: () => {},
}));

import DataCountries from "./Countries";

const renderPage = () => render(<MemoryRouter><DataCountries /></MemoryRouter>);
beforeEach(() => { cleanup(); store.universities = []; store.error = ""; });

describe("Data Management → Countries", () => {
  it("shows the real course counts from the summary while the courses themselves haven't loaded yet — not 0", () => {
    store.universities = [
      { id: "u1", name: "A", country: "UK", courses: [], coursesLoaded: false, courseCount: 120 },
      { id: "u2", name: "B", country: "UK", courses: [], coursesLoaded: false, courseCount: 30 },
      { id: "u3", name: "C", country: "Canada", courses: [], coursesLoaded: false, courseCount: 7 },
    ];
    renderPage();
    expect(screen.getByText("157")).toBeTruthy(); // total courses tile
    expect(screen.getByText(/150 courses/)).toBeTruthy(); // UK card
    expect(screen.getByText(/7 courses/)).toBeTruthy(); // Canada card
  });

  it("counts a fully loaded university from its own course list", () => {
    store.universities = [{ id: "u1", name: "A", country: "UK", courses: [{ id: "a" }, { id: "b" }] }];
    renderPage();
    expect(screen.getByText(/2 courses/)).toBeTruthy();
  });

  it("does not crash when the catalog failed to load — it says so and offers a retry, and still lists the registered countries", () => {
    store.error = "The server sent an unexpected response — please try again in a moment.";
    renderPage();
    expect(screen.getByRole("alert").textContent).toMatch(/couldn't load the universities/i);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getAllByText("Norway").length).toBeGreaterThan(0);
  });

  it("shows no notice when everything loaded", () => {
    store.universities = [{ id: "u1", name: "A", country: "UK", courses: [], coursesLoaded: false, courseCount: 1 }];
    renderPage();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
