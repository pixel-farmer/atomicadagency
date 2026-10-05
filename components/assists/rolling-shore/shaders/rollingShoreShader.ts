export const rollingShoreVertexShader = /* glsl */ `
uniform float uTime;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vFoam;
varying float vShoreBlend;

float oceanSwell(vec2 xz) {
  float x = xz.x;
  float z = xz.y;

  float swell = sin(z * 0.28 + uTime * 0.55) * 0.14;
  swell += sin(z * 0.41 + uTime * 0.72 + x * 0.08) * 0.07;
  swell += sin(z * 0.16 + uTime * 0.38 + x * 0.15) * 0.09;

  return swell * smoothstep(-3.0, 6.0, z);
}

float nearShoreSwell(vec2 xz) {
  float x = xz.x;
  float z = xz.y;

  float run = sin(z * 0.58 + uTime * 0.9) * 0.048;
  run += sin(z * 0.95 + uTime * 1.05 + x * 0.1) * 0.026;
  run += sin(x * 0.42 + uTime * 0.7) * 0.014;

  float near = smoothstep(10.0, -5.5, z);
  return run * near;
}

float waveHeight(vec2 xz) {
  return oceanSwell(xz) + nearShoreSwell(xz);
}

float beachHeight(vec2 xz) {
  float x = xz.x;
  float z = xz.y;
  if (z > 1.8) return 0.0;

  float grain = sin(x * 0.7 + z * 1.1) * 0.01;
  float swash = sin(z * 0.65 + uTime * 0.88) * 0.022;
  swash += sin(x * 0.35 + z * 0.4 + uTime * 1.05) * 0.012;
  float mask = smoothstep(1.8, -5.0, z);
  return (grain + swash) * mask;
}

vec3 waveNormal(vec2 xz) {
  float eps = 0.08;
  float h = waveHeight(xz) + beachHeight(xz);
  float hx = waveHeight(xz + vec2(eps, 0.0)) + beachHeight(xz + vec2(eps, 0.0))
           - waveHeight(xz - vec2(eps, 0.0)) - beachHeight(xz - vec2(eps, 0.0));
  float hz = waveHeight(xz + vec2(0.0, eps)) + beachHeight(xz + vec2(0.0, eps))
           - waveHeight(xz - vec2(0.0, eps)) - beachHeight(xz - vec2(0.0, eps));
  return normalize(vec3(-hx, 2.0 * eps, -hz));
}

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vec2 xz = worldPos.xz;

  float h = waveHeight(xz) + beachHeight(xz);
  worldPos.y += h;

  vWorldPos = worldPos.xyz;
  vNormal = waveNormal(xz);
  vShoreBlend = 1.0 - smoothstep(-4.0, 1.5, xz.y);

  float crest = waveHeight(xz);
  float crestNeighbor = waveHeight(xz - vec2(0.0, 0.28));
  vFoam = smoothstep(0.03, 0.09, crest) * smoothstep(0.0, 0.07, crest - crestNeighbor + 0.04);

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const rollingShoreFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform sampler2D uSandMap;
uniform vec2 uSandRepeat;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vFoam;
varying float vShoreBlend;

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float ndv = max(dot(n, viewDir), 0.0);

  float z = vWorldPos.z;
  float onBeach = 1.0 - smoothstep(-0.3, 10.85, z);

  vec2 sandUV = vWorldPos.xz * uSandRepeat;
  vec3 sand = texture2D(uSandMap, sandUV).rgb;
  sand = mix(vec3(dot(sand, vec3(0.299, 0.587, 0.114))), sand, 0.82);
  sand *= vec3(0.88, 0.86, 0.90);
  float swashPhase = sin(z * 0.68 + uTime * 0.92);
  float wet = smoothstep(0.35 + swashPhase * 0.12, -3.0 + swashPhase * 0.25, z);
  sand *= mix(1.0, 0.68, wet);

  vec3 deepWater = vec3(0.08, 0.10, 0.13);
  vec3 shallow = vec3(0.14, 0.16, 0.19);
  const float depthShallowEnd = -2.5;
  const float depthDeepStart = 40.0;
  float depthMix = smoothstep(depthShallowEnd, depthDeepStart, z);
  vec3 water = mix(shallow, deepWater, depthMix);

  vec3 skyGrad = mix(uSkyHorizon, uSkyTop, smoothstep(-2.0, 18.0, vWorldPos.y + ndv * 6.0));
  vec3 reflectCol = mix(uSkyHorizon * 0.55, skyGrad, pow(1.0 - ndv, 3.0));
  water = mix(water, reflectCol, 0.35 * pow(1.0 - ndv, 2.2));

  float spec = pow(max(dot(n, normalize(vec3(-0.2, 0.35, -0.9))), 0.0), 48.0);
  water += spec * vec3(0.35, 0.38, 0.42);

  vec3 foam = vec3(0.72, 0.78, 0.82);
  float foamLine = vFoam * (1.0 - onBeach * 0.35);
  float runUp = sin(z * 0.55 + uTime * 0.85) * 0.5 + 0.5;
  foamLine += smoothstep(0.55 + runUp * 0.45, -0.15, z) * smoothstep(-6.0, 2.5, z) * 0.42;
  foamLine += smoothstep(0.15, -0.05, z) * 0.22;

  vec3 col = mix(water, sand, onBeach);
  col = mix(col, foam, clamp(foamLine, 0.0, 0.92));

  float vignette = smoothstep(28.0, 4.0, length(vWorldPos.xz - vec2(0.0, 12.0)));
  col *= mix(0.82, 1.0, vignette);

  gl_FragColor = vec4(col, 1.0);
}
`;
