export const VERT = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  // One big triangle that covers the viewport.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * The whole edit in one pass. Order follows the plan:
 * exposure → tone → colour → film LUT → grain, vignette.
 * Later stages (HSL, clarity, split tone, halation, ASCII, frame) slot in
 * between these blocks or run as extra passes.
 */
export const FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uSrc;
uniform sampler3D uLut;
uniform sampler2D uNoise;

uniform vec4 uCrop;        // x, y, w, h of the source, 0 … 1, measured from the top left
uniform bool uMirror;
uniform bool uBypass;
uniform vec2 uRes;         // output size in pixels

uniform float uExposure;   // EV
uniform float uContrast;   // -1 … 1
uniform float uSaturation; // -1 … 1
uniform float uLutMix;     // 0 … 1
uniform float uGrain;      // 0 … ~1.5
uniform float uGrainSize;
uniform vec2 uGrainOffset;
uniform float uVignette;   // -1 … 1

const float LUT_N = 33.0;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  // Textures are stored top row first, so flip y to sample upright.
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  if (uMirror) uv.x = 1.0 - uv.x;
  vec3 c = texture(uSrc, uCrop.xy + uv * uCrop.zw).rgb;

  if (uBypass) { outColor = vec4(c, 1.0); return; }

  // Exposure, in linear light.
  c = pow(c, vec3(2.2)) * exp2(uExposure);
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  c = clamp(c, 0.0, 1.0);

  // Contrast: an S-curve when adding, a pull to mid-grey when removing.
  if (uContrast > 0.0) {
    vec3 s = c * c * (3.0 - 2.0 * c);
    c = mix(c, s, uContrast);
  } else {
    c = mix(c, vec3(0.5), -uContrast * 0.5);
  }

  // Saturation.
  float l = luma(c);
  c = clamp(mix(vec3(l), c, 1.0 + uSaturation), 0.0, 1.0);

  // Film look: 33³ LUT, sampled at texel centres.
  vec3 lc = texture(uLut, c * ((LUT_N - 1.0) / LUT_N) + 0.5 / LUT_N).rgb;
  c = mix(c, lc, uLutMix);

  // Grain: a pre-made noise texture, strongest in the mid-tones like real film.
  if (uGrain > 0.0) {
    float px = max(uRes.x / 1200.0, 0.5) * uGrainSize;
    float n = texture(uNoise, gl_FragCoord.xy / (256.0 * px) + uGrainOffset).r - 0.5;
    l = luma(c);
    float w = 1.0 - pow(abs(l * 2.0 - 1.0), 2.0) * 0.7;
    c = clamp(c + n * uGrain * 0.32 * w, 0.0, 1.0);
  }

  // Vignette.
  if (uVignette != 0.0) {
    float aspect = uRes.x / uRes.y;
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    float d = length(p) / (0.5 * length(vec2(aspect, 1.0)));
    float f = smoothstep(0.3, 1.05, d);
    if (uVignette > 0.0) c *= 1.0 - uVignette * f * 0.85;
    else c = mix(c, vec3(1.0), -uVignette * f * 0.7);
  }

  outColor = vec4(c, 1.0);
}`;
