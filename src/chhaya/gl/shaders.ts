export const VERT = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  // One big triangle that covers the viewport.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * The whole edit in one pass. Blurs (clarity, texture, dehaze, halation,
 * tilt-shift) read the source's mipmaps, so there are no extra passes and
 * the live viewfinder stays fast.
 *
 * Order: geometry → detail → white balance, exposure → dehaze → tone →
 * contrast → colour, skin, HSL → blur → film LUT → split tone → fade →
 * halation → light leak → grain → vignette.
 */
export const FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uSrc;
uniform sampler3D uLut;
uniform sampler2D uNoise;

uniform mat3 uXform;       // output uv → source uv
uniform bool uBypass;
uniform vec2 uRes;         // output size in pixels
uniform float uSpan;       // source pixels across the output width

uniform float uExposure, uContrast, uHighlights, uShadows, uWhites, uBlacks;
uniform float uTemp, uTint, uSaturation, uVibrance, uSkin;
uniform float uHsl[24];
uniform vec4 uSplit;       // shadow hue, shadow amount, highlight hue, highlight amount
uniform float uSplitBalance;
uniform float uClarity, uTexture, uSharpness, uDehaze;
uniform float uLutMix;
uniform float uFade, uHalation, uLeak;
uniform int uLeakStyle;
uniform float uGrain, uGrainSize, uGrainRough;
uniform vec2 uGrainOffset;
uniform float uVignette, uVigMid;
uniform float uBlur;
uniform int uBlurMode;

const float LUT_N = 33.0;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

/** Mip level for a blur whose radius is a fraction of the output width. */
float lodFor(float frac) { return log2(max(1.0, frac * uSpan)); }

vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }

// Hue centres of the 8 HSL colours, in turns.
const float HUES[8] = float[8](0.0, 0.083, 0.167, 0.333, 0.5, 0.639, 0.764, 0.889);

vec3 grade(vec3 c, float haze) {
  // White balance and exposure, in linear light.
  vec3 lin = pow(c, vec3(2.2));
  lin *= vec3(1.0 + uTemp * 0.22 + uTint * 0.06, 1.0 - uTint * 0.12, 1.0 - uTemp * 0.22 + uTint * 0.06);
  lin *= exp2(uExposure);
  c = clamp(pow(max(lin, 0.0), vec3(1.0 / 2.2)), 0.0, 1.0);

  // Dehaze: subtract (or add) a veil estimated from a wide blur.
  if (uDehaze > 0.0) {
    float a = uDehaze * 0.55 * smoothstep(0.2, 0.9, haze);
    c = clamp((c - haze * a) / max(1.0 - a, 0.2), 0.0, 1.0);
  } else if (uDehaze < 0.0) {
    c = mix(c, vec3(0.82), -uDehaze * 0.45);
  }

  // Tone: highlights, shadows, whites, blacks.
  float l = luma(c);
  float dl = uHighlights * 0.3 * smoothstep(0.4, 1.0, l)
           + uShadows * 0.3 * (1.0 - smoothstep(0.0, 0.6, l))
           + uWhites * 0.22 * smoothstep(0.7, 1.0, l)
           + uBlacks * 0.22 * (1.0 - smoothstep(0.0, 0.3, l));
  c = clamp(c + dl, 0.0, 1.0);

  // Contrast: an S-curve when adding, a pull to mid-grey when removing.
  if (uContrast > 0.0) c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
  else c = mix(c, vec3(0.5), -uContrast * 0.5);

  // Saturation, vibrance and skin.
  vec3 hsv = rgb2hsv(c);
  float skin = smoothstep(0.1, 0.0, abs(hsv.x - 0.06)) * smoothstep(0.08, 0.25, hsv.y);
  float vib = uVibrance * (1.0 - hsv.y) * (1.0 - skin * 0.7);
  hsv.y = clamp(hsv.y * (1.0 + uSaturation + vib), 0.0, 1.0);
  hsv.x = fract(hsv.x + uSkin * 0.025 * skin);
  hsv.y = clamp(hsv.y * (1.0 + uSkin * 0.15 * skin), 0.0, 1.0);

  // HSL: 8 colour bands with soft edges.
  float dh = 0.0, ds = 0.0, dv = 0.0;
  for (int i = 0; i < 8; i++) {
    float d = abs(hsv.x - HUES[i]);
    d = min(d, 1.0 - d);
    float w = clamp(1.0 - d / 0.09, 0.0, 1.0) * smoothstep(0.02, 0.15, hsv.y);
    dh += uHsl[i * 3] * w;
    ds += uHsl[i * 3 + 1] * w;
    dv += uHsl[i * 3 + 2] * w;
  }
  hsv.x = fract(hsv.x + dh * 0.08);
  hsv.y = clamp(hsv.y * (1.0 + ds), 0.0, 1.0);
  hsv.z = clamp(hsv.z * (1.0 + dv * 0.4), 0.0, 1.0);
  return hsv2rgb(hsv);
}

void main() {
  // Textures are stored top row first, so flip y to sample upright.
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 suv = (uXform * vec3(uv, 1.0)).xy;
  vec3 c = texture(uSrc, suv).rgb;

  if (uBypass) { outColor = vec4(c, 1.0); return; }

  // Detail, measured against blurred copies of the source.
  if (uSharpness > 0.0) {
    vec3 b = textureLod(uSrc, suv, lodFor(2.0 / uRes.x)).rgb;
    c += (c - b) * uSharpness * 1.4;
  }
  if (uTexture != 0.0) {
    vec3 b = textureLod(uSrc, suv, lodFor(0.005)).rgb;
    c += (c - b) * uTexture * 1.1;
  }
  if (uClarity != 0.0) {
    float lod = lodFor(0.035);
    vec2 o = exp2(lod) / vec2(textureSize(uSrc, 0));
    vec3 b = (textureLod(uSrc, suv + o * vec2(0.5, 0.5), lod).rgb + textureLod(uSrc, suv + o * vec2(-0.5, 0.5), lod).rgb
            + textureLod(uSrc, suv + o * vec2(0.5, -0.5), lod).rgb + textureLod(uSrc, suv + o * vec2(-0.5, -0.5), lod).rgb) * 0.25;
    float l = luma(c);
    c += (l - luma(b)) * uClarity * 0.9 * (1.0 - pow(abs(l * 2.0 - 1.0), 2.0));
  }
  c = clamp(c, 0.0, 1.0);
  float haze = uDehaze != 0.0 ? luma(textureLod(uSrc, suv, lodFor(0.1)).rgb) : 0.0;

  vec3 g = grade(c, haze);

  // Blur or tilt-shift: grade a blurred sample and blend it in.
  if (uBlur > 0.0) {
    float m = uBlurMode == 1 ? smoothstep(0.06, 0.32, abs(uv.y - 0.5)) : 1.0;
    if (m > 0.0) {
      vec3 b = textureLod(uSrc, suv, lodFor(0.003 + 0.025 * uBlur * m)).rgb;
      g = mix(g, grade(b, haze), clamp(m * uBlur * 4.0, 0.0, 1.0));
    }
  }

  // Film look: 33³ LUT, sampled at texel centres.
  vec3 lc = texture(uLut, g * ((LUT_N - 1.0) / LUT_N) + 0.5 / LUT_N).rgb;
  g = mix(g, lc, uLutMix);

  // Split tone.
  float l = luma(g);
  if (uSplit.y > 0.0 || uSplit.w > 0.0) {
    float pivot = 0.5 + uSplitBalance * 0.35;
    float sw = 1.0 - smoothstep(0.0, pivot, l);
    float hw = smoothstep(pivot, 1.0, l);
    g += (hsv2rgb(vec3(uSplit.x, 0.7, 1.0)) - 0.5) * sw * uSplit.y * 0.35;
    g += (hsv2rgb(vec3(uSplit.z, 0.7, 1.0)) - 0.5) * hw * uSplit.w * 0.35;
    g = clamp(g, 0.0, 1.0);
  }

  // Fade lifts the blacks.
  g = uFade + g * (1.0 - uFade);

  // Halation: a warm red glow bleeding from bright areas.
  if (uHalation > 0.0) {
    vec3 b = textureLod(uSrc, suv, lodFor(0.025)).rgb * exp2(uExposure);
    float m = smoothstep(0.7, 1.0, luma(b));
    g = screen(g, vec3(1.0, 0.32, 0.12) * m * uHalation * 0.75);
  }

  // Light leaks.
  if (uLeak > 0.0) {
    vec3 leak;
    if (uLeakStyle == 0) leak = vec3(1.0, 0.45, 0.15) * exp(-uv.x * 4.5);
    else if (uLeakStyle == 1) leak = vec3(1.0, 0.22, 0.18) * exp(-length(uv - vec2(1.0, 0.0)) * 3.2);
    else if (uLeakStyle == 2) leak = vec3(1.0, 0.6, 0.2) * exp(-(1.0 - uv.y) * 5.0);
    else leak = vec3(1.0, 0.5, 0.15) * exp(-length(uv - vec2(0.0, 0.3)) * 3.0)
              + vec3(0.9, 0.2, 0.6) * exp(-length(uv - vec2(1.0, 0.75)) * 3.5);
    g = screen(g, clamp(leak, 0.0, 1.0) * uLeak);
  }

  // Grain: a pre-made noise texture, strongest in the mid-tones like real film.
  if (uGrain > 0.0) {
    float px = max(uRes.x / 1200.0, 0.5) * uGrainSize;
    vec2 q = gl_FragCoord.xy / (256.0 * px) + uGrainOffset;
    float n = texture(uNoise, q).r - 0.5;
    float fine = texture(uNoise, q * 2.7 + 0.37).r - 0.5;
    n = mix(n, n * 0.6 + fine * 0.8, uGrainRough);
    l = luma(g);
    float w = 1.0 - pow(abs(l * 2.0 - 1.0), 2.0) * 0.7;
    g = clamp(g + n * uGrain * 0.32 * w, 0.0, 1.0);
  }

  // Vignette.
  if (uVignette != 0.0) {
    float aspect = uRes.x / uRes.y;
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    float d = length(p) / (0.5 * length(vec2(aspect, 1.0)));
    float f = smoothstep(uVigMid, 1.05, d);
    if (uVignette > 0.0) g *= 1.0 - uVignette * f * 0.9;
    else g = mix(g, vec3(1.0), -uVignette * f * 0.7);
  }

  outColor = vec4(g, 1.0);
}`;
