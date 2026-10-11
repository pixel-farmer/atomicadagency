/**
 * GLSL for a gradient sky with soft drifting clouds, shared by the Open Field dome and the view
 * through The Room's windows. `dir` is the normalized view direction (world space).
 */
export const skyCloudsGlsl = /* glsl */ `
float skyHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float skyNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(skyHash(i), skyHash(i + vec2(1.0, 0.0)), u.x),
    mix(skyHash(i + vec2(0.0, 1.0)), skyHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float skyFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * skyNoise(p);
    p = r * p;
    a *= 0.5;
  }
  return v;
}

vec3 skyWithClouds(vec3 dir, float t, vec3 horizon, vec3 zenith) {
  float h = clamp(dir.y, 0.0, 1.0);
  vec3 sky = mix(horizon, zenith, pow(h, 0.6));

  // Clouds live on a high flat layer, so they shrink and crowd together toward the horizon.
  vec2 p = dir.xz / max(dir.y, 0.06) * 0.8;
  p += vec2(0.014, 0.005) * t;
  float warp = skyFbm(p * 0.5 + vec2(0.002) * t);
  float n = skyFbm(p + warp * 0.6);
  float cover = smoothstep(0.5, 0.78, n) * smoothstep(0.0, 0.15, dir.y);

  vec3 cloud = mix(vec3(1.0), horizon, 0.2);
  return mix(sky, cloud, cover * 0.55);
}
`;
