import type { IRenderer } from "./Renderer";
import { detectBestBackend } from "./Renderer";
import { WebGPURenderer } from "./WebGPURenderer";
import { WebGLRenderer } from "./WebGLRenderer";
import type { QualitySettings, FrameMetrics } from "../core/types";
import { DEFAULT_QUALITY, computeGridDimensions } from "../core/types";
import { PerformanceMonitor } from "../core/performance";
import type { StreamClient } from "../network/websocket";
import type { QueuedFrame } from "../network/frameQueue";
import type { PlaybackClock } from "../core/clock";

export type MetricsListener = (metrics: FrameMetrics) => void;

/**
 * Top-level render orchestrator. Owns backend selection (WebGPU -> WebGL2 ->
 * unavailable), the rAF loop, and adaptive-quality feedback. Nothing above
 * this layer (UI, player) needs to know which GPU API is active.
 */
export class Pipeline {
  private renderer: IRenderer | null = null;
  private settings: QualitySettings = { ...DEFAULT_QUALITY };
  private monitor = new PerformanceMonitor();
  private rafHandle: number | null = null;
  private metricsListeners: MetricsListener[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private videoSource: HTMLVideoElement | null = null;
  private liveClient: StreamClient | null = null;
  private liveClock: PlaybackClock | null = null;
  private lastLiveFrame: QueuedFrame | null = null;

  async init(canvas: HTMLCanvasElement, initialSettings?: Partial<QualitySettings>): Promise<IRenderer["backend"]> {
    this.canvas = canvas;
    this.settings = { ...DEFAULT_QUALITY, ...initialSettings };

    const backend = await detectBestBackend();
    if (backend === "webgpu") {
      this.renderer = new WebGPURenderer();
    } else if (backend === "webgl2") {
      this.renderer = new WebGLRenderer();
      console.warn("[ASCILINE] WebGPU unavailable, falling back to WebGL2. Some quality is capped.");
    } else {
      throw new Error(
        "No GPU rendering backend available (neither WebGPU nor WebGL2). " +
          "This browser/device cannot run ASCILINE V2's rendering path.",
      );
    }

    await this.renderer.init(canvas);
    this.renderer.updateSettings(this.settings);
    return this.renderer.backend;
  }

  onMetrics(listener: MetricsListener): void {
    this.metricsListeners.push(listener);
  }

  updateSettings(partial: Partial<QualitySettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.renderer?.updateSettings(this.settings);
  }

  getSettings(): QualitySettings {
    return this.settings;
  }

  /** Local/URL playback path: source is a browser-decoded <video> element. */
  start(videoSource: HTMLVideoElement): void {
    this.liveClient = null;
    this.liveClock = null;
    this.videoSource = videoSource;
    this.startLoop();
  }

  /**
   * Live-streaming path: source is stream_server.py's pixel_mode WebSocket
   * feed, already decoded into VideoFrame objects and buffered in a bounded
   * FrameQueue by StreamClient. `clock` is PTS-driven (see core/clock.ts) so
   * frame presentation is timestamp-based, never a fixed-interval timer.
   */
  startLive(client: StreamClient, clock: PlaybackClock): void {
    this.videoSource = null;
    this.liveClient = client;
    this.liveClock = clock;
    this.startLoop();
  }

  private startLoop(): void {
    if (this.rafHandle !== null) return;
    const loop = () => {
      this.tick();
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.lastLiveFrame?.frame.close();
    this.lastLiveFrame = null;
  }

  private tick(): void {
    if (!this.renderer || !this.canvas) return;

    if (this.videoSource) {
      this.tickLocal(this.videoSource);
    } else if (this.liveClient && this.liveClock) {
      this.tickLive(this.liveClient, this.liveClock);
    }
  }

  private tickLocal(videoSource: HTMLVideoElement): void {
    if (videoSource.paused || videoSource.ended) return;
    if (videoSource.readyState < 2) return; // HAVE_CURRENT_DATA

    this.monitor.beginFrame();
    const renderStart = performance.now();
    this.renderer!.renderFrame(videoSource);
    const renderMs = performance.now() - renderStart;

    if (this.settings.columns) {
      const { cols, rows } = computeGridDimensions(
        videoSource.videoWidth || 16,
        videoSource.videoHeight || 9,
        this.settings.columns,
      );
      this.monitor.setRendererInfo(this.renderer!.backend, cols, rows);
    }

    this.finishTick(renderMs, null);
  }

  private tickLive(client: StreamClient, clock: PlaybackClock): void {
    this.monitor.setQueueDepth(client.queue.depth());
    const item = client.queue.popForTime(clock.now());
    if (!item) return; // nothing new/due yet — hold last presented frame on screen

    this.monitor.beginFrame();
    const renderStart = performance.now();
    this.renderer!.renderFrame(item.frame);
    const renderMs = performance.now() - renderStart;

    const init = client.getInit();
    if (init && this.settings.columns) {
      const { cols, rows } = computeGridDimensions(init.cols, init.rows, this.settings.columns);
      this.monitor.setRendererInfo(this.renderer!.backend, cols, rows);
    }

    const latencyMs = (clock.now() - item.timestampSec) * 1000;
    this.lastLiveFrame?.frame.close();
    this.lastLiveFrame = item;
    this.finishTick(renderMs, latencyMs);
  }

  private finishTick(renderMs: number, latencyMs: number | null): void {
    const metrics = this.monitor.endFrame({ renderMs, latencyMs: latencyMs ?? undefined });
    for (const listener of this.metricsListeners) listener(metrics);

    const targetFrameTimeMs = 1000 / this.settings.targetFps;
    const adapted = this.monitor.adaptQuality(this.settings, targetFrameTimeMs);
    if (adapted) {
      this.settings = adapted;
      this.renderer!.updateSettings(this.settings);
    }
  }

  destroy(): void {
    this.stop();
    this.liveClient?.disconnect();
    this.liveClient = null;
    this.renderer?.destroy();
    this.renderer = null;
  }
}
