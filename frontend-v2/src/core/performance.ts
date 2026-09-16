import type { FrameMetrics, QualitySettings, RendererBackend } from "./types";
import { ADAPTIVE_COLUMN_STEPS } from "./types";

const HISTORY_LEN = 90; // ~1.5s at 60fps, enough to smooth without being sluggish

/**
 * Tracks per-frame timings and derives FPS/1%-low style metrics. Also owns
 * the adaptive-quality decision: when sustained frame time exceeds budget,
 * step resolution down (and eventually disable effects) per the priority
 * order from the spec: resolution -> edge detection -> dithering -> temporal.
 */
export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private lastFrameStart = 0;
  private dropped = 0;
  private latencySamples: number[] = [];
  private renderer: RendererBackend = "unavailable";
  private resolution = { cols: 0, rows: 0 };
  private queueDepth = 0;

  private lastAdaptCheck = 0;
  private consecutiveOverBudget = 0;
  private consecutiveUnderBudget = 0;

  beginFrame(): void {
    this.lastFrameStart = performance.now();
  }

  endFrame(opts: { decodeMs?: number; uploadMs?: number; renderMs?: number; latencyMs?: number } = {}): FrameMetrics {
    const now = performance.now();
    const frameTime = now - this.lastFrameStart;
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > HISTORY_LEN) this.frameTimes.shift();
    if (opts.latencyMs !== undefined) {
      this.latencySamples.push(opts.latencyMs);
      if (this.latencySamples.length > HISTORY_LEN) this.latencySamples.shift();
    }

    const avgFrameTime = this.average(this.frameTimes);
    const fps = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;

    return {
      fps: Math.round(fps * 10) / 10,
      frameTimeMs: Math.round(avgFrameTime * 100) / 100,
      gpuFrameTimeMs: null,
      cpuTimeMs: Math.round(frameTime * 100) / 100,
      decodeTimeMs: opts.decodeMs ?? 0,
      uploadTimeMs: opts.uploadMs ?? 0,
      renderTimeMs: opts.renderMs ?? 0,
      queueDepth: this.queueDepth,
      droppedFrames: this.dropped,
      latencyMs: Math.round(this.average(this.latencySamples) * 10) / 10,
      memoryEstimateMb: this.estimateMemoryMb(),
      resolution: this.resolution,
      renderer: this.renderer,
    };
  }

  recordDrop(): void {
    this.dropped++;
  }

  setQueueDepth(depth: number): void {
    this.queueDepth = depth;
  }

  setRendererInfo(renderer: RendererBackend, cols: number, rows: number): void {
    this.renderer = renderer;
    this.resolution = { cols, rows };
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private estimateMemoryMb(): number {
    // Rough order-of-magnitude estimate: cell buffers (front+back, 8B/cell)
    // + a bounded frame queue of RGBA frames at source resolution.
    const cellBytes = this.resolution.cols * this.resolution.rows * 8 * 2;
    const queueBytes = this.queueDepth * 1920 * 1080 * 4; // worst case 1080p RGBA
    return Math.round(((cellBytes + queueBytes) / (1024 * 1024)) * 10) / 10;
  }

  /**
   * Priority order per spec: maintain FPS -> reduce resolution -> disable
   * edge detection -> reduce dithering -> reduce temporal processing.
   * Called periodically (not every frame) to avoid oscillation; requires
   * ~1s of sustained over/under-budget before acting (hysteresis).
   */
  adaptQuality(settings: QualitySettings, targetFrameTimeMs: number): QualitySettings | null {
    if (!settings.adaptiveQuality) return null;
    const now = performance.now();
    if (now - this.lastAdaptCheck < 1000) return null;
    this.lastAdaptCheck = now;

    const avgFrameTime = this.average(this.frameTimes);
    if (avgFrameTime === 0) return null;

    const overBudget = avgFrameTime > targetFrameTimeMs * 1.15; // 15% headroom before reacting
    const wellUnderBudget = avgFrameTime < targetFrameTimeMs * 0.75;

    this.consecutiveOverBudget = overBudget ? this.consecutiveOverBudget + 1 : 0;
    this.consecutiveUnderBudget = wellUnderBudget ? this.consecutiveUnderBudget + 1 : 0;

    if (this.consecutiveOverBudget >= 2) {
      this.consecutiveOverBudget = 0;
      return stepDownQuality(settings);
    }
    if (this.consecutiveUnderBudget >= 4) {
      // Be more conservative about stepping back up than stepping down.
      this.consecutiveUnderBudget = 0;
      return stepUpQuality(settings);
    }
    return null;
  }
}

/**
 * Priority order per spec: reduce resolution -> disable edge detection ->
 * disable dithering -> reduce temporal processing. Pure function (exported
 * for unit testing) — PerformanceMonitor.adaptQuality only adds the
 * hysteresis/timing wrapper around this.
 */
export function stepDownQuality(settings: QualitySettings): QualitySettings | null {
  const idx = ADAPTIVE_COLUMN_STEPS.findIndex((c) => c <= settings.columns);
  if (idx >= 0 && idx < ADAPTIVE_COLUMN_STEPS.length - 1 && ADAPTIVE_COLUMN_STEPS[idx] === settings.columns) {
    const next = ADAPTIVE_COLUMN_STEPS[idx + 1];
    if (next !== undefined) return { ...settings, columns: next };
  }
  if (settings.edgeDetection !== "off") return { ...settings, edgeDetection: "off" };
  if (settings.dithering) return { ...settings, dithering: false };
  if (settings.temporalStabilization !== "off") {
    return { ...settings, temporalStabilization: stepEffectDown(settings.temporalStabilization) };
  }
  return null; // already at minimum quality
}

/**
 * Only resolution is auto-restored on the way back up; effects that were
 * disabled stay disabled until the user re-enables them, to avoid flapping
 * between "edges on" and "edges off" every few seconds near the FPS budget.
 */
export function stepUpQuality(settings: QualitySettings): QualitySettings | null {
  const idx = ADAPTIVE_COLUMN_STEPS.findIndex((c) => c === settings.columns);
  if (idx > 0) {
    const prev = ADAPTIVE_COLUMN_STEPS[idx - 1];
    if (prev !== undefined) return { ...settings, columns: prev };
  }
  return null;
}

function stepEffectDown(
  level: QualitySettings["temporalStabilization"],
): QualitySettings["temporalStabilization"] {
  if (level === "high") return "medium";
  if (level === "medium") return "low";
  return "off";
}
