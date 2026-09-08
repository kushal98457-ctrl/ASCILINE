// ASCILINE V2 — cell compute pass.
// One invocation per output character cell. Samples the source video frame,
// derives luminance/color/edge strength, applies dithering, maps to a
// character index, and stabilizes against the previous frame's decision to
// reduce flicker. Writes a packed cell record consumed by cellRender.wgsl.
//
// This is the piece of the pipeline that replaces per-pixel Python iteration
// entirely: the whole grid (up to hundreds of thousands of cells at 480
// columns) is processed in parallel on the GPU, once per frame.

struct Params {
  cols: u32,
  rows: u32,
  rampLength: u32,
  videoWidth: u32,
  videoHeight: u32,
  ditherEnabled: u32,   // 0/1
  edgeLevel: u32,       // 0=off 1=low 2=medium 3=high
  temporalLevel: u32,   // 0=off 1=low 2=medium 3=high
  colorMode: u32,       // 0=grayscale 1=color256 2=truecolor
  frameIndex: u32,
};

@group(0) @binding(0) var videoTex: texture_external;
@group(0) @binding(1) var videoSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
// Packed as 2x u32 per cell: word0 = charIndex (low 8 bits) | edgeBoost (next 8),
// word1 = packed RGBA8 color (r,g,b,a each 8 bits).
@group(0) @binding(3) var<storage, read_write> cellsOut: array<vec2<u32>>;
@group(0) @binding(4) var<storage, read> cellsPrev: array<vec2<u32>>;

const BAYER_4X4: array<f32, 16> = array<f32, 16>(
  0.0/16.0, 8.0/16.0, 2.0/16.0, 10.0/16.0,
  12.0/16.0, 4.0/16.0, 14.0/16.0, 6.0/16.0,
  3.0/16.0, 11.0/16.0, 1.0/16.0, 9.0/16.0,
  15.0/16.0, 7.0/16.0, 13.0/16.0, 5.0/16.0
);

fn luminance(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn sampleLuma(uv: vec2<f32>) -> f32 {
  let c = textureSampleBaseClampToEdge(videoTex, videoSampler, uv).rgb;
  return luminance(c);
}

fn packColor(c: vec3<f32>) -> u32 {
  let r = u32(clamp(c.r, 0.0, 1.0) * 255.0);
  let g = u32(clamp(c.g, 0.0, 1.0) * 255.0);
  let b = u32(clamp(c.b, 0.0, 1.0) * 255.0);
  return (r << 16u) | (g << 8u) | b | (255u << 24u);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.cols || gid.y >= params.rows) {
    return;
  }
  let cellIndex = gid.y * params.cols + gid.x;

  // Cell center in normalized video UV space (0..1). Video is already the
  // full source resolution; we're doing the downsample here on the GPU
  // instead of pre-resizing on the CPU.
  let cellUv = vec2<f32>(
    (f32(gid.x) + 0.5) / f32(params.cols),
    (f32(gid.y) + 0.5) / f32(params.rows)
  );

  let baseColor = textureSampleBaseClampToEdge(videoTex, videoSampler, cellUv).rgb;
  var luma = luminance(baseColor);

  // ---- Edge detection (Sobel over cell-sized steps) ----
  var edgeStrength = 0.0;
  if (params.edgeLevel > 0u) {
    let stepUv = vec2<f32>(1.0 / f32(params.cols), 1.0 / f32(params.rows));
    let tl = sampleLuma(cellUv + vec2<f32>(-stepUv.x, -stepUv.y));
    let tC = sampleLuma(cellUv + vec2<f32>(0.0, -stepUv.y));
    let tr = sampleLuma(cellUv + vec2<f32>(stepUv.x, -stepUv.y));
    let mL = sampleLuma(cellUv + vec2<f32>(-stepUv.x, 0.0));
    let mR = sampleLuma(cellUv + vec2<f32>(stepUv.x, 0.0));
    let bl = sampleLuma(cellUv + vec2<f32>(-stepUv.x, stepUv.y));
    let bC = sampleLuma(cellUv + vec2<f32>(0.0, stepUv.y));
    let br = sampleLuma(cellUv + vec2<f32>(stepUv.x, stepUv.y));
    let gx = (tr + 2.0 * mR + br) - (tl + 2.0 * mL + bl);
    let gy = (bl + 2.0 * bC + br) - (tl + 2.0 * tC + tr);
    edgeStrength = clamp(sqrt(gx * gx + gy * gy), 0.0, 1.0);
    let edgeGain = select(select(select(0.0, 0.4, params.edgeLevel == 1u), 0.7, params.edgeLevel == 2u), 1.0, params.edgeLevel == 3u);
    luma = clamp(luma + edgeStrength * edgeGain, 0.0, 1.0);
  }

  // ---- Ordered dithering ----
  if (params.ditherEnabled == 1u) {
    let bx = gid.x % 4u;
    let by = gid.y % 4u;
    let threshold = BAYER_4X4[by * 4u + bx];
    // Spread quantization error across the ramp's own step size so dithering
    // scales with ramp resolution rather than always being +-1/16.
    let stepSize = 1.0 / f32(params.rampLength);
    luma = clamp(luma + (threshold - 0.5) * stepSize, 0.0, 1.0);
  }

  var charIndex = u32(round(luma * f32(params.rampLength - 1u)));
  charIndex = min(charIndex, params.rampLength - 1u);

  // ---- Temporal stabilization ----
  // Hysteresis: only accept a new character if the underlying luma moved
  // more than a level-dependent threshold, otherwise keep last frame's pick.
  // This intentionally does NOT blend/ghost the *rendered* frame — only the
  // discrete character choice is stabilized, so motion itself is never delayed.
  if (params.temporalLevel > 0u && params.frameIndex > 0u) {
    let prevWord0 = cellsPrev[cellIndex].x;
    let prevChar = prevWord0 & 0xFFu;
    let diff = abs(i32(charIndex) - i32(prevChar));
    let threshold = select(select(select(0, 1, params.temporalLevel == 1u), 2, params.temporalLevel == 2u), 3, params.temporalLevel == 3u);
    if (diff <= threshold) {
      charIndex = prevChar;
    }
  }

  let edgeBoost = u32(clamp(edgeStrength, 0.0, 1.0) * 255.0);
  let word0 = (charIndex & 0xFFu) | (edgeBoost << 8u);

  var outColor = baseColor;
  if (params.colorMode == 0u) {
    outColor = vec3<f32>(luma, luma, luma);
  } else if (params.colorMode == 1u) {
    // 256-color-ish: quantize to 6 levels per channel (RGB332-adjacent).
    outColor = floor(baseColor * 5.0 + 0.5) / 5.0;
  }
  let word1 = packColor(outColor);

  cellsOut[cellIndex] = vec2<u32>(word0, word1);
}
