// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const api = vi.hoisted(() => ({ searchPrograms: vi.fn(), searchUniversities: vi.fn(), fetchFacets: vi.fn() }));
vi.mock("./catalogSearchApi", async () => {
  // toSearchFilters pulls in browser stores; for these tests only the request plumbing matters.
  return { ...api, toSearchFilters: (f: unknown) => ({ echo: f }) };
});

import { useCatalogPage, useCatalogFacets, SEARCH_DEBOUNCE_MS } from "./useCatalogSearch";
import { emptyFilters } from "../utils/universityFilter";
import type { ProgramRow } from "./catalogSearchApi";

const page = (n: number, total = 95) => ({ items: [{ university: { id: `u${n}` }, course: { id: `c${n}`, name: `Course ${n}` } }], total, page: n, limit: 30 });

function setup(overrides: Record<string, unknown> = {}) {
  return renderHook((props: Record<string, unknown>) => useCatalogPage({
    enabled: true, view: "courses", query: "", filters: emptyFilters(), sort: "best", sortCurrency: "", pageSize: 30, persistKey: `test:${Math.random()}`, ...props,
  } as never), { initialProps: overrides });
}
const flush = async (ms = SEARCH_DEBOUNCE_MS + 10) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers();
  api.searchPrograms.mockReset();
  api.searchUniversities.mockReset();
  api.fetchFacets.mockReset();
  api.searchPrograms.mockImplementation(async (p: { page: number }) => page(p.page));
  api.searchUniversities.mockImplementation(async (p: { page: number }) => page(p.page));
  api.fetchFacets.mockResolvedValue({ facets: {}, years: [], intakesAll: [], currenciesUsed: [], locationsForDestination: [], feeStats: { unknown: 0, otherCurrency: 0 }, feeCurrency: "" });
});
afterEach(() => vi.useRealTimers());

describe("useCatalogPage", () => {
  it("fetches the first page immediately on mount (no debounce delay), and reports total/pages", async () => {
    const { result } = setup();
    await flush(0);
    expect(api.searchPrograms).toHaveBeenCalledTimes(1);
    expect(api.searchPrograms.mock.calls[0][0]).toMatchObject({ view: "courses", page: 1, limit: 30, q: "" });
    expect(result.current.total).toBe(95);
    expect(result.current.totalPages).toBe(4);
    expect(result.current.items).toHaveLength(1);
  });

  it("typing quickly sends ONE request (debounced), carrying the final text", async () => {
    const { rerender } = setup();
    await flush();
    api.searchPrograms.mockClear();
    for (const q of ["d", "da", "dat", "data"]) {
      rerender({ query: q });
      await act(async () => { await vi.advanceTimersByTimeAsync(80); });
    }
    expect(api.searchPrograms).not.toHaveBeenCalled(); // still inside the debounce window
    await flush();
    expect(api.searchPrograms).toHaveBeenCalledTimes(1);
    expect(api.searchPrograms.mock.calls[0][0].q).toBe("data");
  });

  it("changing a filter triggers a debounced fetch with that filter", async () => {
    const { rerender } = setup();
    await flush();
    api.searchPrograms.mockClear();
    const filters = emptyFilters();
    filters.level = new Set(["Postgraduate"]);
    rerender({ filters });
    await flush();
    expect(api.searchPrograms).toHaveBeenCalledTimes(1);
    expect((api.searchPrograms.mock.calls[0][0].filters as { echo: { level: Set<string> } }).echo.level.has("Postgraduate")).toBe(true);
  });

  it("Next page fetches that page straight away and keeps the old rows until it arrives", async () => {
    const { result } = setup();
    await flush();
    api.searchPrograms.mockClear();
    act(() => result.current.setPage(2));
    await flush(0);
    expect(api.searchPrograms).toHaveBeenCalledTimes(1);
    expect(api.searchPrograms.mock.calls[0][0].page).toBe(2);
    expect(result.current.page).toBe(2);
    expect((result.current.items[0] as ProgramRow).course.id).toBe("c2");
  });

  it("a new search goes back to page 1", async () => {
    const { result, rerender } = setup({ query: "" });
    await flush();
    act(() => result.current.setPage(3));
    await flush(0);
    expect(result.current.page).toBe(3);
    api.searchPrograms.mockClear();
    rerender({ query: "law" });
    await flush();
    expect(result.current.page).toBe(1);
    const pages = api.searchPrograms.mock.calls.map((c) => c[0].page);
    expect(pages[pages.length - 1]).toBe(1);
  });

  it("does nothing while disabled (the other tab)", async () => {
    setup({ enabled: false });
    await flush();
    expect(api.searchPrograms).not.toHaveBeenCalled();
  });

  it("uses the universities endpoint for the universities view", async () => {
    setup({ view: "universities" });
    await flush();
    expect(api.searchUniversities).toHaveBeenCalledTimes(1);
    expect(api.searchPrograms).not.toHaveBeenCalled();
  });

  it("retries one failed request, then reports an error without looping forever", async () => {
    api.searchPrograms.mockRejectedValue(new Error("503"));
    const { result } = setup();
    await flush();
    await flush(1000);
    expect(api.searchPrograms).toHaveBeenCalledTimes(2); // the attempt + exactly one retry
    expect(result.current.error).toBe(true);
    await flush(5000);
    expect(api.searchPrograms).toHaveBeenCalledTimes(2);
    // "Try again" runs it once more
    api.searchPrograms.mockImplementation(async (p: { page: number }) => page(p.page));
    act(() => result.current.reload());
    await flush(0);
    expect(result.current.error).toBe(false);
    expect(result.current.total).toBe(95);
  });

  it("ignores a slow, older response that lands after a newer one", async () => {
    let releaseOld: (v: unknown) => void = () => {};
    api.searchPrograms.mockImplementationOnce(() => new Promise((r) => { releaseOld = r; }));
    const { result, rerender } = setup({ query: "a" });
    await flush();
    api.searchPrograms.mockImplementation(async () => ({ ...page(1, 7), items: [{ university: { id: "new" }, course: { id: "new", name: "New" } }] }));
    rerender({ query: "b" });
    await flush();
    expect((result.current.items[0] as ProgramRow).course.id).toBe("new");
    await act(async () => { releaseOld(page(1, 999)); await Promise.resolve(); });
    expect(result.current.total).toBe(7);
    expect((result.current.items[0] as ProgramRow).course.id).toBe("new");
  });
});

describe("useCatalogFacets", () => {
  it("fetches the options once per settled filter change", async () => {
    const { rerender } = renderHook(({ f }) => useCatalogFacets(f), { initialProps: { f: emptyFilters() } });
    await flush();
    expect(api.fetchFacets).toHaveBeenCalledTimes(1);
    const f = emptyFilters();
    f.destination = new Set(["Canada"]);
    rerender({ f });
    rerender({ f: { ...f, destination: new Set(["Canada", "UK"]) } });
    await flush();
    expect(api.fetchFacets).toHaveBeenCalledTimes(2);
  });
});
