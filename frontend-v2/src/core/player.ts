import { Pipeline } from "../renderer/Pipeline";
import type { QualitySettings, FrameMetrics } from "./types";
import { PlaybackClock } from "./clock";
import { StreamClient } from "../network/websocket";
import type { StreamInit } from "../decoder/frameDecoder";

export interface PlayerEvents {
  onMetrics?: (m: FrameMetrics) => void;
  onBackendSelected?: (backend: string) => void;
  onError?: (err: Error) => void;
  onConnectionStatus?: (status: string) => void;
}

export type PlayerMode = "local" | "live";

/**
 * Local-file and Live-stream video player.
 * In local mode, uses browser's hardware video decode via <video>.
 * In live mode, consumes raw frames from stream_server.py via StreamClient.
 */
export class Player {
  readonly pipeline = new Pipeline();
  readonly clock = new PlaybackClock();
  private videoEl: HTMLVideoElement;
  private events: PlayerEvents;
  private mode: PlayerMode = "local";
  private timeUpdateInterval: number | null = null;
  private timeUpdateListeners = new Set<(current: number, duration: number) => void>();

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

    this.startTimeUpdateLoop();
  }

  getMode(): PlayerMode {
    return this.mode;
  }

  async loadFile(file: File): Promise<void> {
    this.mode = "local";
    this.disconnectLive();
    const url = URL.createObjectURL(file);
    this.videoEl.src = url;
    await new Promise<void>((resolve, reject) => {
      this.videoEl.onloadedmetadata = () => resolve();
      this.videoEl.onerror = () => reject(new Error(`Failed to load video: ${file.name}`));
    });
  }

  async loadUrl(url: string): Promise<void> {
    this.mode = "local";
    this.disconnectLive();
    this.videoEl.src = url;
    await new Promise<void>((resolve, reject) => {
      this.videoEl.onloadedmetadata = () => resolve();
      this.videoEl.onerror = () => reject(new Error(`Failed to load video: ${url}`));
    });
  }

  play(): void {
    if (this.mode === "live") {
      this.liveClock.resumeManual();
      this.streamClient?.pause(false);
    } else {
      void this.videoEl.play();
      this.pipeline.start(this.videoEl);
    }
  }

  pause(): void {
    if (this.mode === "live") {
      this.liveClock.pauseManual();
      this.streamClient?.pause(true);
    } else {
      this.videoEl.pause();
    }
  }

  seek(seconds: number): void {
    if (this.mode === "live") {
      this.liveClock.seekManual(seconds);
      this.streamClient?.seek(seconds);
    } else {
      this.videoEl.currentTime = seconds;
    }
  }

  // ---- Live streaming (stream_server.py pixel_mode) ----
  private streamClient: StreamClient | null = null;
  private liveClock = new PlaybackClock();

  /**
   * Connects to an ASCILINE stream_server.py instance and switches the
   * pipeline into live mode.
   */
  connectLive(wsUrl: string, startIndex?: number): void {
    this.mode = "live";
    this.videoEl.pause();
    this.streamClient?.disconnect();
    const client = new StreamClient(6, {
      onOpen: () => {
        this.events.onConnectionStatus?.("CONNECTED");
      },
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
        this.events.onConnectionStatus?.("STREAMING");
      },
      onError: (err) => this.events.onError?.(err),
      onClose: () => this.events.onConnectionStatus?.("DISCONNECTED"),
      onReconnecting: (attempt, delayMs) => {
        this.events.onConnectionStatus?.(`RECONNECTING (${attempt}) in ${Math.round(delayMs / 1000)}s...`);
      },
    });
    this.streamClient = client;
    client.connect(wsUrl, { cols: 640, fps: 60, startIndex });
  }

  /**
   * Uploads a local file to stream_server.py's /upload endpoint,
   * then connects the live pipeline straight to it.
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
    if (this.mode === "live") {
      return this.streamClient?.getInit()?.durationSec || 0;
    }
    return this.videoEl.duration || 0;
  }

  get currentTime(): number {
    if (this.mode === "live") {
      return this.liveClock.currentTime;
    }
    return this.videoEl.currentTime || 0;
  }

  setVolume(vol: number): void {
    this.videoEl.volume = Math.max(0, Math.min(1, vol));
  }

  updateSettings(partial: Partial<QualitySettings>): void {
    this.pipeline.updateSettings(partial);
  }

  getSettings(): QualitySettings {
    return this.pipeline.getSettings();
  }

  onTimeUpdate(callback: (current: number, duration: number) => void): () => void {
    this.timeUpdateListeners.add(callback);
    return () => this.timeUpdateListeners.delete(callback);
  }

  private startTimeUpdateLoop(): void {
    if (typeof window === "undefined") return;
    this.timeUpdateInterval = window.setInterval(() => {
      const cur = this.currentTime;
      const dur = this.duration;
      for (const listener of this.timeUpdateListeners) {
        listener(cur, dur);
      }
    }, 250);
  }

  destroy(): void {
    if (this.timeUpdateInterval !== null) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
    this.timeUpdateListeners.clear();
    this.disconnectLive();
    this.pipeline.destroy();
    this.videoEl.pause();
    this.videoEl.removeAttribute("src");
    this.videoEl.load();
  }
}
