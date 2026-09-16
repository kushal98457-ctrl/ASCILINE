import { describe, it, expect } from "vitest";
import { parseInitMessage, parsePixelFrame, bgrToBgra } from "../src/decoder/frameDecoder";

describe("parseInitMessage", () => {
  it("parses a well-formed INIT message matching stream_server.py's format", () => {
    const msg = "INIT:60:2:640:360:1:0:123.456:0:0";
    const init = parseInitMessage(msg);
    expect(init).toEqual({
      fps: 60,
      renderMode: 2,
      cols: 640,
      rows: 360,
      pixelMode: true,
      queueIndex: 0,
      durationSec: 123.456,
      seekTargetSec: 0,
      isWebcam: false,
    });
  });

  it("interprets pixel/webcam flags as booleans from '0'/'1'", () => {
    const init = parseInitMessage("INIT:30:1:200:100:0:2:10:5:1");
    expect(init.pixelMode).toBe(false);
    expect(init.isWebcam).toBe(true);
  });

  it("throws on a message missing the INIT: prefix", () => {
    expect(() => parseInitMessage("Error: something broke")).toThrow();
  });

  it("throws on a message with too few fields", () => {
    expect(() => parseInitMessage("INIT:60:2:640")).toThrow();
  });

  it("throws on a non-numeric field instead of silently producing NaN", () => {
    expect(() => parseInitMessage("INIT:sixty:2:640:360:1:0:123:0:0")).toThrow();
  });
});

describe("parsePixelFrame", () => {
  function buildFrame(frameIndex: number, cols: number, rows: number): ArrayBuffer {
    const buf = new ArrayBuffer(4 + cols * rows * 3);
    const view = new DataView(buf);
    view.setUint32(0, frameIndex, false);
    const bytes = new Uint8Array(buf, 4);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    return buf;
  }

  it("parses frame index (big-endian) and BGR payload for a matching grid", () => {
    const buf = buildFrame(42, 4, 3);
    const { frameIndex, bgr } = parsePixelFrame(buf, 4, 3);
    expect(frameIndex).toBe(42);
    expect(bgr.length).toBe(4 * 3 * 3);
    expect(bgr[0]).toBe(0);
    expect(bgr[1]).toBe(1);
  });

  it("throws on a size mismatch instead of misinterpreting stale bytes", () => {
    const buf = buildFrame(1, 4, 3);
    expect(() => parsePixelFrame(buf, 10, 10)).toThrow(/size mismatch/);
  });
});

describe("bgrToBgra", () => {
  it("expands BGR triples to BGRA quads with alpha=255", () => {
    const bgr = new Uint8Array([10, 20, 30, /* pixel 2 */ 40, 50, 60]);
    const bgra = bgrToBgra(bgr, 2);
    expect(Array.from(bgra)).toEqual([10, 20, 30, 255, 40, 50, 60, 255]);
  });

  it("produces exactly pixelCount*4 bytes", () => {
    const bgr = new Uint8Array(9); // 3 pixels
    const bgra = bgrToBgra(bgr, 3);
    expect(bgra.length).toBe(12);
  });
});
