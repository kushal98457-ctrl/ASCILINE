// ASCILINE V2 — binary/text protocol decoding for the existing stream_server.py
// WebSocket protocol. This intentionally mirrors what the server actually
// sends today (see stream_server.py's `pixel_mode` branch and the `INIT:`
// text message), not the more elaborate versioned-header protocol sketched
// in the original planning doc — the server's real wire format is simpler:
// a 4-byte big-endian frame-index header followed by raw BGR bytes.
//
// All functions here are pure (no WebSocket, no DOM) so they're unit-testable.

export interface StreamInit {
  fps: number;
  renderMode: number;
  cols: number;
  rows: number;
  pixelMode: boolean;
  queueIndex: number;
  durationSec: number;
  seekTargetSec: number;
  isWebcam: boolean;
}

/**
 * Parses the server's `INIT:...` text control message.
 * Format: INIT:{fps}:{renderMode}:{cols}:{rows}:{pixel 0|1}:{queueIndex}:{durationSec}:{seekTargetSec}:{isWebcam 0|1}
 */
export function parseInitMessage(text: string): StreamInit {
  if (!text.startsWith("INIT:")) {
    throw new Error(`parseInitMessage: not an INIT message: ${text.slice(0, 32)}`);
  }
  const parts = text.slice("INIT:".length).split(":");
  if (parts.length < 9) {
    throw new Error(`parseInitMessage: expected 9 fields, got ${parts.length}: ${text}`);
  }
  const num = (s: string | undefined, field: string): number => {
    const v = Number(s);
    if (s === undefined || Number.isNaN(v)) throw new Error(`parseInitMessage: bad field '${field}': ${s}`);
    return v;
  };
  return {
    fps: num(parts[0], "fps"),
    renderMode: num(parts[1], "renderMode"),
    cols: num(parts[2], "cols"),
    rows: num(parts[3], "rows"),
    pixelMode: parts[4] === "1",
    queueIndex: num(parts[5], "queueIndex"),
    durationSec: num(parts[6], "durationSec"),
    seekTargetSec: num(parts[7], "seekTargetSec"),
    isWebcam: parts[8] === "1",
  };
}

export interface DecodedPixelFrame {
  frameIndex: number;
  /** Raw BGR or BGRA bytes. */
  bgr: Uint8Array;
}

/**
 * Parses one binary WebSocket message from a pixel_mode stream:
 * 4-byte big-endian frame index, followed by raw pixel bytes.
 */
export function parsePixelFrame(buffer: ArrayBuffer, cols: number, rows: number): DecodedPixelFrame {
  const expectedBgr = 4 + cols * rows * 3;
  const expectedBgra = 4 + cols * rows * 4;
  if (buffer.byteLength !== expectedBgr && buffer.byteLength !== expectedBgra) {
    throw new Error(
      `parsePixelFrame: size mismatch (got ${buffer.byteLength} bytes, expected ${expectedBgr} for ${cols}x${rows})`,
    );
  }
  const view = new DataView(buffer);
  const frameIndex = view.getUint32(0, false); // big-endian, matches struct.pack_into(">I", ...)
  const bgr = new Uint8Array(buffer, 4);
  return { frameIndex, bgr };
}

/**
 * Expands packed BGR (3 bytes/pixel) to BGRA (4 bytes/pixel, alpha=255) using
 * 32-bit words for optimal performance. If server emits BGRA directly, returns without copy.
 */
export function bgrToBgra(bgr: Uint8Array, pixelCount: number): Uint8Array {
  if (bgr.length === pixelCount * 4) {
    return bgr;
  }
  const out = new Uint8Array(pixelCount * 4);
  const out32 = new Uint32Array(out.buffer);
  for (let i = 0; i < pixelCount; i++) {
    const s = i * 3;
    out32[i] = (bgr[s] ?? 0) | ((bgr[s + 1] ?? 0) << 8) | ((bgr[s + 2] ?? 0) << 16) | 0xff000000;
  }
  return out;
}
