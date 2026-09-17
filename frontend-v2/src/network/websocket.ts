import { parseInitMessage, parsePixelFrame, bgrToBgra, type StreamInit } from "../decoder/frameDecoder";
import { FrameQueue, type QueuedFrame } from "./frameQueue";

export interface StreamClientEvents {
  onOpen?: () => void;
  onInit?: (init: StreamInit) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
  onReconnecting?: (attempt: number, delayMs: number) => void;
}

/**
 * Connects to stream_server.py's `/ws` endpoint in pixel_mode,
 * decodes frames into VideoFrame objects, and buffers them in FrameQueue.
 */
export class StreamClient {
  private ws: WebSocket | null = null;
  private init: StreamInit | null = null;
  readonly queue: FrameQueue;
  private events: StreamClientEvents;
  private reportBacklogHandle: number | null = null;

  // Reconnection state
  private shouldReconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private lastUrl: string = "";
  private lastOpts: { cols?: number; fps?: number; startIndex?: number; codec?: string } = {};

  constructor(queueMaxDepth = 6, events: StreamClientEvents = {}) {
    this.queue = new FrameQueue(queueMaxDepth);
    this.events = events;
  }

  /**
   * @param baseUrl e.g. "ws://localhost:8000/ws"
   * @param opts.cols requested columns (default: 640)
   * @param opts.fps requested target FPS (default: 60)
   */
  connect(
    baseUrl: string,
    opts: { cols?: number; fps?: number; startIndex?: number; codec?: string } = {},
  ): void {
    this.shouldReconnect = true;
    this.lastUrl = baseUrl;
    this.lastOpts = opts;

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const url = new URL(baseUrl);
    url.searchParams.set("cols", String(opts.cols ?? 640));
    url.searchParams.set("fps", String(opts.fps ?? 60));
    url.searchParams.set("codec", opts.codec ?? "adaptive");
    if (opts.startIndex !== undefined) {
      url.searchParams.set("start_index", String(opts.startIndex));
    }

    try {
      const ws = new WebSocket(url.toString());
      ws.binaryType = "arraybuffer";
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.events.onOpen?.();
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") {
          this.handleTextMessage(ev.data);
        } else {
          this.handleBinaryFrame(ev.data as ArrayBuffer);
        }
      };

      ws.onerror = () => {
        this.events.onError?.(new Error("StreamClient: WebSocket error"));
      };

      ws.onclose = () => {
        this.stopBacklogReporting();
        this.events.onClose?.();
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.startBacklogReporting();
    } catch (err) {
      this.events.onError?.(err as Error);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    this.reconnectAttempts++;
    const delayMs = Math.min(30000, 1000 * Math.pow(1.5, this.reconnectAttempts - 1));
    this.events.onReconnecting?.(this.reconnectAttempts, delayMs);
    this.reconnectTimer = window.setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect(this.lastUrl, this.lastOpts);
      }
    }, delayMs);
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
  }

  private handleBinaryFrame(buffer: ArrayBuffer): void {
    if (!this.init) return;
    const { cols, rows, fps } = this.init;

    if (typeof VideoFrame === "undefined") {
      this.events.onError?.(
        new Error(
          "StreamClient: VideoFrame API is not supported in this browser environment. Please use a browser supporting WebCodecs.",
        ),
      );
      return;
    }

    try {
      const { frameIndex, bgr } = parsePixelFrame(buffer, cols, rows);
      const bgra = bgrToBgra(bgr, cols * rows);
      const frame = new VideoFrame(bgra.buffer, {
        format: "BGRA",
        codedWidth: cols,
        codedHeight: rows,
        timestamp: Math.round((frameIndex / fps) * 1_000_000),
      });
      const item: QueuedFrame = { frameIndex, timestampSec: frameIndex / fps, frame };
      this.queue.push(item);
    } catch (err) {
      this.events.onError?.(err as Error);
    }
  }

  /** Mirrors the server's `{type:"buffer", depth}` backpressure protocol. */
  private startBacklogReporting(): void {
    this.stopBacklogReporting();
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
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopBacklogReporting();
    this.ws?.close();
    this.ws = null;
    this.queue.clear();
  }
}
