// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const api = vi.hoisted(() => ({ apiGet: vi.fn(), apiPut: vi.fn(), apiPutOnUnload: vi.fn() }));
vi.mock("../utils/apiClient", () => api);
vi.mock("../utils/syncCache", () => ({ notifyCacheChange: () => {}, dedupeInFlight: (_k: string, fn: () => Promise<void>) => fn() }));

let store: Record<string, string>;
beforeEach(async () => {
  vi.useFakeTimers();
  store = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; }, key: (i: number) => Object.keys(store)[i] ?? null, get length() { return Object.keys(store).length; } },
  });
  api.apiPut.mockReset(); api.apiPut.mockResolvedValue({});
  api.apiGet.mockReset(); api.apiPutOnUnload.mockReset();
  vi.resetModules();
});
afterEach(() => vi.useRealTimers());

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const load = () => import("./profileSync");

describe("profile section saves", () => {
  it("saves the same step to the right URL once, however many times it is set (step: is URL-encoded, not a different step)", async () => {
    const { putServerSection } = await load();
    for (let i = 0; i < 5; i++) putServerSection("st-1", "step:personal-information", true);
    await tick(900);
    expect(api.apiPut).toHaveBeenCalledTimes(1);
    expect(api.apiPut).toHaveBeenCalledWith("/api/student-profile/st-1/step%3Apersonal-information", { data: true });
  });

  it("rapid edits to a section become one request carrying the final value", async () => {
    const { putServerSection } = await load();
    for (const name of ["A", "Al", "Ali"]) { putServerSection("st-1", "personal", { name }); await tick(100); }
    await tick(900);
    expect(api.apiPut).toHaveBeenCalledTimes(1);
    expect(api.apiPut).toHaveBeenCalledWith("/api/student-profile/st-1/personal", { data: { name: "Ali" } });
  });

  it("flushProfileSaves sends a waiting edit immediately", async () => {
    const { putServerSection, flushProfileSaves } = await load();
    putServerSection("st-1", "personal", { name: "Ali" });
    expect(api.apiPut).not.toHaveBeenCalled();
    await flushProfileSaves();
    expect(api.apiPut).toHaveBeenCalledTimes(1);
  });

  it("a 'Student not found' answer stops the retries, and the student is not asked about again", async () => {
    api.apiPut.mockRejectedValue(Object.assign(new Error("Student not found."), { status: 404 }));
    const { putServerSection, isStudentUnreachable } = await load();
    putServerSection("st-gone", "step:personal-information", true);
    await tick(900);
    await tick(60_000);
    expect(api.apiPut).toHaveBeenCalledTimes(1);
    expect(isStudentUnreachable("st-gone")).toBe(true);
    putServerSection("st-gone", "personal", { name: "x" });
    await tick(5000);
    expect(api.apiPut).toHaveBeenCalledTimes(1); // no further request for that student
  });

  it("a stale local draft is not re-sent on the next page load once its student is known to be missing", async () => {
    store["sd-profile-step:personal-information:st-gone"] = "true";
    api.apiGet.mockResolvedValue({});
    api.apiPut.mockRejectedValue(Object.assign(new Error("Student not found."), { status: 404 }));
    let mod = await load();
    await mod.refreshProfileSections();
    await tick(900);
    expect(api.apiPut).toHaveBeenCalledTimes(1);
    // next page load
    vi.resetModules();
    api.apiPut.mockClear();
    mod = await load();
    await mod.refreshProfileSections();
    await tick(5000);
    expect(api.apiPut).not.toHaveBeenCalled();
    expect(store["sd-profile-step:personal-information:st-gone"]).toBe("true"); // the draft itself is untouched
  });

  it("a server refresh does not overwrite an edit that is still waiting to be sent", async () => {
    api.apiGet.mockResolvedValue({ "st-1": { personal: { name: "old" } } });
    const { putServerSection, refreshProfileSections, getServerSection } = await load();
    putServerSection("st-1", "personal", { name: "typed" });
    await refreshProfileSections();
    expect(getServerSection("st-1", "personal")).toEqual({ name: "typed" });
  });

  it("hands waiting edits to the keepalive sender when the page is hidden", async () => {
    const { putServerSection } = await load();
    putServerSection("st-1", "personal", { name: "last words" });
    window.dispatchEvent(new Event("pagehide"));
    expect(api.apiPutOnUnload).toHaveBeenCalledWith("/api/student-profile/st-1/personal", { data: { name: "last words" } });
    await tick(5000);
    expect(api.apiPut).not.toHaveBeenCalled();
  });
});
