export const MAX_RIPPLES = 12;

const rippleHelpers = /* glsl */ `
float rainRippleHeight(vec2 p, vec2 center, float age, float amp) {
  if (amp <= 0.0 || age < 0.0) return 0.0;

  float endFade = 1.0 - smoothstep(3.4, 5.0, age);
  if (endFade <= 0.0) return 0.0;

  float r = length(p - center);
  float radius = age * 0.65;
  float distanceFromFront = r - radius;

  float wave = sin(distanceFromFront * 16.0);
  float ringWidth = exp(-distanceFromFront * distanceFromFront * 5.0);
  float fade = exp(-age * 0.45);
  float radialFade = 1.0 / (1.0 + r * 0.5);
  float impact = -exp(-r * r * 180.0) * exp(-age * 18.0);

  return amp * endFade * (wave * ringWidth * fade * radialFade + impact);
}

float rainHeight(vec2 p, float t, vec4 ripples[${MAX_RIPPLES}]) {
  float h = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 rip = ripples[i];
    if (rip.w > 0.0) {
      float age = t - rip.z;
      h += rainRippleHeight(p, rip.xy, age, rip.w);
      h += rainRippleHeight(p, rip.xy, age - 0.3, rip.w * 0.4);
      h += rainRippleHeight(p, rip.xy, age - 0.58, rip.w * 0.16);
    }
  }
  return h;
}

float waterHeight(vec2 p, float t, vec4 ripples[${MAX_RIPPLES}]) {
  return rainHeight(p, t, ripples);
}

vec3 waterNormal(vec2 p, float t, vec4 ripples[${MAX_RIPPLES}]) {
  float eps = 0.018;
  float hx1 = waterHeight(p + vec2(eps, 0.0), t, ripples);
  float hx0 = waterHeight(p - vec2(eps, 0.0), t, ripples);
  float hz1 = waterHeight(p + vec2(0.0, eps), t, ripples);
  float hz0 = waterHeight(p - vec2(0.0, eps), t, ripples);
  float dx = (hx1 - hx0) / (2.0 * eps);
  float dz = (hz1 - hz0) / (2.0 * eps);
  return normalize(vec3(-dx, 1.0, -dz));
}
`;

export const blackWaterVertexShader = /* glsl */ `
varying vec3 vWorldPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const blackWaterFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uLightDir;
uniform vec4 uRipples[${MAX_RIPPLES}];

varying vec3 vWorldPos;

${rippleHelpers}

// Manual controls
const float NOISE_SCALE = 0.42;
const float NOISE_STRENGTH = 0.12;
const float NOISE_SPEED = 0.012;

// Pseudo-random value at each grid point
float hashNoise(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

// Smooth interpolated noise
float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    f = f * f * (3.0 - 2.0 * f);

    float a = hashNoise(i);
    float b = hashNoise(i + vec2(1.0, 0.0));
    float c = hashNoise(i + vec2(0.0, 1.0));
    float d = hashNoise(i + vec2(1.0, 1.0));

    return mix(
        mix(a, b, f.x),
        mix(c, d, f.x),
        f.y
    );
}

void main() {
  vec2 p = vWorldPos.xz;
  vec3 n = waterNormal(p, uTime, uRipples);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 lightDir = normalize(uLightDir);
  vec3 halfDir = normalize(lightDir + viewDir);

  float ndotl = max(dot(n, lightDir), 0.0);
  float spec = pow(max(dot(n, halfDir), 0.0), 200.0);
  float specWide = pow(max(dot(n, halfDir), 0.0), 56.0);

  vec3 col = vec3(0.035, 0.038, 0.045); // Base water color
  col += ndotl * vec3(0.05, 0.055, 0.07); // Diffuse lighting color
  col += spec * vec3(1.1, 0.92, 1.0); // Specular light
  col += specWide * vec3(0.12, 0.13, 0.19); // Sharp specular highlights

// Slow, subtle variation across the water
vec2 noiseUV = vWorldPos.xz * NOISE_SCALE;

noiseUV += vec2(
    uTime * NOISE_SPEED,
    -uTime * NOISE_SPEED * 0.7
);

float waterNoise = valueNoise(noiseUV);

// Center the noise around zero and keep it subtle
float noiseAmount = (waterNoise - 1.5) * NOISE_STRENGTH;

col *= 1.0 + noiseAmount;

  float dist = length(vWorldPos.xz);
  float vignette = smoothstep(4.0, 14.0, dist);
  col *= mix(0.72, 1.0, vignette);

  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 2.8);
  float alpha = mix(0.55, 0.76, fresnel);

  // Soft falloff before the mesh edge so wide FOV never shows a hard square cutoff.
  const float PLANE_HALF = 28.0;
  alpha *= 1.0 - smoothstep(PLANE_HALF - 6.0, PLANE_HALF - 0.25, dist);

  gl_FragColor = vec4(col, alpha);
}
`;
