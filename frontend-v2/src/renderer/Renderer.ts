import type { QualitySettings, RendererBackend } from "../core/types";

/**
 * Backend-agnostic renderer contract. WebGPURenderer and WebGLRenderer both
 * implement this so Pipeline.ts (and everything above it) never branches on
 * which GPU API is active.
 */
export interface IRenderer {
  readonly backend: RendererBackend;

  /** Initializes the GPU device/context against the given canvas. Throws if unsupported. */
  init(canvas: HTMLCanvasElement): Promise<void>;

  /** (Re)builds the character atlas texture for the current character set. */
  setCharacterRamp(ramp: string): Promise<void>;

  /** Applies a settings change. Cheap fields (toggles) are applied without pipeline rebuilds. */
  updateSettings(settings: QualitySettings): void;

  /**
   * Renders one video frame. `source` is whatever the browser already
   * decoded (a HTMLVideoElement) — hardware decoding stays the browser's
   * job; this call only does GPU upload + ASCII generation + composition.
   * Returns GPU-side timing in ms when available (WebGPU timestamp queries),
   * otherwise null.
   */
  renderFrame(source: HTMLVideoElement | VideoFrame): number | null;

  /** Releases GPU resources. Safe to call multiple times. */
  destroy(): void;
}

export class RendererUnavailableError extends Error {
  constructor(backend: string, reason: string) {
    super(`${backend} unavailable: ${reason}`);
    this.name = "RendererUnavailableError";
  }
}

/**
 * Probes for the best available backend without allocating a real context,
 * so Pipeline can decide WebGPU vs WebGL2 before construction.
 */
export async function detectBestBackend(): Promise<RendererBackend> {
  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    try {
      const gpu = (navigator as Navigator & { gpu: GPU }).gpu;
      const adapter = await gpu.requestAdapter();
      if (adapter) return "webgpu";
    } catch {
      // fall through to WebGL2 probe
    }
  }
  if (typeof document !== "undefined") {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2");
    if (gl) return "webgl2";
  }
  return "unavailable";
}
