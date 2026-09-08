#version 300 es
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
