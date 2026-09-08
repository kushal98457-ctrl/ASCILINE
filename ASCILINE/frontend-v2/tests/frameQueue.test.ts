import { describe, it, expect, vi } from "vitest";
import { FrameQueue, type QueuedFrame } from "../src/network/frameQueue";

/** Minimal VideoFrame stand-in — only `.close()` is used by FrameQueue. */
function fakeFrame(frameIndex: number, timestampSec: number): QueuedFrame {
  return {
    frameIndex,
    timestampSec,
    frame: { close: vi.fn() } as unknown as VideoFrame,
  };
}

describe("FrameQueue", () => {
  it("rejects a maxDepth outside the spec's 3-8 range", () => {
    expect(() => new FrameQueue(2)).toThrow(RangeError);
    expect(() => new FrameQueue(9)).toThrow(RangeError);
    expect(() => new FrameQueue(3)).not.toThrow();
    expect(() => new FrameQueue(8)).not.toThrow();
  });

  it("tracks depth as frames are pushed, up to maxDepth", () => {
    const q = new FrameQueue(3);
    q.push(fakeFrame(0, 0));
    q.push(fakeFrame(1, 1 / 30));
    expect(q.depth()).toBe(2);
    expect(q.isFull()).toBe(false);
    q.push(fakeFrame(2, 2 / 30));
    expect(q.isFull()).toBe(true);
  });

  it("drops and closes the oldest frame when pushed beyond maxDepth", () => {
    const q = new FrameQueue(3);
    const f0 = fakeFrame(0, 0);
    q.push(f0);
    q.push(fakeFrame(1, 1));
    q.push(fakeFrame(2, 2));
    q.push(fakeFrame(3, 3)); // should evict f0
    expect(f0.frame.close).toHaveBeenCalledOnce();
    expect(q.depth()).toBe(3);
    expect(q.dropped()).toBe(1);
  });

  it("popForTime returns null when no frame's timestamp has arrived yet", () => {
    const q = new FrameQueue(4);
    q.push(fakeFrame(0, 5.0));
    expect(q.popForTime(1.0)).toBeNull();
    expect(q.depth()).toBe(1); // not consumed
  });

  it("popForTime returns the newest due frame and closes/skips older due frames", () => {
    const q = new FrameQueue(6);
    const f0 = fakeFrame(0, 0.0);
    const f1 = fakeFrame(1, 0.1);
    const f2 = fakeFrame(2, 0.2);
    q.push(f0);
    q.push(f1);
    q.push(f2);

    const result = q.popForTime(0.15); // f0 and f1 are due, f2 is not
    expect(result?.frameIndex).toBe(1);
    expect(f0.frame.close).toHaveBeenCalledOnce(); // skipped-over frame closed
    expect(f1.frame.close).not.toHaveBeenCalled(); // returned frame NOT closed by the queue
    expect(q.depth()).toBe(1); // f2 remains
  });

  it("clear() closes every remaining frame", () => {
    const q = new FrameQueue(4);
    const f0 = fakeFrame(0, 0);
    const f1 = fakeFrame(1, 1);
    q.push(f0);
    q.push(f1);
    q.clear();
    expect(f0.frame.close).toHaveBeenCalledOnce();
    expect(f1.frame.close).toHaveBeenCalledOnce();
    expect(q.depth()).toBe(0);
  });
});
