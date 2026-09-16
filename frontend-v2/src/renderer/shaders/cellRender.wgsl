// ASCILINE V2 — cell render pass.
// Draws one instanced quad per character cell, positioned in NDC space and
// textured from the character atlas using the glyph index chosen by
// cellCompute.wgsl. Runs entirely on the GPU: no per-character DOM nodes,
// no per-character JS fillText calls.

struct RenderParams {
  cols: u32,
  rows: u32,
  atlasCols: u32,
  atlasRows: u32,
  backgroundColor: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> cells: array<vec2<u32>>;
@group(0) @binding(1) var<uniform> rp: RenderParams;
@group(0) @binding(2) var atlasTex: texture_2d<f32>;
@group(0) @binding(3) var atlasSampler: sampler;

struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) atlasUv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

// Unit quad, two triangles, in [0,1] local space.
const QUAD: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
  vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0),
  vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0)
);

fn unpackColor(word1: u32) -> vec4<f32> {
  let r = f32((word1 >> 16u) & 0xFFu) / 255.0;
  let g = f32((word1 >> 8u) & 0xFFu) / 255.0;
  let b = f32(word1 & 0xFFu) / 255.0;
  return vec4<f32>(r, g, b, 1.0);
}

@vertex
fn vs_main(@builtin(vertex_index) vIdx: u32, @builtin(instance_index) iIdx: u32) -> VSOut {
  let col = iIdx % rp.cols;
  let row = iIdx / rp.cols;
  let local = QUAD[vIdx];

  // Cell origin/size in NDC (-1..1), Y flipped so row 0 is top of screen.
  let cellW = 2.0 / f32(rp.cols);
  let cellH = 2.0 / f32(rp.rows);
  let originX = -1.0 + f32(col) * cellW;
  let originY = 1.0 - f32(row) * cellH;

  let ndc = vec2<f32>(originX + local.x * cellW, originY - local.y * cellH);

  let packed = cells[iIdx];
  let charIndex = packed.x & 0xFFu;
  let atlasCol = charIndex % rp.atlasCols;
  let atlasRow = charIndex / rp.atlasCols;
  let uvOrigin = vec2<f32>(f32(atlasCol) / f32(rp.atlasCols), f32(atlasRow) / f32(rp.atlasRows));
  let uvSize = vec2<f32>(1.0 / f32(rp.atlasCols), 1.0 / f32(rp.atlasRows));

  var out: VSOut;
  out.position = vec4<f32>(ndc, 0.0, 1.0);
  out.atlasUv = uvOrigin + local * uvSize;
  out.color = unpackColor(packed.y);
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let glyphMask = textureSample(atlasTex, atlasSampler, in.atlasUv).a;
  return mix(rp.backgroundColor, in.color, glyphMask);
}
