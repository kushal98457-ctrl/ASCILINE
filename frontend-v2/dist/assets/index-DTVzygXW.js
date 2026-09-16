(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))r(s);new MutationObserver(s=>{for(const i of s)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&r(o)}).observe(document,{childList:!0,subtree:!0});function t(s){const i={};return s.integrity&&(i.integrity=s.integrity),s.referrerPolicy&&(i.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?i.credentials="include":s.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function r(s){if(s.ep)return;s.ep=!0;const i=t(s);fetch(s.href,i)}})();class w extends Error{constructor(e,t){super(`${e} unavailable: ${t}`),this.name="RendererUnavailableError"}}async function re(){if(typeof navigator<"u"&&"gpu"in navigator)try{if(await navigator.gpu.requestAdapter())return"webgpu"}catch{}return typeof document<"u"&&document.createElement("canvas").getContext("webgl2")?"webgl2":"unavailable"}const A={minimal:" .:-=+*#%@",classic:" .:-=+*#%@$",dense:" `.'\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",extended:" `.-':_,^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@",blocks:" ░▒▓█"};function $(n){return n.characterSet==="custom"&&n.customRamp?n.customRamp:A[n.characterSet]??A.classic??" .:-=+*#%@"}const k={renderMode:"ascii",colorMode:"truecolor",columns:320,targetFps:60,dithering:!1,edgeDetection:"off",temporalStabilization:"medium",sharpening:!0,adaptiveQuality:!0,characterSet:"classic"},y=[480,400,320,280,240,200,160];function T(n,e,t,r=.55){if(n<=0||e<=0||t<=0)throw new RangeError(`computeGridDimensions: invalid input (w=${n}, h=${e}, cols=${t})`);const s=n/e,i=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(i/s/r));return{cols:i,rows:o,cellWidthPx:0,cellHeightPx:0}}async function H(n,e={}){if(n.length===0)throw new RangeError("buildCharacterAtlas: ramp must contain at least one character");const t=e.glyphPxHeight??32,r=Math.round(t*.6),s=e.fontFamily??"'Courier New', monospace",i=e.weight??"bold",o=n.length,a=Math.ceil(Math.sqrt(o)),h=Math.ceil(o/a),c=document.createElement("canvas");c.width=a*r,c.height=h*t;const u=c.getContext("2d");if(!u)throw new Error("buildCharacterAtlas: 2D context unavailable");u.clearRect(0,0,c.width,c.height),u.fillStyle="#ffffff",u.font=`${i} ${Math.round(t*.85)}px ${s}`,u.textAlign="center",u.textBaseline="middle";for(let f=0;f<o;f++){const b=f%a,v=Math.floor(f/a),g=b*r+r/2,te=v*t+t/2,I=n[f];I!==void 0&&I!==" "&&u.fillText(I,g,te)}return{bitmap:await createImageBitmap(c),glyphCount:o,glyphPxWidth:r,glyphPxHeight:t,atlasCols:a,atlasRows:h,ramp:n}}const ne=`// ASCILINE V2 — cell compute pass.
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
`,G=`// ASCILINE V2 — cell render pass.
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
`,ie={off:0,low:1,medium:2,high:3},se={off:0,low:1,medium:2,high:3},oe={grayscale:0,color256:1,truecolor:2};class ae{backend="webgpu";device;context;canvas;format;computePipeline;renderPipeline;cellBufferA;cellBufferB;frontIsA=!0;computeUniformBuffer;renderUniformBuffer;videoSampler;atlasSampler;atlasTexture=null;atlasLayout=null;settings=null;cols=0;rows=0;frameIndex=0;timestampSupported=!1;async init(e){if(!("gpu"in navigator))throw new w("WebGPU","navigator.gpu is not present");const t=navigator.gpu,r=await t.requestAdapter({powerPreference:"high-performance"});if(!r)throw new w("WebGPU","no adapter returned");this.timestampSupported=r.features.has("timestamp-query"),this.device=await r.requestDevice({requiredFeatures:this.timestampSupported?["timestamp-query"]:[]}),this.device.lost.then(i=>{console.warn(`[ASCILINE] WebGPU device lost: ${i.message}`)}),this.canvas=e;const s=e.getContext("webgpu");if(!s)throw new w("WebGPU","canvas.getContext('webgpu') failed");this.context=s,this.format=t.getPreferredCanvasFormat(),this.context.configure({device:this.device,format:this.format,alphaMode:"opaque"}),this.videoSampler=this.device.createSampler({magFilter:"linear",minFilter:"linear"}),this.atlasSampler=this.device.createSampler({magFilter:"linear",minFilter:"linear"}),this.computeUniformBuffer=this.device.createBuffer({size:40,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.renderUniformBuffer=this.device.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.computePipeline=this.device.createComputePipeline({layout:"auto",compute:{module:this.device.createShaderModule({code:ne}),entryPoint:"main"}}),this.renderPipeline=this.device.createRenderPipeline({layout:"auto",vertex:{module:this.device.createShaderModule({code:G}),entryPoint:"vs_main"},fragment:{module:this.device.createShaderModule({code:G}),entryPoint:"fs_main",targets:[{format:this.format}]},primitive:{topology:"triangle-list"}})}async setCharacterRamp(e){this.atlasLayout=await H(e),this.atlasTexture?.destroy(),this.atlasTexture=this.device.createTexture({size:[this.atlasLayout.bitmap.width,this.atlasLayout.bitmap.height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT}),this.device.queue.copyExternalImageToTexture({source:this.atlasLayout.bitmap},{texture:this.atlasTexture},[this.atlasLayout.bitmap.width,this.atlasLayout.bitmap.height])}updateSettings(e){const t=this.cols;this.settings=e;const r=$(e);r!==this.atlasLayout?.ramp&&this.setCharacterRamp(r),e.columns!==t&&this.videoWidth&&this.videoHeight&&this.resizeGridIfNeeded(e.columns,this.videoWidth,this.videoHeight)}videoWidth=0;videoHeight=0;resizeGridIfNeeded(e,t,r){const{cols:s,rows:i}=T(t,r,e);if(s===this.cols&&i===this.rows)return;this.cols=s,this.rows=i,this.frameIndex=0;const a=s*i*8;this.cellBufferA?.destroy(),this.cellBufferB?.destroy(),this.cellBufferA=this.device.createBuffer({size:a,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.cellBufferB=this.device.createBuffer({size:a,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.frontIsA=!0}renderFrame(e){if(!this.settings)return null;const t=e instanceof HTMLVideoElement?e.videoWidth:e.displayWidth,r=e instanceof HTMLVideoElement?e.videoHeight:e.displayHeight;if(!t||!r||(this.videoWidth=t,this.videoHeight=r,this.resizeGridIfNeeded(this.settings.columns,t,r),!this.atlasLayout||!this.atlasTexture))return null;const s=this.device.importExternalTexture({source:e}),i=new Uint32Array(10);i[0]=this.cols,i[1]=this.rows,i[2]=this.atlasLayout.glyphCount,i[3]=t,i[4]=r,i[5]=this.settings.dithering?1:0,i[6]=ie[this.settings.edgeDetection]??0,i[7]=se[this.settings.temporalStabilization]??0,i[8]=oe[this.settings.colorMode]??2,i[9]=this.frameIndex,this.device.queue.writeBuffer(this.computeUniformBuffer,0,i);const o=this.frontIsA?this.cellBufferA:this.cellBufferB,a=this.frontIsA?this.cellBufferB:this.cellBufferA,h=this.device.createBindGroup({layout:this.computePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:s},{binding:1,resource:this.videoSampler},{binding:2,resource:{buffer:this.computeUniformBuffer}},{binding:3,resource:{buffer:o}},{binding:4,resource:{buffer:a}}]}),c=new ArrayBuffer(48),u=new Uint32Array(c,0,4);u[0]=this.cols,u[1]=this.rows,u[2]=this.atlasLayout.atlasCols,u[3]=this.atlasLayout.atlasRows,new Float32Array(c,16,4).set([.02,.02,.02,1]),this.device.queue.writeBuffer(this.renderUniformBuffer,0,c);const f=this.device.createBindGroup({layout:this.renderPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:this.renderUniformBuffer}},{binding:2,resource:this.atlasTexture.createView()},{binding:3,resource:this.atlasSampler}]}),b=this.device.createCommandEncoder(),v=b.beginComputePass();v.setPipeline(this.computePipeline),v.setBindGroup(0,h),v.dispatchWorkgroups(Math.ceil(this.cols/8),Math.ceil(this.rows/8)),v.end();const g=b.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:.02,g:.02,b:.02,a:1},loadOp:"clear",storeOp:"store"}]});return g.setPipeline(this.renderPipeline),g.setBindGroup(0,f),g.draw(6,this.cols*this.rows),g.end(),this.device.queue.submit([b.finish()]),this.frontIsA=!this.frontIsA,this.frameIndex++,null}destroy(){this.cellBufferA?.destroy(),this.cellBufferB?.destroy(),this.atlasTexture?.destroy(),this.computeUniformBuffer?.destroy(),this.renderUniformBuffer?.destroy()}}const D=`#version 300 es
// Shared fullscreen-triangle vertex shader used by both WebGL2 passes.
const vec2 POSITIONS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2(3.0, -1.0),
  vec2(-1.0, 3.0)
);

void main() {
  gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0);
}
`,le=`#version 300 es
precision highp float;

// WebGL2 fallback, pass 1: renders into a COLS x ROWS framebuffer (one texel
// per character cell). No compute shaders in WebGL2, so this does the same
// job as cellCompute.wgsl via a fragment shader over a small framebuffer
// instead of a compute dispatch — same algorithm, different execution model.

uniform sampler2D uVideo;
uniform sampler2D uPrevCells; // previous frame's COLS x ROWS cell texture
uniform vec2 uGridSize;       // (cols, rows)
uniform float uRampLength;
uniform int uDitherEnabled;
uniform int uEdgeLevel;       // 0..3
uniform int uTemporalLevel;   // 0..3
uniform int uColorMode;       // 0 grayscale, 1 color256, 2 truecolor
uniform int uFrameIndex;

out vec4 fragColor;

const mat4 BAYER = mat4(
  0.0/16.0, 8.0/16.0, 2.0/16.0, 10.0/16.0,
  12.0/16.0, 4.0/16.0, 14.0/16.0, 6.0/16.0,
  3.0/16.0, 11.0/16.0, 1.0/16.0, 9.0/16.0,
  15.0/16.0, 7.0/16.0, 13.0/16.0, 5.0/16.0
);

float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float sampleLuma(vec2 uv) { return luminance(texture(uVideo, uv).rgb); }

void main() {
  vec2 cellCoord = floor(gl_FragCoord.xy);
  vec2 cellUv = (cellCoord + 0.5) / uGridSize;

  vec3 baseColor = texture(uVideo, cellUv).rgb;
  float luma = luminance(baseColor);

  float edgeStrength = 0.0;
  if (uEdgeLevel > 0) {
    vec2 stepUv = 1.0 / uGridSize;
    float tl = sampleLuma(cellUv + vec2(-stepUv.x, -stepUv.y));
    float tC = sampleLuma(cellUv + vec2(0.0, -stepUv.y));
    float tr = sampleLuma(cellUv + vec2(stepUv.x, -stepUv.y));
    float mL = sampleLuma(cellUv + vec2(-stepUv.x, 0.0));
    float mR = sampleLuma(cellUv + vec2(stepUv.x, 0.0));
    float bl = sampleLuma(cellUv + vec2(-stepUv.x, stepUv.y));
    float bC = sampleLuma(cellUv + vec2(0.0, stepUv.y));
    float br = sampleLuma(cellUv + vec2(stepUv.x, stepUv.y));
    float gx = (tr + 2.0 * mR + br) - (tl + 2.0 * mL + bl);
    float gy = (bl + 2.0 * bC + br) - (tl + 2.0 * tC + tr);
    edgeStrength = clamp(sqrt(gx * gx + gy * gy), 0.0, 1.0);
    float gain = uEdgeLevel == 1 ? 0.4 : (uEdgeLevel == 2 ? 0.7 : 1.0);
    luma = clamp(luma + edgeStrength * gain, 0.0, 1.0);
  }

  if (uDitherEnabled == 1) {
    int bx = int(mod(cellCoord.x, 4.0));
    int by = int(mod(cellCoord.y, 4.0));
    float threshold = BAYER[by][bx];
    float stepSize = 1.0 / uRampLength;
    luma = clamp(luma + (threshold - 0.5) * stepSize, 0.0, 1.0);
  }

  float charIndexF = floor(luma * (uRampLength - 1.0) + 0.5);
  charIndexF = clamp(charIndexF, 0.0, uRampLength - 1.0);

  if (uTemporalLevel > 0 && uFrameIndex > 0) {
    vec4 prevTexel = texture(uPrevCells, cellUv);
    float prevChar = floor(prevTexel.r * 255.0 + 0.5);
    float diff = abs(charIndexF - prevChar);
    float threshold = uTemporalLevel == 1 ? 1.0 : (uTemporalLevel == 2 ? 2.0 : 3.0);
    if (diff <= threshold) {
      charIndexF = prevChar;
    }
  }

  vec3 outColor = baseColor;
  if (uColorMode == 0) {
    outColor = vec3(luma);
  } else if (uColorMode == 1) {
    outColor = floor(baseColor * 5.0 + 0.5) / 5.0;
  }

  // R channel carries char index (0..255 domain, ramp lengths are small so
  // this has ample headroom); GBA carry the tinted color.
  fragColor = vec4(charIndexF / 255.0, outColor);
}
`,ce=`#version 300 es
precision highp float;

// WebGL2 fallback, pass 2: full-resolution fullscreen pass. For every output
// pixel, finds its owning cell, reads that cell's character index + color
// from the pass-1 texture, and samples the character atlas to composite the
// glyph. Equivalent output to the WebGPU instanced-quad approach, just
// implemented as a single fragment shader instead of per-cell geometry.

uniform sampler2D uCells; // COLS x ROWS, R=charIndex/255, GBA=color
uniform sampler2D uAtlas;
uniform vec2 uGridSize;   // (cols, rows)
uniform vec2 uAtlasGrid;  // (atlasCols, atlasRows)
uniform vec2 uOutputSize; // canvas pixel size
uniform vec4 uBackgroundColor;

out vec4 fragColor;

void main() {
  vec2 cellSizePx = uOutputSize / uGridSize;
  vec2 cellCoord = floor(gl_FragCoord.xy / cellSizePx);
  vec2 localUv = fract(gl_FragCoord.xy / cellSizePx);

  vec2 cellSampleUv = (cellCoord + 0.5) / uGridSize;
  vec4 cellTexel = texture(uCells, cellSampleUv);
  float charIndex = floor(cellTexel.r * 255.0 + 0.5);
  vec3 color = cellTexel.gba;

  float atlasCol = mod(charIndex, uAtlasGrid.x);
  float atlasRow = floor(charIndex / uAtlasGrid.x);
  vec2 atlasUv = (vec2(atlasCol, atlasRow) + localUv) / uAtlasGrid;

  float glyphMask = texture(uAtlas, atlasUv).a;
  fragColor = mix(uBackgroundColor, vec4(color, 1.0), glyphMask);
}
`,ue={off:0,low:1,medium:2,high:3},de={off:0,low:1,medium:2,high:3},he={grayscale:0,color256:1,truecolor:2};function O(n,e,t){const r=n.createShader(e);if(!r)throw new Error("createShader failed");if(n.shaderSource(r,t),n.compileShader(r),!n.getShaderParameter(r,n.COMPILE_STATUS)){const s=n.getShaderInfoLog(r);throw n.deleteShader(r),new Error(`Shader compile error: ${s}`)}return r}function _(n,e,t){const r=O(n,n.VERTEX_SHADER,e),s=O(n,n.FRAGMENT_SHADER,t),i=n.createProgram();if(!i)throw new Error("createProgram failed");if(n.attachShader(i,r),n.attachShader(i,s),n.linkProgram(i),!n.getProgramParameter(i,n.LINK_STATUS)){const o=n.getProgramInfoLog(i);throw new Error(`Program link error: ${o}`)}return n.deleteShader(r),n.deleteShader(s),i}class me{backend="webgl2";gl;canvas;decodeProgram;compositeProgram;cellFbA;cellFbB;cellTexA;cellTexB;frontIsA=!0;videoTexture;atlasTexture=null;atlasLayout=null;vao;settings=null;cols=0;rows=0;frameIndex=0;videoWidth=0;videoHeight=0;async init(e){const t=e.getContext("webgl2");if(!t)throw new w("WebGL2","getContext('webgl2') returned null");this.gl=t,this.canvas=e,this.decodeProgram=_(t,D,le),this.compositeProgram=_(t,D,ce),this.videoTexture=this.createTexture(),this.vao=t.createVertexArray()}createTexture(){const e=this.gl,t=e.createTexture();if(!t)throw new Error("createTexture failed");return e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),t}createCellTarget(e,t){const r=this.gl,s=this.createTexture();r.bindTexture(r.TEXTURE_2D,s),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.NEAREST),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.NEAREST),r.texImage2D(r.TEXTURE_2D,0,r.RGBA8,e,t,0,r.RGBA,r.UNSIGNED_BYTE,null);const i=r.createFramebuffer();if(!i)throw new Error("createFramebuffer failed");return r.bindFramebuffer(r.FRAMEBUFFER,i),r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,s,0),r.bindFramebuffer(r.FRAMEBUFFER,null),{fb:i,tex:s}}async setCharacterRamp(e){this.atlasLayout=await H(e);const t=this.gl;this.atlasTexture=this.atlasTexture??this.createTexture(),t.bindTexture(t.TEXTURE_2D,this.atlasTexture),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,this.atlasLayout.bitmap)}updateSettings(e){const t=this.cols;this.settings=e;const r=$(e);r!==this.atlasLayout?.ramp&&this.setCharacterRamp(r),e.columns!==t&&this.videoWidth&&this.videoHeight&&this.resizeGridIfNeeded(e.columns,this.videoWidth,this.videoHeight)}resizeGridIfNeeded(e,t,r){const{cols:s,rows:i}=T(t,r,e);if(s===this.cols&&i===this.rows)return;this.cols=s,this.rows=i,this.frameIndex=0;const o=this.createCellTarget(s,i),a=this.createCellTarget(s,i);this.cellFbA=o.fb,this.cellTexA=o.tex,this.cellFbB=a.fb,this.cellTexB=a.tex,this.frontIsA=!0}renderFrame(e){if(!this.settings||!this.atlasLayout||!this.atlasTexture)return null;const t=this.gl,r=e instanceof HTMLVideoElement?e.videoWidth:e.displayWidth,s=e instanceof HTMLVideoElement?e.videoHeight:e.displayHeight;if(!r||!s)return null;this.videoWidth=r,this.videoHeight=s,this.resizeGridIfNeeded(this.settings.columns,r,s),t.bindTexture(t.TEXTURE_2D,this.videoTexture),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,e);const i=this.frontIsA?this.cellFbA:this.cellFbB,o=this.frontIsA?this.cellTexA:this.cellTexB,a=this.frontIsA?this.cellTexB:this.cellTexA;return t.bindVertexArray(this.vao),t.bindFramebuffer(t.FRAMEBUFFER,i),t.viewport(0,0,this.cols,this.rows),t.useProgram(this.decodeProgram),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,this.videoTexture),t.uniform1i(t.getUniformLocation(this.decodeProgram,"uVideo"),0),t.activeTexture(t.TEXTURE1),t.bindTexture(t.TEXTURE_2D,a),t.uniform1i(t.getUniformLocation(this.decodeProgram,"uPrevCells"),1),t.uniform2f(t.getUniformLocation(this.decodeProgram,"uGridSize"),this.cols,this.rows),t.uniform1f(t.getUniformLocation(this.decodeProgram,"uRampLength"),this.atlasLayout.glyphCount),t.uniform1i(t.getUniformLocation(this.decodeProgram,"uDitherEnabled"),this.settings.dithering?1:0),t.uniform1i(t.getUniformLocation(this.decodeProgram,"uEdgeLevel"),ue[this.settings.edgeDetection]??0),t.uniform1i(t.getUniformLocation(this.decodeProgram,"uTemporalLevel"),de[this.settings.temporalStabilization]??0),t.uniform1i(t.getUniformLocation(this.decodeProgram,"uColorMode"),he[this.settings.colorMode]??2),t.uniform1i(t.getUniformLocation(this.decodeProgram,"uFrameIndex"),this.frameIndex),t.drawArrays(t.TRIANGLES,0,3),t.bindFramebuffer(t.FRAMEBUFFER,null),t.viewport(0,0,this.canvas.width,this.canvas.height),t.useProgram(this.compositeProgram),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,o),t.uniform1i(t.getUniformLocation(this.compositeProgram,"uCells"),0),t.activeTexture(t.TEXTURE1),t.bindTexture(t.TEXTURE_2D,this.atlasTexture),t.uniform1i(t.getUniformLocation(this.compositeProgram,"uAtlas"),1),t.uniform2f(t.getUniformLocation(this.compositeProgram,"uGridSize"),this.cols,this.rows),t.uniform2f(t.getUniformLocation(this.compositeProgram,"uAtlasGrid"),this.atlasLayout.atlasCols,this.atlasLayout.atlasRows),t.uniform2f(t.getUniformLocation(this.compositeProgram,"uOutputSize"),this.canvas.width,this.canvas.height),t.uniform4f(t.getUniformLocation(this.compositeProgram,"uBackgroundColor"),.02,.02,.02,1),t.drawArrays(t.TRIANGLES,0,3),this.frontIsA=!this.frontIsA,this.frameIndex++,null}destroy(){const e=this.gl;e&&([this.cellTexA,this.cellTexB,this.videoTexture,this.atlasTexture].forEach(t=>{t&&e.deleteTexture(t)}),[this.cellFbA,this.cellFbB].forEach(t=>{t&&e.deleteFramebuffer(t)}))}}const N=90;class fe{frameTimes=[];lastFrameStart=0;dropped=0;latencySamples=[];renderer="unavailable";resolution={cols:0,rows:0};queueDepth=0;lastAdaptCheck=0;consecutiveOverBudget=0;consecutiveUnderBudget=0;beginFrame(){this.lastFrameStart=performance.now()}endFrame(e={}){const r=performance.now()-this.lastFrameStart;this.frameTimes.push(r),this.frameTimes.length>N&&this.frameTimes.shift(),e.latencyMs!==void 0&&(this.latencySamples.push(e.latencyMs),this.latencySamples.length>N&&this.latencySamples.shift());const s=this.average(this.frameTimes),i=s>0?1e3/s:0;return{fps:Math.round(i*10)/10,frameTimeMs:Math.round(s*100)/100,gpuFrameTimeMs:null,cpuTimeMs:Math.round(r*100)/100,decodeTimeMs:e.decodeMs??0,uploadTimeMs:e.uploadMs??0,renderTimeMs:e.renderMs??0,queueDepth:this.queueDepth,droppedFrames:this.dropped,latencyMs:Math.round(this.average(this.latencySamples)*10)/10,memoryEstimateMb:this.estimateMemoryMb(),resolution:this.resolution,renderer:this.renderer}}recordDrop(){this.dropped++}setQueueDepth(e){this.queueDepth=e}setRendererInfo(e,t,r){this.renderer=e,this.resolution={cols:t,rows:r}}average(e){return e.length===0?0:e.reduce((t,r)=>t+r,0)/e.length}estimateMemoryMb(){const e=this.resolution.cols*this.resolution.rows*8*2,t=this.queueDepth*1920*1080*4;return Math.round((e+t)/(1024*1024)*10)/10}adaptQuality(e,t){if(!e.adaptiveQuality)return null;const r=performance.now();if(r-this.lastAdaptCheck<1e3)return null;this.lastAdaptCheck=r;const s=this.average(this.frameTimes);if(s===0)return null;const i=s>t*1.15,o=s<t*.75;return this.consecutiveOverBudget=i?this.consecutiveOverBudget+1:0,this.consecutiveUnderBudget=o?this.consecutiveUnderBudget+1:0,this.consecutiveOverBudget>=2?(this.consecutiveOverBudget=0,pe(e)):this.consecutiveUnderBudget>=4?(this.consecutiveUnderBudget=0,ve(e)):null}}function pe(n){const e=y.findIndex(t=>t<=n.columns);if(e>=0&&e<y.length-1&&y[e]===n.columns){const t=y[e+1];if(t!==void 0)return{...n,columns:t}}return n.edgeDetection!=="off"?{...n,edgeDetection:"off"}:n.dithering?{...n,dithering:!1}:n.temporalStabilization!=="off"?{...n,temporalStabilization:ge(n.temporalStabilization)}:null}function ve(n){const e=y.findIndex(t=>t===n.columns);if(e>0){const t=y[e-1];if(t!==void 0)return{...n,columns:t}}return null}function ge(n){return n==="high"?"medium":n==="medium"?"low":"off"}class ye{renderer=null;settings={...k};monitor=new fe;rafHandle=null;metricsListeners=[];canvas=null;videoSource=null;liveClient=null;liveClock=null;lastLiveFrame=null;async init(e,t){this.canvas=e,this.settings={...k,...t};const r=await re();if(r==="webgpu")this.renderer=new ae;else if(r==="webgl2")this.renderer=new me,console.warn("[ASCILINE] WebGPU unavailable, falling back to WebGL2. Some quality is capped.");else throw new Error("No GPU rendering backend available (neither WebGPU nor WebGL2). This browser/device cannot run ASCILINE V2's rendering path.");return await this.renderer.init(e),this.renderer.updateSettings(this.settings),this.renderer.backend}onMetrics(e){this.metricsListeners.push(e)}updateSettings(e){this.settings={...this.settings,...e},this.renderer?.updateSettings(this.settings)}getSettings(){return this.settings}start(e){this.liveClient=null,this.liveClock=null,this.videoSource=e,this.startLoop()}startLive(e,t){this.videoSource=null,this.liveClient=e,this.liveClock=t,this.startLoop()}startLoop(){if(this.rafHandle!==null)return;const e=()=>{this.tick(),this.rafHandle=requestAnimationFrame(e)};this.rafHandle=requestAnimationFrame(e)}stop(){this.rafHandle!==null&&(cancelAnimationFrame(this.rafHandle),this.rafHandle=null),this.lastLiveFrame?.frame.close(),this.lastLiveFrame=null}tick(){!this.renderer||!this.canvas||(this.videoSource?this.tickLocal(this.videoSource):this.liveClient&&this.liveClock&&this.tickLive(this.liveClient,this.liveClock))}tickLocal(e){if(e.paused||e.ended||e.readyState<2)return;this.monitor.beginFrame();const t=performance.now();this.renderer.renderFrame(e);const r=performance.now()-t;if(this.settings.columns){const{cols:s,rows:i}=T(e.videoWidth||16,e.videoHeight||9,this.settings.columns);this.monitor.setRendererInfo(this.renderer.backend,s,i)}this.finishTick(r,null)}tickLive(e,t){this.monitor.setQueueDepth(e.queue.depth());const r=e.queue.popForTime(t.now());if(!r)return;this.monitor.beginFrame();const s=performance.now();this.renderer.renderFrame(r.frame);const i=performance.now()-s,o=e.getInit();if(o&&this.settings.columns){const{cols:h,rows:c}=T(o.cols,o.rows,this.settings.columns);this.monitor.setRendererInfo(this.renderer.backend,h,c)}const a=(t.now()-r.timestampSec)*1e3;this.lastLiveFrame?.frame.close(),this.lastLiveFrame=r,this.finishTick(i,a)}finishTick(e,t){const r=this.monitor.endFrame({renderMs:e,latencyMs:t??void 0});for(const o of this.metricsListeners)o(r);const s=1e3/this.settings.targetFps,i=this.monitor.adaptQuality(this.settings,s);i&&(this.settings=i,this.renderer.updateSettings(this.settings))}destroy(){this.stop(),this.liveClient?.disconnect(),this.liveClient=null,this.renderer?.destroy(),this.renderer=null}}class q{videoEl=null;manualOffsetSec=0;manualStartWallMs=0;useManualClock=!1;attach(e){this.videoEl=e,this.useManualClock=!1}startManual(e=0){this.useManualClock=!0,this.manualOffsetSec=e,this.manualStartWallMs=performance.now()}seekManual(e){this.manualOffsetSec=e,this.manualStartWallMs=performance.now()}now(){return this.useManualClock?this.manualOffsetSec+(performance.now()-this.manualStartWallMs)/1e3:this.videoEl?.currentTime??0}isPaused(){return this.useManualClock?!1:this.videoEl?.paused??!0}}function xe(n){if(!n.startsWith("INIT:"))throw new Error(`parseInitMessage: not an INIT message: ${n.slice(0,32)}`);const e=n.slice(5).split(":");if(e.length<9)throw new Error(`parseInitMessage: expected 9 fields, got ${e.length}: ${n}`);const t=(r,s)=>{const i=Number(r);if(r===void 0||Number.isNaN(i))throw new Error(`parseInitMessage: bad field '${s}': ${r}`);return i};return{fps:t(e[0],"fps"),renderMode:t(e[1],"renderMode"),cols:t(e[2],"cols"),rows:t(e[3],"rows"),pixelMode:e[4]==="1",queueIndex:t(e[5],"queueIndex"),durationSec:t(e[6],"durationSec"),seekTargetSec:t(e[7],"seekTargetSec"),isWebcam:e[8]==="1"}}function Ee(n,e,t){const r=4+e*t*3;if(n.byteLength!==r)throw new Error(`parsePixelFrame: size mismatch (got ${n.byteLength} bytes, expected ${r} for ${e}x${t})`);const i=new DataView(n).getUint32(0,!1),o=new Uint8Array(n,4);return{frameIndex:i,bgr:o}}function be(n,e){const t=new Uint8Array(e*4);for(let r=0;r<e;r++){const s=r*3,i=r*4;t[i]=n[s]??0,t[i+1]=n[s+1]??0,t[i+2]=n[s+2]??0,t[i+3]=255}return t}class we{constructor(e=6){if(this.maxDepth=e,e<3||e>8)throw new RangeError(`FrameQueue: maxDepth must be 3-8 per spec, got ${e}`)}frames=[];droppedCount=0;push(e){for(this.frames.push(e);this.frames.length>this.maxDepth;)this.frames.shift()?.frame.close(),this.droppedCount++}popForTime(e){let t=null;for(;this.frames.length>0&&(this.frames[0]?.timestampSec??1/0)<=e;)t&&(t.frame.close(),this.droppedCount++),t=this.frames.shift()??null;return t}depth(){return this.frames.length}dropped(){return this.droppedCount}isFull(){return this.frames.length>=this.maxDepth}clear(){for(const e of this.frames)e.frame.close();this.frames=[]}}class Te{ws=null;init=null;queue;events;frameIndexCounter=0;reportBacklogHandle=null;constructor(e=6,t={}){this.queue=new we(e),this.events=t}connect(e,t={}){const r=new URL(e);r.searchParams.set("cols",String(t.cols??1920)),r.searchParams.set("fps",String(t.fps??60)),t.startIndex!==void 0&&r.searchParams.set("start_index",String(t.startIndex));const s=new WebSocket(r.toString());s.binaryType="arraybuffer",this.ws=s,s.onmessage=i=>{typeof i.data=="string"?this.handleTextMessage(i.data):this.handleBinaryFrame(i.data)},s.onerror=()=>this.events.onError?.(new Error("StreamClient: WebSocket error")),s.onclose=()=>{this.stopBacklogReporting(),this.events.onClose?.()},this.startBacklogReporting()}handleTextMessage(e){if(e.startsWith("INIT:"))try{this.init=xe(e),this.events.onInit?.(this.init)}catch(t){this.events.onError?.(t)}else e.startsWith("Error:")&&this.events.onError?.(new Error(e))}handleBinaryFrame(e){if(!this.init)return;const{cols:t,rows:r,fps:s}=this.init;try{const{frameIndex:i,bgr:o}=Ee(e,t,r),a=be(o,t*r),h=new VideoFrame(a.buffer,{format:"BGRA",codedWidth:t,codedHeight:r,timestamp:Math.round(i/s*1e6)}),c={frameIndex:i,timestampSec:i/s,frame:h};this.queue.push(c),this.frameIndexCounter=i}catch(i){this.events.onError?.(i)}}startBacklogReporting(){this.reportBacklogHandle=window.setInterval(()=>{this.ws?.readyState===WebSocket.OPEN&&this.ws.send(JSON.stringify({type:"buffer",depth:this.queue.depth()}))},500)}stopBacklogReporting(){this.reportBacklogHandle!==null&&(window.clearInterval(this.reportBacklogHandle),this.reportBacklogHandle=null)}pause(e){this.send({type:"pause",paused:e})}seek(e){this.send({type:"seek",time:e})}send(e){this.ws?.readyState===WebSocket.OPEN&&this.ws.send(JSON.stringify(e))}getInit(){return this.init}disconnect(){this.stopBacklogReporting(),this.ws?.close(),this.ws=null,this.queue.clear()}}class Se{pipeline=new ye;clock=new q;videoEl;events;constructor(e,t={}){this.events=t,this.videoEl=document.createElement("video"),this.videoEl.muted=!1,this.videoEl.playsInline=!0,this.videoEl.crossOrigin="anonymous",this.clock.attach(this.videoEl),this.pipeline.onMetrics(r=>this.events.onMetrics?.(r)),e.width=1920,e.height=1080,this.pipeline.init(e).then(r=>this.events.onBackendSelected?.(r)).catch(r=>this.events.onError?.(r))}async loadFile(e){const t=URL.createObjectURL(e);this.videoEl.src=t,await new Promise((r,s)=>{this.videoEl.onloadedmetadata=()=>r(),this.videoEl.onerror=()=>s(new Error(`Failed to load video: ${e.name}`))})}async loadUrl(e){this.videoEl.src=e,await new Promise((t,r)=>{this.videoEl.onloadedmetadata=()=>t(),this.videoEl.onerror=()=>r(new Error(`Failed to load video: ${e}`))})}play(){this.videoEl.play(),this.pipeline.start(this.videoEl)}pause(){this.videoEl.pause(),this.streamClient?.pause(!0)}seek(e){this.videoEl.currentTime=e,this.streamClient?.seek(e)}streamClient=null;liveClock=new q;connectLive(e,t){this.streamClient?.disconnect();const r=new Te(6,{onInit:s=>{if(!s.pixelMode){this.events.onError?.(new Error('connectLive: server queue entry is not in pixel_mode — the GPU renderer needs raw frames, not ASCII text/color-cell encoding. Set "pixel": true on the playlist/CLI entry.'));return}this.liveClock.startManual(0),this.pipeline.startLive(r,this.liveClock)},onError:s=>this.events.onError?.(s)});this.streamClient=r,r.connect(e,{cols:1920,fps:60,startIndex:t})}async uploadAndConnectLive(e,t,r){const s=new FormData;s.append("file",e);const i=await fetch(`${t.replace(/\/$/,"")}/upload`,{method:"POST",body:s});if(!i.ok){const a=await i.text().catch(()=>i.statusText);throw new Error(`Upload failed (${i.status}): ${a}`)}const o=await i.json();this.connectLive(r,o.queued_index)}disconnectLive(){this.streamClient?.disconnect(),this.streamClient=null}get duration(){return this.videoEl.duration||0}get currentTime(){return this.videoEl.currentTime}setVolume(e){this.videoEl.volume=Math.max(0,Math.min(1,e))}updateSettings(e){this.pipeline.updateSettings(e)}getSettings(){return this.pipeline.getSettings()}destroy(){this.pipeline.destroy(),this.videoEl.pause(),this.videoEl.removeAttribute("src"),this.videoEl.load()}}const V=document.querySelector("#ascii-canvas"),F=document.querySelector("#empty-state"),R=document.querySelector("#file-input"),m=document.querySelector("#play-btn"),p=document.querySelector("#pause-btn"),X=document.querySelector("#live-url-input"),Ce=document.querySelector("#live-connect-btn"),Le=document.querySelector("#upload-input"),P=document.querySelector("#upload-connect-btn"),B=document.querySelector("#upload-status"),W=document.querySelector("#backend-label"),Ue=document.querySelector("#connection-status"),Ie=document.querySelector("#metrics"),M=document.querySelector("#columns-input"),Re=document.querySelector("#columns-value"),L=document.querySelector("#charset-select"),Y=document.querySelector("#color-select"),Q=document.querySelector("#dither-check"),j=document.querySelector("#edge-select"),J=document.querySelector("#temporal-select"),K=document.querySelector("#adaptive-check"),x=document.querySelector("#error-banner"),Pe=document.querySelector("#time-current"),Be=document.querySelector("#time-duration"),S=document.querySelector("#timeline-input"),Ae=document.querySelector("#timeline-progress"),Me=document.querySelector("#timeline-thumb"),z=document.querySelector("#volume-slider");for(const n of Object.keys(A)){const e=document.createElement("option");e.value=n,e.textContent=n.toUpperCase(),L.appendChild(e)}L.value="classic";function C(n){x.textContent=`Error: ${n.message}`,x.style.display="block",setTimeout(()=>{x.style.display="none"},5e3),console.error(n)}function E(n){Ue.textContent=`CONNECTION: ${n}`}const l=new Se(V,{onBackendSelected:n=>{W.textContent=n.toUpperCase(),W.className=n==="webgpu"?"text-secondary-fixed-dim":"text-tertiary-container"},onMetrics:n=>{Ie.textContent=Fe(n)},onError:C});function Fe(n){return[`FPS:       ${n.fps.toFixed(1)}`,`FRAME:     ${n.frameTimeMs.toFixed(2)}ms`,`RES:       ${n.resolution.cols}x${n.resolution.rows}`,`RENDERER:  ${n.renderer.toUpperCase()}`,`DROPPED:   ${n.droppedFrames}`,`QUEUE:     ${n.queueDepth}`,`LATENCY:   ${n.latencyMs.toFixed(0)}ms`,`MEMORY:    ${n.memoryEstimateMb.toFixed(1)}MB`].join(`
`)}function ke(){return{columns:Number(M.value),characterSet:L.value,colorMode:Y.value,dithering:Q.checked,edgeDetection:j.value,temporalStabilization:J.value,adaptiveQuality:K.checked}}function U(){l.updateSettings(ke())}[M,L,Y,Q,j,J,K].forEach(n=>{n.addEventListener("input",()=>{Re.textContent=M.value,U()})});async function Z(n){if(n){F.style.display="none",x.style.display="none",E("LOCAL");try{await l.loadFile(n),U(),l.play(),m.classList.add("hidden"),p.classList.remove("hidden")}catch(e){C(e)}}}R.addEventListener("change",()=>{R.files?.[0]&&Z(R.files[0])});const d=V.parentElement;d.addEventListener("dragover",n=>{n.preventDefault(),d.style.borderColor="var(--primary-container)",d.style.backgroundColor="rgba(0, 243, 255, 0.05)"});d.addEventListener("dragleave",n=>{n.preventDefault(),d.style.borderColor="var(--outline-variant)",d.style.backgroundColor="#0a0a0c"});d.addEventListener("drop",n=>{n.preventDefault(),d.style.borderColor="var(--outline-variant)",d.style.backgroundColor="#0a0a0c";const e=n.dataTransfer?.files?.[0];e&&e.type.startsWith("video/")&&Z(e)});m.addEventListener("click",()=>{l.play(),m.classList.add("hidden"),p.classList.remove("hidden")});p.addEventListener("click",()=>{l.pause(),p.classList.add("hidden"),m.classList.remove("hidden")});const Ge=document.querySelector("#rewind-btn"),De=document.querySelector("#forward-btn");Ge.addEventListener("click",()=>{l.seek(Math.max(0,l.currentTime-10))});De.addEventListener("click",()=>{l.duration>0&&l.seek(Math.min(l.duration,l.currentTime+10))});Ce.addEventListener("click",()=>{const n=X.value.trim();n&&(F.style.display="none",x.style.display="none",E("CONNECTING..."),U(),l.connectLive(n),E("LIVE"),m.classList.add("hidden"),p.classList.remove("hidden"))});function Oe(n){const e=new URL(n);return e.protocol=e.protocol==="wss:"?"https:":"http:",e.pathname="",e.toString().replace(/\/$/,"")}P.addEventListener("click",async()=>{const n=Le.files?.[0],e=X.value.trim()||"ws://localhost:8000/ws";if(!n){C(new Error("Pick a video file first."));return}F.style.display="none",x.style.display="none",B.textContent="UPLOADING...",P.disabled=!0,E("UPLOADING");try{U(),await l.uploadAndConnectLive(n,Oe(e),e),B.textContent="PLAYING VIA SERVER",E("LIVE (SERVER)"),m.classList.add("hidden"),p.classList.remove("hidden")}catch(t){B.textContent="",E("ERROR"),C(t)}finally{P.disabled=!1}});setInterval(()=>{const n=l.currentTime||0,e=l.duration||0,t=r=>{const s=Math.floor(r/60).toString().padStart(2,"0"),i=Math.floor(r%60).toString().padStart(2,"0");return`${s}:${i}`};if(e>0&&document.activeElement!==S){Pe.textContent=t(n),Be.textContent=t(e);const r=n/e*100;Ae.style.width=`${r}%`,Me.style.left=`${r}%`,S.value=r.toString()}},500);S.addEventListener("input",()=>{const n=l.duration||0;if(n>0){const e=Number(S.value)/100*n;l.seek(e)}});z.addEventListener("input",()=>{typeof l.setVolume=="function"&&l.setVolume(Number(z.value)/100)});document.addEventListener("keydown",n=>{n.code==="Space"&&n.target===document.body&&(n.preventDefault(),m.classList.contains("hidden")?p.click():m.click())});
