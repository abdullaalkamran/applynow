// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const api = vi.hoisted(() => ({ apiGet: vi.fn(), apiGetList: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn(), apiDelete: vi.fn() }));
vi.mock("../utils/apiClient", () => api);
vi.mock("../utils/syncCache", () => ({
  notifyCacheChange: () => {},
  cacheChanged: (a: unknown[], b: unknown[]) => JSON.stringify(a) !== JSON.stringify(b),
  dedupeInFlight: (_k: string, fn: () => Promise<void>) => fn(),
}));
vi.mock("../utils/toast", () => ({ reportSaveError: () => {} }));
vi.mock("../utils/authClient", () => ({ loadStoredAuth: () => null }));

const tick = () => new Promise((r) => setTimeout(r, 0));
let reg: typeof import("./countryRegistry");
beforeEach(async () => {
  vi.resetModules();
  Object.values(api).forEach((m) => m.mockReset());
  reg = await import("./countryRegistry");
});

describe("adding a country the server already has", () => {
  it("does not leave a look-alike duplicate: the stale entry is dropped and the real list is loaded", async () => {
    // This browser's list hadn't loaded (it's empty), so South Korea looks new — but the server has it.
    api.apiPatch.mockRejectedValue(Object.assign(new Error("A country with that name already exists."), { status: 409 }));
    api.apiGetList.mockResolvedValue([{ id: "co-real-1", name: "South Korea" }]);
    reg.getCountryId("South Korea");
    expect(reg.getAllCountries().map((c) => c.name)).toEqual(["South Korea"]); // shown straight away (optimistic)
    await tick(); await tick();
    expect(api.apiGetList).toHaveBeenCalledWith("/api/countries");
    expect(reg.getAllCountries()).toEqual([{ id: "co-real-1", name: "South Korea" }]); // exactly one, and it's the real one
    expect(reg.getCountryId("South Korea")).toBe("co-real-1");
  });

  it("a genuinely new country is kept and replaced by the server's record", async () => {
    api.apiPatch.mockImplementation(async (path: string, body: { name: string }) => ({ id: path.split("/").pop(), name: body.name, tagline: "new" }));
    const id = reg.getCountryId("Norway");
    await tick(); await tick();
    expect(reg.getAllCountries()).toEqual([{ id, name: "Norway", tagline: "new" }]);
  });

  it("any other failure leaves the entry in place (the session still needs its id) without refetching", async () => {
    api.apiPatch.mockRejectedValue(Object.assign(new Error("boom"), { status: 500 }));
    reg.getCountryId("Chile");
    await tick(); await tick();
    expect(reg.getAllCountries().map((c) => c.name)).toEqual(["Chile"]);
    expect(api.apiGetList).not.toHaveBeenCalled();
  });
});
