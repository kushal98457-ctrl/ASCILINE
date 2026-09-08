#version 300 es
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
