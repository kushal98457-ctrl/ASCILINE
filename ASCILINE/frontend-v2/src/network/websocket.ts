import { parseInitMessage, parsePixelFrame, bgrToBgra, type StreamInit } from "../decoder/frameDecoder";
import { FrameQueue, type QueuedFrame } from "./frameQueue";

export interface StreamClientEvents {
  onInit?: (init: StreamInit) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
}

/**
 * Connects to stream_server.py's existing `/ws` endpoint in pixel_mode,
 * decodes the raw-BGR binary protocol into VideoFrame objects, and buffers
 * them in a bounded FrameQueue. This is the integration point the
 * frontend-v2 README flagged as not-yet-built — the renderer side needed
 * no changes since Pipeline/renderFrame already accept VideoFrame.
 *
 * Deliberately reuses pixel_mode rather than inventing a new server mode:
 * it already streams full-resolution raw frames server-side (see
 * calc_auto_dimensions's MAX_ROWS=1080 for pixel_mode), so the only gap was
 * the client never asking for high columns/fps and never decoding the
 * result as anything other than <canvas> fillRect calls.
 */
export class StreamClient {
  private ws: WebSocket | null = null;
  private init: StreamInit | null = null;
  readonly queue: FrameQueue;
  private events: StreamClientEvents;
  private frameIndexCounter = 0;
  private reportBacklogHandle: number | null = null;

  constructor(queueMaxDepth = 6, events: StreamClientEvents = {}) {
    this.queue = new FrameQueue(queueMaxDepth);
    this.events = events;
  }

  /**
   * @param baseUrl e.g. "ws://localhost:8000/ws"
   * @param opts.cols requested source-resolution columns (server clamps to 1920)
   * @param opts.fps requested target FPS (server clamps to 1-60)
   */
  connect(baseUrl: string, opts: { cols?: number; fps?: number; startIndex?: number } = {}): void {
    const url = new URL(baseUrl);
    url.searchParams.set("cols", String(opts.cols ?? 1920));
    url.searchParams.set("fps", String(opts.fps ?? 60));
    if (opts.startIndex !== undefined) {
      url.searchParams.set("start_index", String(opts.startIndex));
    }
    // Server only honors cols/fps overrides when the queue entry is already
    // in pixel_mode (see stream_server.py) — that's a playlist/CLI-side
    // config, not something this client can force, so a misconfigured
    // server-side entry will simply be ignored, not silently corrupted.

    const ws = new WebSocket(url.toString());
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        this.handleTextMessage(ev.data);
      } else {
        this.handleBinaryFrame(ev.data as ArrayBuffer);
      }
    };
    ws.onerror = () => this.events.onError?.(new Error("StreamClient: WebSocket error"));
    ws.onclose = () => {
      this.stopBacklogReporting();
      this.events.onClose?.();
    };

    this.startBacklogReporting();
  }

  private handleTextMessage(text: string): void {
    if (text.startsWith("INIT:")) {
      try {
        this.init = parseInitMessage(text);
        this.events.onInit?.(this.init);
      } catch (err) {
        this.events.onError?.(err as Error);
      }
    } else if (text.startsWith("Error:")) {
      this.events.onError?.(new Error(text));
    }
    // Other control text (filter acks, etc.) is intentionally ignored here —
    // this client only cares about the raw-frame path, not the ASCII/text UI.
  }

  private handleBinaryFrame(buffer: ArrayBuffer): void {
    if (!this.init) return; // frame arrived before INIT; drop (shouldn't happen)
    const { cols, rows, fps } = this.init;
    try {
      const { frameIndex, bgr } = parsePixelFrame(buffer, cols, rows);
      const bgra = bgrToBgra(bgr, cols * rows);
      const frame = new VideoFrame(bgra.buffer, {
        format: "BGRA",
        codedWidth: cols,
        codedHeight: rows,
        timestamp: Math.round((frameIndex / fps) * 1_000_000), // VideoFrame timestamp is µs
      });
      const item: QueuedFrame = { frameIndex, timestampSec: frameIndex / fps, frame };
      this.queue.push(item);
      this.frameIndexCounter = frameIndex;
    } catch (err) {
      this.events.onError?.(err as Error);
    }
  }

  /** Mirrors the server's `{type:"buffer", depth}` backpressure protocol. */
  private startBacklogReporting(): void {
    this.reportBacklogHandle = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "buffer", depth: this.queue.depth() }));
      }
    }, 500);
  }

  private stopBacklogReporting(): void {
    if (this.reportBacklogHandle !== null) {
      window.clearInterval(this.reportBacklogHandle);
      this.reportBacklogHandle = null;
    }
  }

  pause(paused: boolean): void {
    this.send({ type: "pause", paused });
  }

  seek(timeSec: number): void {
    this.send({ type: "seek", time: timeSec });
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  getInit(): StreamInit | null {
    return this.init;
  }

  disconnect(): void {
    this.stopBacklogReporting();
    this.ws?.close();
    this.ws = null;
    this.queue.clear();
  }
}
