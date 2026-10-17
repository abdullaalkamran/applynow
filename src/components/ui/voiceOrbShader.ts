// GLSL (WebGL1) for the voice orb: a lit sphere whose surface is a domain-warped flow field. Thin glowing ribbons
// ride the warp lines, colours drift cyan → blue → violet → magenta → orange, a Fresnel rim glows on the edge, and
// `uEnergy` (voice level / state) widens the warp and brightens everything.
export const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uEnergy;
uniform float uGray;
uniform float uHue;
uniform float uPx;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.62;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 1.9 + vec2(1.7, 9.2); a *= 0.38; }
  return v;
}
vec3 pal(float t) {
  vec3 a = vec3(0.0, 0.72, 1.0), b = vec3(0.12, 0.3, 1.0), c = vec3(0.58, 0.2, 1.0), d = vec3(1.0, 0.16, 0.66), e = vec3(1.0, 0.44, 0.1);
  t = (1.0 - abs(fract(t * 0.5) * 2.0 - 1.0)) * 4.0; // triangle wave: loops with no hard seam
  t = min(t, 3.999);
  if (t < 1.0) return mix(a, b, t);
  if (t < 2.0) return mix(b, c, t - 1.0);
  if (t < 3.0) return mix(c, d, t - 2.0);
  return mix(d, e, t - 3.0);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float r = length(uv);
  float edge = 1.0 - smoothstep(1.0 - uPx, 1.0, r);
  if (edge <= 0.0) { gl_FragColor = vec4(0.0); return; }

  float z = sqrt(max(1.0 - r * r, 0.0));
  vec3 n = vec3(uv, z);
  float t = uTime;

  // Slowly turn the sphere so the pattern wraps around it instead of sliding across a flat disc.
  float c = cos(t * 0.22), s = sin(t * 0.22);
  vec3 p = vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);

  float amp = 1.0 + uEnergy * 1.1;
  // Sample the flow field through a skewed 3D-ish projection (not centred on the origin) so the pattern isn't
  // mirrored left/right and reads as wrapping around the sphere.
  vec2 q = vec2(p.x * 1.1 + p.z * 0.8, p.y * 1.1 - p.z * 0.6) + vec2(0.7, -1.3);
  vec2 w = vec2(fbm(q + vec2(0.0, t * 0.4)), fbm(q + vec2(5.2, 1.3) - t * 0.3));
  float f = fbm(q + w * 1.6 * amp);

  // Broad flowing bands: a smooth sine over a warped, slightly diagonal coordinate.
  float k = (p.y * 1.3 + p.x * 0.35) * 2.6 + f * 2.5 * amp + t * 0.35;
  float sw = sin(k);
  float fill = smoothstep(-0.3, 0.95, sw);
  float crest = pow(smoothstep(0.6, 1.0, sw), 5.0);
  float trough = smoothstep(0.05, -0.9, sw);

  // A second, finer set of wavy highlight lines riding the same flow.
  float k2 = k * 1.9 + 1.7 + f * 1.6;
  float fine = pow(smoothstep(0.09, 0.0, abs(sin(k2))), 1.5);

  vec3 deep = vec3(0.01, 0.025, 0.17);
  vec3 royal = vec3(0.05, 0.13, 0.78);
  vec3 base = mix(royal, deep, trough * 0.85);
  // While it talks the whole body drifts through the palette: the dark water takes on the colour of the moment too.
  float live = clamp(uEnergy * 2.2, 0.0, 1.0);
  base = mix(base, pal(uHue * 0.8 + 0.3 + f * 0.4) * 0.5, live * 0.65);
  // Mostly cyan -> blue -> violet; pink and orange only toward the lower right, like the rim light.
  vec3 bandCol = pal(0.05 + f * 0.55 + (p.x - p.y) * 0.34 + t * 0.02 + uHue);
  vec3 col = base;
  col = mix(col, bandCol * 1.0, fill * 0.78); // blend (not add) so the band keeps its saturated colour
  col += mix(vec3(0.9, 0.97, 1.0), bandCol, 0.45) * crest * (0.7 + uEnergy * 0.3);
  col += mix(vec3(1.0), pal(f + 0.45), 0.6) * fine * 0.2;

  float fres = pow(1.0 - z, 2.4);
  float side = smoothstep(-0.7, 0.9, uv.x - uv.y * 0.55);
  vec3 rim = mix(vec3(0.1, 0.8, 1.0), vec3(1.0, 0.55, 0.28), side);
  rim = mix(rim, mix(pal(uHue + 0.1), pal(uHue + 0.65), side), live * 0.8);
  col += rim * fres * (1.1 + uEnergy * 0.35);
  col += vec3(0.92, 0.25, 0.8) * smoothstep(0.1, -0.95, uv.y) * fres * 0.55;

  float gloss = pow(max(dot(n, normalize(vec3(-0.45, 0.6, 0.65))), 0.0), 22.0);
  col += vec3(1.0) * gloss * 0.2;
  col *= 0.86 + 0.34 * fres;

  col = col / (1.0 + col * (0.26 + uEnergy * 0.3)); // soft tone-map: keeps highlights luminous without clipping to white
  col = pow(col, vec3(1.0));
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum), uGray);
  gl_FragColor = vec4(col * edge, edge);
}
`;
