// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiGet, apiGetList, apiPost } from "./apiClient";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // Node's own experimental localStorage global shadows jsdom's; use a plain stand-in.
  Object.defineProperty(window, "localStorage", { value: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, configurable: true });
});
afterEach(() => vi.unstubAllGlobals());

describe("apiGet request sharing", () => {
  it("identical reads in flight together make ONE network request", async () => {
    fetchMock.mockImplementation(async () => json([{ id: "s1" }]));
    const [a, b, c] = await Promise.all([apiGet("/api/students"), apiGet("/api/students"), apiGet("/api/students")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual([{ id: "s1" }]);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("each caller gets its own copy — one store changing its data can't change another's", async () => {
    fetchMock.mockImplementation(async () => json([{ id: "s1", name: "A" }]));
    const [a, b] = await Promise.all([apiGet<{ name: string }[]>("/api/students"), apiGet<{ name: string }[]>("/api/students")]);
    expect(a).not.toBe(b);
    a[0].name = "changed";
    expect(b[0].name).toBe("A");
  });

  it("different URLs are separate requests", async () => {
    fetchMock.mockImplementation(async () => json([]));
    await Promise.all([apiGet("/api/students"), apiGet("/api/students?counsellorId=c1")]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a read after the first one finished is fetched fresh", async () => {
    fetchMock.mockImplementation(async () => json([]));
    await apiGet("/api/students");
    await apiGet("/api/students");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("writes are never shared", async () => {
    fetchMock.mockImplementation(async () => json({ ok: true }));
    await Promise.all([apiPost("/api/tasks", { a: 1 }), apiPost("/api/tasks", { a: 1 })]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a failed shared read fails every caller, and the next read tries again", async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: "nope" }), { status: 400 }));
    const results = await Promise.allSettled([apiGet("/api/x"), apiGet("/api/x")]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    fetchMock.mockImplementation(async () => json({ fine: true }));
    await expect(apiGet("/api/x")).resolves.toEqual({ fine: true });
  });
});

describe("unreadable and non-list answers", () => {
  const text = (body: string, status = 200) => new Response(body, { status });

  it("an OK answer that isn't JSON is an error — never {} handed on as if it were the data", async () => {
    fetchMock.mockImplementation(async () => text("<html>Service temporarily unavailable</html>"));
    await expect(apiGet("/api/countries")).rejects.toThrow(/unexpected response/i);
  });

  it("a body cut off mid-way is an error too", async () => {
    fetchMock.mockImplementation(async () => text('[{"id":"u1","name":"Lee'));
    await expect(apiGet("/api/universities/summary")).rejects.toThrow(/unexpected response/i);
  });

  it("a genuinely empty OK answer still reads as {}", async () => {
    fetchMock.mockImplementation(async () => text(""));
    await expect(apiGet("/api/anything")).resolves.toEqual({});
  });

  it("an error answer keeps the server's message and its status", async () => {
    fetchMock.mockImplementation(async () => text(JSON.stringify({ error: "A country with that name already exists." }), 409));
    await expect(apiPost("/api/countries/x", {})).rejects.toMatchObject({ message: "A country with that name already exists.", status: 409 });
  });

  it("apiGetList returns a real list", async () => {
    fetchMock.mockImplementation(async () => json([{ id: "a" }]));
    await expect(apiGetList("/api/x")).resolves.toEqual([{ id: "a" }]);
  });

  it("apiGetList refuses an object, so a store can never end up holding one", async () => {
    fetchMock.mockImplementation(async () => json({ error: "slow" }));
    await expect(apiGetList("/api/x")).rejects.toThrow(/unexpected response/i);
    fetchMock.mockImplementation(async () => text(""));
    await expect(apiGetList("/api/y")).rejects.toThrow(/unexpected response/i);
  });
});
