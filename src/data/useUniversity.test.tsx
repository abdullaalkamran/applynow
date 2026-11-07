// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  cache: [] as { id: string; slug?: string; name: string; coursesLoaded?: boolean }[],
  apiGet: vi.fn(),
  publicGet: vi.fn(),
  pub: false,
  hydrate: vi.fn(),
}));
vi.mock("./universityCatalogStore", () => ({
  peekUniversityById: (key: string) => mocks.cache.find((u) => u.id === key || u.slug === key),
  hydrateUniversity: (id: string) => { mocks.hydrate(id); return Promise.resolve(); },
}));
vi.mock("../utils/apiClient", () => ({ apiGet: mocks.apiGet }));
vi.mock("./blogApi", () => ({ publicGet: mocks.publicGet }));
vi.mock("./publicMode", () => ({ usePublicMode: () => mocks.pub }));

import { useUniversity } from "./useUniversity";

const BPP = { id: "u-custom-1", slug: "bpp-university", name: "BPP University" };

function Probe({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return <><div data-testid="path">{loc.pathname}</div><div data-testid="state">{JSON.stringify(loc.state)}</div>{children}</>;
}
function setup(path: string, state?: unknown) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="/student/universities/:id" element={<Probe>{children}</Probe>} />
        <Route path="/student/universities/:id/campuses" element={<Probe>{children}</Probe>} />
      </Routes>
    </MemoryRouter>
  );
  const idFrom = path.split("/")[3];
  return { ...renderHook(() => useUniversity(idFrom), { wrapper }), path: () => document.querySelector('[data-testid="path"]')?.textContent, state: () => document.querySelector('[data-testid="state"]')?.textContent };
}

beforeEach(() => {
  cleanup();
  mocks.cache = [];
  mocks.pub = false;
  mocks.apiGet.mockReset(); mocks.publicGet.mockReset(); mocks.hydrate.mockReset();
});

describe("useUniversity: readable addresses on the signed-in pages", () => {
  it("swaps an id-style address for the readable one once the name is known (cached university), keeping the page state", async () => {
    mocks.cache = [BPP];
    const t = setup("/student/universities/u-custom-1", { selectedCourseName: "MSc Data Science" });
    await waitFor(() => expect(t.path()).toBe("/student/universities/bpp-university"));
    expect(JSON.parse(t.state() ?? "null")).toEqual({ selectedCourseName: "MSc Data Science" });
    expect(t.result.current.university?.name).toBe("BPP University");
  });

  it("does the same when the university has to be fetched, and doesn't fetch it a second time after the swap", async () => {
    mocks.apiGet.mockResolvedValue({ ...BPP, courses: [] });
    const t = setup("/student/universities/u-custom-1");
    await waitFor(() => expect(t.path()).toBe("/student/universities/bpp-university"));
    await waitFor(() => expect(t.result.current.university?.slug).toBe("bpp-university"));
    expect(mocks.apiGet).toHaveBeenCalledTimes(1);
    expect(mocks.apiGet).toHaveBeenCalledWith("/api/universities/u-custom-1");
  });

  it("a readable address is left alone, and finds the university in the cache by its slug", async () => {
    mocks.cache = [BPP];
    const t = setup("/student/universities/bpp-university");
    await waitFor(() => expect(t.result.current.university?.name).toBe("BPP University"));
    expect(t.path()).toBe("/student/universities/bpp-university");
    expect(mocks.apiGet).not.toHaveBeenCalled();
  });

  it("a readable address that isn't cached is fetched by that name", async () => {
    mocks.apiGet.mockResolvedValue({ ...BPP, courses: [] });
    const t = setup("/student/universities/bpp-university");
    await waitFor(() => expect(t.result.current.university?.name).toBe("BPP University"));
    expect(mocks.apiGet).toHaveBeenCalledWith("/api/universities/bpp-university");
    expect(t.path()).toBe("/student/universities/bpp-university");
  });

  it("without a known slug the id address stays as it is", async () => {
    mocks.cache = [{ id: "u-custom-2", name: "No Slug Uni" }];
    const t = setup("/student/universities/u-custom-2");
    await waitFor(() => expect(t.result.current.university?.name).toBe("No Slug Uni"));
    expect(t.path()).toBe("/student/universities/u-custom-2");
  });

  it("downloads a university's courses by its real id, even when the address uses the slug", async () => {
    mocks.cache = [{ ...BPP, coursesLoaded: false }];
    setup("/student/universities/bpp-university");
    await waitFor(() => expect(mocks.hydrate).toHaveBeenCalledWith("u-custom-1"));
  });

  it("the public pages do their own address handling — this hook never redirects them", async () => {
    mocks.pub = true;
    mocks.publicGet.mockResolvedValue({ ...BPP, courses: [] });
    const t = setup("/student/universities/u-custom-1");
    await waitFor(() => expect(t.result.current.university?.slug).toBe("bpp-university"));
    expect(t.path()).toBe("/student/universities/u-custom-1");
    expect(mocks.apiGet).not.toHaveBeenCalled();
  });
});
