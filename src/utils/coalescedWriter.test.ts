import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCoalescedWriter } from "./coalescedWriter";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe("createCoalescedWriter", () => {
  it("sends once for a burst of edits, with the latest value", async () => {
    const send = vi.fn(async () => {});
    const w = createCoalescedWriter<string>({ send });
    for (const v of ["a", "ab", "abc", "abcd"]) { w.write("k", v); await tick(100); }
    expect(send).not.toHaveBeenCalled();
    await tick(800);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("k", "abcd");
  });

  it("does not send a value that is identical (by value) to the last saved one", async () => {
    const send = vi.fn(async () => {});
    const w = createCoalescedWriter<{ a: number[] }>({ send });
    w.write("k", { a: [1, 2] });
    await tick(900);
    w.write("k", { a: [1, 2] }); // a new object with the same content
    await tick(900);
    expect(send).toHaveBeenCalledTimes(1);
    w.write("k", { a: [1, 2, 3] });
    await tick(900);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("edits to different keys are independent", async () => {
    const send = vi.fn(async () => {});
    const w = createCoalescedWriter<number>({ send });
    w.write("a", 1); w.write("b", 2);
    await tick(900);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("flushAll sends everything waiting immediately (route change / unmount)", async () => {
    const send = vi.fn(async () => {});
    const w = createCoalescedWriter<number>({ send });
    w.write("a", 1); w.write("b", 2);
    expect(send).not.toHaveBeenCalled();
    await w.flushAll();
    expect(send).toHaveBeenCalledTimes(2);
    expect(w.pending()).toBe(0);
    await tick(2000);
    expect(send).toHaveBeenCalledTimes(2); // the timers were cancelled, nothing is sent twice
  });

  it("flushOnUnload hands the waiting values to the unload sender and leaves nothing to send later", async () => {
    const send = vi.fn(async () => {});
    const sendOnUnload = vi.fn();
    const w = createCoalescedWriter<string>({ send, sendOnUnload });
    w.write("k", "typed just before closing");
    w.flushOnUnload();
    expect(sendOnUnload).toHaveBeenCalledWith("k", "typed just before closing");
    await tick(5000);
    expect(send).not.toHaveBeenCalled();
  });

  it("retries a failing send a few times with growing delays, then gives up for good", async () => {
    const send = vi.fn(async () => { throw new Error("503"); });
    const onGiveUp = vi.fn();
    const w = createCoalescedWriter<number>({ send, onGiveUp, maxRetries: 3, backoffMs: 1000 });
    w.write("k", 1);
    await tick(800);
    expect(send).toHaveBeenCalledTimes(1);
    await tick(1000);
    expect(send).toHaveBeenCalledTimes(2);
    await tick(2000);
    expect(send).toHaveBeenCalledTimes(3);
    await tick(4000);
    expect(send).toHaveBeenCalledTimes(4); // the attempt + 3 retries
    expect(onGiveUp).toHaveBeenCalledTimes(1);
    await tick(60_000);
    expect(send).toHaveBeenCalledTimes(4); // never again on its own
    expect(w.pending()).toBe(0);
  });

  it("does not retry an error that can't be fixed by retrying (a 4xx)", async () => {
    const err = Object.assign(new Error("Student not found."), { status: 404 });
    const send = vi.fn(async () => { throw err; });
    const onGiveUp = vi.fn();
    const w = createCoalescedWriter<number>({ send, onGiveUp });
    w.write("k", 1);
    await tick(800);
    await tick(60_000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(onGiveUp).toHaveBeenCalledWith("k", err);
  });

  it("a failed value is sent again when the user edits it again", async () => {
    let fail = true;
    const send = vi.fn(async () => { if (fail) throw Object.assign(new Error("bad"), { status: 400 }); });
    const w = createCoalescedWriter<number>({ send });
    w.write("k", 1);
    await tick(900);
    fail = false;
    w.write("k", 1); // same value, but the server never accepted it
    await tick(900);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("sends one key's writes in order, never two at once", async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const send = vi.fn(async (_k: string, v: string) => {
      order.push(`start ${v}`);
      if (v === "first") await new Promise<void>((r) => { release = r; });
      order.push(`end ${v}`);
    });
    const w = createCoalescedWriter<string>({ send });
    w.write("k", "first");
    await tick(900);
    w.write("k", "second");
    await tick(900);
    expect(order).toEqual(["start first"]); // second waits for the first to finish
    release();
    await tick(10);
    expect(order).toEqual(["start first", "end first", "start second", "end second"]);
  });

  it("forgetSaved makes the next identical write go out again", async () => {
    const send = vi.fn(async () => {});
    const w = createCoalescedWriter<number>({ send });
    w.write("k", 1);
    await tick(900);
    w.forgetSaved();
    w.write("k", 1);
    await tick(900);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
