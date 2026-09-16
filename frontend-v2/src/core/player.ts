import { Pipeline } from "../renderer/Pipeline";
import type { QualitySettings, FrameMetrics } from "./types";
import { PlaybackClock } from "./clock";
import { StreamClient } from "../network/websocket";
import type { StreamInit } from "../decoder/frameDecoder";

export interface PlayerEvents {
  onMetrics?: (m: FrameMetrics) => void;
  onBackendSelected?: (backend: string) => void;
  onError?: (err: Error) => void;
}

/**
 * Local-file player: uses the browser's own hardware video decoding via
 * <video>, and hands decoded frames to the Pipeline for GPU ASCII rendering.
 * This intentionally does NOT reimplement video decode in JS/WASM — per the
 * architecture rule, decode stays someone else's job (here: the browser;
 * in the streaming path, the FFmpeg-backed backend) so the GPU pipeline only
 * ever does image processing + rendering.
 */
export class Player {
  readonly pipeline = new Pipeline();
  readonly clock = new PlaybackClock();
  private videoEl: HTMLVideoElement;
  private events: PlayerEvents;

  constructor(canvas: HTMLCanvasElement, events: PlayerEvents = {}) {
    this.events = events;
    this.videoEl = document.createElement("video");
    this.videoEl.muted = false;
    this.videoEl.playsInline = true;
    this.videoEl.crossOrigin = "anonymous";
    this.clock.attach(this.videoEl);

    this.pipeline.onMetrics((m) => this.events.onMetrics?.(m));

    canvas.width = 1920;
    canvas.height = 1080;
    this.pipeline
      .init(canvas)
      .then((backend) => this.events.onBackendSelected?.(backend))
      .catch((err) => this.events.onError?.(err));
  }

  async loadFile(file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    this.videoEl.src = url;
    await new Promise<void>((resolve, reject) => {
      this.videoEl.onloadedmetadata = () => resolve();
      this.videoEl.onerror = () => reject(new Error(`Failed to load video: ${file.name}`));
    });
  }

  async loadUrl(url: string): Promise<void> {
    this.videoEl.src = url;
    await new Promise<void>((resolve, reject) => {
      this.videoEl.onloadedmetadata = () => resolve();
      this.videoEl.onerror = () => reject(new Error(`Failed to load video: ${url}`));
    });
  }

  play(): void {
    void this.videoEl.play();
    this.pipeline.start(this.videoEl);
  }

  pause(): void {
    this.videoEl.pause();
    this.streamClient?.pause(true);
  }

  seek(seconds: number): void {
    this.videoEl.currentTime = seconds;
    this.streamClient?.seek(seconds);
  }

  // ---- Live streaming (stream_server.py pixel_mode) ----
  private streamClient: StreamClient | null = null;
  private liveClock = new PlaybackClock();

  /**
   * Connects to an ASCILINE stream_server.py instance and switches the
   * pipeline into live mode. Requests full source resolution (server clamps
   * to 1920) and 60 FPS (server clamps to 60) — see the `cols`/`fps` opt-in
   * query params added to stream_server.py's /ws endpoint.
   * `startIndex` jumps straight to a specific queue entry (see uploadAndConnectLive).
   */
  connectLive(wsUrl: string, startIndex?: number): void {
    this.streamClient?.disconnect();
    const client = new StreamClient(6, {
      onInit: (init: StreamInit) => {
        if (!init.pixelMode) {
          this.events.onError?.(
            new Error(
              "connectLive: server queue entry is not in pixel_mode — the GPU renderer needs raw frames, " +
                "not ASCII text/color-cell encoding. Set \"pixel\": true on the playlist/CLI entry.",
            ),
          );
          return;
        }
        this.liveClock.startManual(0);
        this.pipeline.startLive(client, this.liveClock);
      },
      onError: (err) => this.events.onError?.(err),
    });
    this.streamClient = client;
    client.connect(wsUrl, { cols: 1920, fps: 60, startIndex });
  }

  /**
   * Uploads a local file (picked from the user's PC) to stream_server.py's
   * /upload endpoint, then connects the live pipeline straight to it.
   * `httpBaseUrl` e.g. "http://localhost:8000", `wsUrl` e.g. "ws://localhost:8000/ws".
   */
  async uploadAndConnectLive(file: File, httpBaseUrl: string, wsUrl: string): Promise<void> {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${httpBaseUrl.replace(/\/$/, "")}/upload`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`Upload failed (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as { queued_index: number; filename: string };
    this.connectLive(wsUrl, data.queued_index);
  }

  disconnectLive(): void {
    this.streamClient?.disconnect();
    this.streamClient = null;
  }

  get duration(): number {
    return this.videoEl.duration || 0;
  }

  get currentTime(): number {
    return this.videoEl.currentTime;
  }

  setVolume(vol: number): void {
    this.videoEl.volume = Math.max(0, Math.min(1, vol));
    // Optionally trigger stream_server audio adjustment here if supported
  }

  updateSettings(partial: Partial<QualitySettings>): void {
    this.pipeline.updateSettings(partial);
  }

  getSettings(): QualitySettings {
    return this.pipeline.getSettings();
  }

  destroy(): void {
    this.pipeline.destroy();
    this.videoEl.pause();
    this.videoEl.removeAttribute("src");
    this.videoEl.load();
  }
}
