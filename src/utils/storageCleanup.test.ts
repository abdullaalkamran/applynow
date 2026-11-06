import { describe, it, expect } from "vitest";
import { runStorageCleanup, describeStorageUsage } from "./storageCleanup";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v; },
    removeItem: (k: string) => { delete data[k]; },
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() { return Object.keys(data).length; },
  };
}

describe("runStorageCleanup", () => {
  it("removes only the confirmed-dead keys and leaves everything else — drafts, session, extension keys — alone", () => {
    const s = fakeStorage({
      "demo-role": "admin",
      "sd-profile-details:personal:st-1": "{\"name\":\"draft\"}",
      "sd-profile-step:st-1:personal-information": "true",
      "sd-academic-levels:st-1": "[]",
      "sd-auth-token": "t", "sd-auth-user": "{}",
      "sd-shortlisted-programs:u": "[]",
      __WOV: "x".repeat(1000), __GMO: "y".repeat(1000),
    });
    expect(runStorageCleanup(s)).toBe(1);
    expect("demo-role" in s.data).toBe(false);
    for (const k of ["sd-profile-details:personal:st-1", "sd-profile-step:st-1:personal-information", "sd-academic-levels:st-1", "sd-auth-token", "sd-auth-user", "sd-shortlisted-programs:u", "__WOV", "__GMO"]) {
      expect(k in s.data, k).toBe(true);
    }
  });

  it("runs once per version, not on every start", () => {
    const s = fakeStorage({ "demo-role": "x" });
    expect(runStorageCleanup(s)).toBe(1);
    s.data["demo-role"] = "came back";
    expect(runStorageCleanup(s)).toBe(0);
    expect(s.data["demo-role"]).toBe("came back");
  });

  it("does nothing, without throwing, when storage is unavailable or throws", () => {
    expect(runStorageCleanup(undefined)).toBe(0);
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => {}, removeItem: () => {} };
    expect(runStorageCleanup(broken)).toBe(0);
  });
});

describe("describeStorageUsage", () => {
  it("lists keys biggest first and flags the ones this app doesn't own", () => {
    const s = fakeStorage({ "sd-auth-token": "abc", __WOV: "x".repeat(500), "staff-meetings-done": "[]" });
    const rows = describeStorageUsage(s as unknown as Storage);
    expect(rows[0].key).toBe("__WOV");
    expect(rows[0].appOwned).toBe(false);
    expect(rows.find((r) => r.key === "sd-auth-token")?.appOwned).toBe(true);
  });
});
