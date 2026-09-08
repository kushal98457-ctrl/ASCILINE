# ASCILINE V2 — GPU ASCII Rendering Engine

A GPU-first rewrite of ASCILINE's rendering path: WebGPU primary, WebGL2
fallback, character-atlas compositing, true color, dithering, edge
detection, and temporal stabilization — all running on the GPU, once per
frame, with no per-pixel CPU/Python loop and no per-character DOM nodes.

This module is additive. It does not modify or remove the existing
`stream_server.py` / `app.js` live-streaming system, `compiler.py`/`.ascf`
static player, or the terminal player — all of that keeps working exactly
as before. See **Relationship to V1** below for how the two fit together.

## Setup

```bash
cd frontend-v2
npm install
npm run dev       # http://localhost:5183 — pick a local video file to play
npm run typecheck
npm test          # vitest, pure-logic unit tests (no GPU required)
npm run build      # tsc --noEmit && vite build -> dist/
```

Requires a WebGPU-capable browser (Chrome/Edge 113+, or a browser with the
`webgpu` flag enabled) for the primary path. Any WebGL2-capable browser gets
the fallback renderer automatically — there is no separate build or flag.

## Architecture

```
<video> element (browser hardware decode)
        │
        ▼
 Pipeline.renderFrame(videoEl)      [renderer/Pipeline.ts]
        │
        ├── WebGPU available? ──▶ WebGPURenderer
        │                          ├─ cellCompute.wgsl  (compute pass)
        │                          │    downsample → luminance → edges →
        │                          │    dither → char index → temporal
        │                          │    stabilize → packed cell buffer
        │                          └─ cellRender.wgsl   (render pass)
        │                               instanced quad per cell, atlas
        │                               lookup, tint by sampled color
        │
        └── else ───────────────▶ WebGLRenderer (WebGL2)
                                    ├─ cellDecode.frag.glsl   (pass 1, low-res FBO)
                                    │    same algorithm as cellCompute.wgsl,
                                    │    expressed as a fragment shader since
                                    │    WebGL2 has no compute shaders
                                    └─ cellComposite.frag.glsl (pass 2, full-res)
                                         fullscreen pass, atlas lookup

CharacterAtlas.ts — builds the glyph texture (Canvas2D, once per
                     character-set change, not per frame) shared by both backends.
performance.ts     — rolling FPS/frame-time tracker + adaptive quality
                      controller (resolution → edges → dithering → temporal,
                      in that priority order, per spec).
clock.ts            — PTS-driven playback position (videoEl.currentTime),
                      no sleep()-based frame pacing.
player.ts           — wires <video> + Pipeline + UI together.
```

### Why `<video>` instead of reimplementing FFmpeg decode in the browser

The architectural rule from the spec is: decode stays off the GPU-ASCII
critical path, and off Python's per-pixel path. For **local/URL playback**,
the browser's own `<video>` element already gives us hardware-accelerated
decode for free, with zero additional dependencies — so `Player` uses it
directly and hands frames to the renderer via `GPUExternalTexture`
(WebGPU) / `texImage2D(video)` (WebGL2), both of which are zero-copy or
near-zero-copy paths on most drivers.

For the **live-streaming** case (`stream_server.py` over WebSocket), decode
still happens server-side via FFmpeg/OpenCV as today; see **Relationship to
V1** for the integration point that isn't built yet.

## What's implemented

- WebGPU renderer: compute pass (downsample/luminance/edge/dither/temporal) +
  instanced render pass (character atlas compositing), triple-buffer-free
  double-buffered cell storage (ping-pong for temporal stabilization).
- WebGL2 fallback: same algorithm, two-pass fragment-shader implementation
  (no compute shaders available in WebGL2).
- Character atlas generation (Canvas2D → GPU texture), configurable ramps
  (`minimal`/`classic`/`dense`/`extended`/`blocks`, or custom).
- True Color / 256-color / grayscale color modes.
- GPU Sobel edge detection (off/low/medium/high).
- GPU ordered (Bayer 4×4) dithering, toggleable.
- Temporal stabilization via hysteresis on the discrete character choice
  (off/low/medium/high) — motion itself is never delayed, only flicker on
  near-threshold luminance is damped.
- Adaptive quality: resolution → edge detection → dithering → temporal, in
  that priority order, with hysteresis to avoid oscillation (see
  `core/performance.ts`, unit-tested in `tests/performance.test.ts`).
- Performance overlay (FPS, frame time, resolution, renderer, dropped
  frames, queue depth, estimated latency, memory estimate).
- Aspect-ratio-correct grid sizing accounting for non-square glyph cells
  (unit-tested in `tests/types.test.ts`).
- Graceful backend detection (WebGPU → WebGL2 → explicit error if neither
  is available — never a silent black canvas).

## Live streaming (stream_server.py integration)

`network/websocket.ts` (`StreamClient`) connects to the existing `/ws`
endpoint's `pixel_mode` stream — no new server mode was invented; pixel_mode
already sends full-resolution raw BGR frames (`calc_auto_dimensions` allows
up to 1080 rows in pixel mode), it just wasn't decoded as anything other
than `<canvas>` `fillRect` calls before. Two small, additive, opt-in changes
were made to `stream_server.py`:

- `?cols=N` — per-connection column override (clamped 16–1920), only read
  when the queue entry is already in `pixel_mode`. Doesn't mutate the shared
  `entry` dict, so other clients on the same queue are unaffected.
- `?fps=N` — per-connection `MAX_FPS` override (clamped 1–60), replacing the
  hardcoded `30`. Same pixel-mode-only gating.

`decoder/frameDecoder.ts` parses the server's actual wire format (a 4-byte
big-endian frame index + raw BGR payload, and the `INIT:...` text message) —
pure functions, unit-tested against the real byte layout in
`tests/frameDecoder.test.ts`. `network/frameQueue.ts` is the bounded 3–8
frame queue from the spec, with drop-oldest backpressure and
newest-frame-wins timestamp-based popping, unit-tested in
`tests/frameQueue.test.ts`. `Pipeline.startLive()` drives the render loop
from this queue using `PlaybackClock`'s manual (PTS-based, not
`setInterval`) mode; `Player.connectLive(wsUrl)` wires it all together and
is exposed in the demo UI's "Connect live stream" field.

**What this doesn't do**: `StreamClient` still reports backlog depth via the
existing `{type:"buffer", depth}` JSON message so the server's real
backpressure/frame-drop logic applies, but no automated integration test
exercises an actual server round-trip (that needs a running `stream_server.py`
instance, not just unit tests) — flagged as follow-up, not faked.

## What's NOT implemented yet (honest gap list)

- **Braille and Block render modes.** The pipeline and atlas system support
  arbitrary character ramps (`blocks` ramp already exists in
  `CHARACTER_SETS`), but Braille's "multiple source samples packed into one
  Unicode cell" addressing scheme needs its own compute/fragment variant,
  not just a different ramp — not yet written.
- **Pixel mode** (direct colored-block output bypassing character mapping
  entirely) — straightforward given the existing pipeline, not yet wired
  into `RenderMode`.
- **GPU timestamp queries** for true GPU frame time — `renderFrame()` has
  the return-value slot for it, but the query-set/resolve plumbing is
  omitted; CPU-side timing in `performance.ts` covers the adaptive-quality
  loop in the meantime.
- **Sharpening pass** — flagged in `QualitySettings` but not yet applied in
  either shader.
- **GPU device-loss recovery UI**, WebSocket reconnect, and the rest of the
  Phase 8 hardening list (structured logging, Docker packaging for this
  module, full integration test matrix across 720p30/1080p30/1080p60).
- **Formal benchmark suite** (the spec's `experiments/`-style harness across
  resolutions × render modes recording avg/1%-low FPS, CPU/GPU/RAM). What
  exists today is the live on-screen performance overlay; automated,
  recorded benchmark runs are not built.

## Relationship to V1 (existing repo)

The Phase 1 audit (see conversation) found the existing backend
(`stream_server.py`) is already well-optimized for its CPU/Canvas2D
target — vectorized NumPy, LUT-based character mapping, thread-offloaded
encode, a real adaptive delta/RLE/DCT codec, and backpressure-aware frame
dropping. It was **not** rewritten, per the "don't rewrite blindly" 
directive, because none of that is the bottleneck for the new GPU path.

The actual bottleneck for 1080p60 was the **client-side `fillText`-per-cell
loop** in `app.js`, which this module replaces for local/URL playback *and*
for live streaming (see **Live streaming** below). The backend's hard caps
(`MAX_FPS = 30`, `MAX_ROWS = 300` for ASCII mode in `calc_auto_dimensions`)
exist specifically because of that client-side cost, and are **unchanged
for the ASCII/text render path** — those clients still get the original
30 FPS / 300-row ceiling, byte-for-byte the same behavior as before. The
only new behavior is an opt-in `?cols=`/`?fps=` override that a GPU client
can request, gated to `pixel_mode` connections only, since that's the one
path a GPU renderer actually consumes.

## Testing

`tests/` covers pure logic with Vitest (no GPU/DOM dependency, runs in CI
without a browser):
- `types.test.ts` — grid dimension math for landscape/portrait/square video,
  including degenerate-input error handling.
- `atlas.test.ts` — glyph UV-rect math, including out-of-range clamping.
- `performance.test.ts` — adaptive-quality step-down/step-up priority order
  and floor/ceiling behavior.

Renderer-integration tests (actually driving a WebGPU/WebGL2 context) need
a browser test runner (e.g. Playwright with `--enable-unsafe-webgpu`) and
are not set up here — flagged as follow-up work rather than faked.
