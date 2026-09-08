export interface QueuedFrame {
  frameIndex: number;
  timestampSec: number;
  frame: VideoFrame;
}

/**
 * Bounded 3-8 frame queue per the spec: prevents unbounded memory growth
 * from a fast producer / slow consumer, and prioritizes the newest frame
 * for real-time playback over preserving a long backlog. Pure logic (no
 * WebSocket/timers), so it's unit-testable without a live connection.
 */
export class FrameQueue {
  private frames: QueuedFrame[] = [];
  private droppedCount = 0;

  constructor(private readonly maxDepth: number = 6) {
    if (maxDepth < 3 || maxDepth > 8) {
      throw new RangeError(`FrameQueue: maxDepth must be 3-8 per spec, got ${maxDepth}`);
    }
  }

  /** Pushes a new frame, dropping (and closing) the oldest if over capacity. */
  push(item: QueuedFrame): void {
    this.frames.push(item);
    while (this.frames.length > this.maxDepth) {
      const dropped = this.frames.shift();
      dropped?.frame.close(); // release GPU/CPU-side VideoFrame resources
      this.droppedCount++;
    }
  }

  /**
   * Pops the frame that should be displayed at or before `nowSec`, discarding
   * (and closing) any older frames it skips past — for live playback, showing
   * the newest appropriate frame beats draining a backlog in order.
   */
  popForTime(nowSec: number): QueuedFrame | null {
    let result: QueuedFrame | null = null;
    while (this.frames.length > 0 && (this.frames[0]?.timestampSec ?? Infinity) <= nowSec) {
      if (result) {
        result.frame.close();
        this.droppedCount++;
      }
      result = this.frames.shift() ?? null;
    }
    return result;
  }

  depth(): number {
    return this.frames.length;
  }

  dropped(): number {
    return this.droppedCount;
  }

  isFull(): boolean {
    return this.frames.length >= this.maxDepth;
  }

  clear(): void {
    for (const f of this.frames) f.frame.close();
    this.frames = [];
  }
}
