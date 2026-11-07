// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const api = vi.hoisted(() => ({ apiGet: vi.fn(), apiGetList: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn(), apiDelete: vi.fn() }));
vi.mock("../utils/apiClient", () => api);
vi.mock("../utils/syncCache", () => ({
  notifyCacheChange: () => {},
  cacheChanged: (a: unknown[], b: unknown[]) => JSON.stringify(a) !== JSON.stringify(b),
  dedupeInFlight: (_k: string, fn: () => Promise<void>) => fn(),
}));
vi.mock("../utils/authClient", () => ({ loadStoredAuth: () => null }));
vi.mock("../utils/toast", () => ({ reportSaveError: () => {} }));
vi.mock("./countryRegistry", () => ({ getCountryId: () => "c1" }));

const summary = [
  { id: "u1", name: "A", courses: [], coursesLoaded: false, courseCount: 12 },
  { id: "u2", name: "B", courses: [], coursesLoaded: false, courseCount: 3 },
];
const tick = () => new Promise((r) => setTimeout(r, 0));

let store: typeof import("./universityCatalogStore");
beforeEach(async () => {
  vi.resetModules();
  Object.values(api).forEach((m) => m.mockReset());
  store = await import("./universityCatalogStore");
});

describe("courseCountOf", () => {
  it("reads the summary's count until the courses have been downloaded — never a misleading 0", () => {
    expect(store.courseCountOf({ courses: [], coursesLoaded: false, courseCount: 12 } as never)).toBe(12);
    expect(store.courseCountOf({ courses: [], coursesLoaded: false } as never)).toBe(0);
  });
  it("counts the real list once it is there", () => {
    expect(store.courseCountOf({ courses: [{}, {}, {}] } as never)).toBe(3);
    expect(store.courseCountOf({ courses: [{}], coursesLoaded: true, courseCount: 99 } as never)).toBe(1);
  });
});

describe("loading the catalog", () => {
  it("holds the summary after a successful load, with course counts available", async () => {
    api.apiGetList.mockResolvedValue(summary);
    await store.refreshUniversities();
    expect(store.getUniversitySummaries()).toHaveLength(2);
    expect(store.getUniversitiesLoadError()).toBe("");
    expect(store.getUniversitySummaries().reduce((n, u) => n + store.courseCountOf(u), 0)).toBe(15);
  });

  it("a failed load never leaves anything but a list in the store, and records why", async () => {
    api.apiGetList.mockRejectedValue(new Error("The server sent an unexpected response — please try again in a moment."));
    await expect(store.refreshUniversities()).rejects.toThrow();
    expect(Array.isArray(store.getAllUniversities())).toBe(true);
    expect(Array.isArray(store.getUniversitySummaries())).toBe(true);
    expect(store.getAllUniversities()).toEqual([]);
    expect(store.getUniversitiesLoadError()).toMatch(/unexpected response/);
  });

  it("a failed refresh keeps the data already loaded", async () => {
    api.apiGetList.mockResolvedValueOnce(summary);
    await store.refreshUniversities();
    api.apiGetList.mockRejectedValueOnce(new Error("timeout"));
    await expect(store.refreshUniversities()).rejects.toThrow();
    expect(store.getUniversitySummaries()).toHaveLength(2);
    expect(store.getUniversitiesLoadError()).toBe(""); // there is data on screen, so nothing is flagged
  });

  it("a failed full-catalog download is not retried on every render — only after the back-off, or on 'Try again'", async () => {
    api.apiGetList.mockResolvedValueOnce(summary); // the summary
    await store.refreshUniversities();
    api.apiGetList.mockRejectedValue(new Error("timeout")); // every later request (the full catalog) fails
    store.getAllUniversities(); // first ask starts the download
    await tick(); await tick();
    const afterFirst = api.apiGetList.mock.calls.length;
    for (let i = 0; i < 20; i++) store.getAllUniversities(); // twenty re-renders
    await tick();
    expect(api.apiGetList.mock.calls.length).toBe(afterFirst);
    expect(store.getUniversitiesLoadError()).toBe("timeout");
    // "Try again" goes straight away
    await store.retryUniversities();
    expect(api.apiGetList.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it("clears the problem once a load succeeds", async () => {
    api.apiGetList.mockRejectedValueOnce(new Error("timeout"));
    await expect(store.refreshUniversities()).rejects.toThrow();
    expect(store.getUniversitiesLoadError()).toBe("timeout");
    api.apiGetList.mockResolvedValueOnce(summary);
    await store.retryUniversities();
    expect(store.getUniversitiesLoadError()).toBe("");
    expect(store.getUniversitySummaries()).toHaveLength(2);
  });
});

describe("finding a university by its readable name", () => {
  it("peekUniversityById accepts the id or the slug", async () => {
    api.apiGetList.mockResolvedValue([
      { id: "u-custom-1", slug: "bpp-university", name: "BPP", courses: [], coursesLoaded: false, courseCount: 2 },
      { id: "u-custom-2", name: "No slug", courses: [], coursesLoaded: false, courseCount: 1 },
    ]);
    await store.refreshUniversities();
    expect(store.peekUniversityById("u-custom-1")?.name).toBe("BPP");
    expect(store.peekUniversityById("bpp-university")?.name).toBe("BPP");
    expect(store.peekUniversityById("u-custom-2")?.name).toBe("No slug");
    expect(store.peekUniversityById("nope")).toBeUndefined();
  });
});
