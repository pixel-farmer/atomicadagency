'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/** World height of the water surface. Keep it below the lowest gem. */
export const WATER_Y = -1.0;
/** Water body color. Nearly black, so the surface only shows where it catches light. */
const WATER_DEEP = '#020a22';
/** Peak brightness of the jar's reflection. 0 removes it. */
const JAR_REFLECTION = 0.7;
/** Color of the jar body's reflection. Pale white-blue, like the jar itself. */
const JAR_REFLECTION_BODY = '#c7dbff';
/** Color of the lid's reflection. */
const JAR_REFLECTION_LID = '#1a42ff';
/** Ripple strength. Higher is choppier and breaks the reflection up more. */
const RIPPLE = 0.075;
/** How quickly the surface fades into the background with distance. Higher fades sooner. */
const DISTANCE_FADE = 0.085;

const WATER_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const WATER_NOISE = /* glsl */ `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm3(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }
`;

const WATER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uRipple;
  uniform float uFade;
  uniform vec3 uCam;
  uniform vec3 uCore;
  uniform vec3 uBg;
  uniform vec3 uDeep;
  uniform vec3 uCoreColor;
  uniform vec4 uJar;
  uniform vec3 uJarBody;
  uniform vec3 uJarLid;
  varying vec3 vWorld;
  ${WATER_NOISE}

  float swell(vec2 p) {
    vec2 q = vec2(p.x * 0.55, p.y * 2.1);
    float t = uTime * 0.045;
    float a = fbm3(q + vec2(t, t * 0.6));
    float b = fbm3(q * 2.3 - vec2(t * 1.4, 0.0) + 7.1);
    return a * 0.65 + b * 0.35;
  }

  vec3 waterNormal(vec2 p) {
    float e = 0.04;
    float h = swell(p);
    float hx = swell(p + vec2(e, 0.0));
    float hz = swell(p + vec2(0.0, e));
    vec2 g = vec2(hx - h, hz - h) / e;
    return normalize(vec3(-g.x * uRipple, 1.0, -g.y * uRipple));
  }

  void main() {
    vec3 V = normalize(uCam - vWorld);
    vec3 N = waterNormal(vWorld.xz);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float fres = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
    float refl = 0.22 + 0.78 * fres;
    vec3 R = reflect(-V, N);

    vec3 col = uDeep;

    // The core's light, broken into a soft path by the ripples.
    vec3 toCore = normalize(uCore - vWorld);
    float align = max(dot(R, toCore), 0.0);
    col += uCoreColor * (pow(align, 90.0) * 1.3 + pow(align, 9.0) * 0.2) * refl;

    // The jar, mirrored. Cast the reflected ray back to a flat card standing at the jar,
    // facing the camera, and blur it more the farther the ray travels.
    vec3 jarCenter = vec3(0.0, 0.5 * (uJar.y + uJar.z), 0.0);
    vec3 camFlat = normalize(vec3(uCam.x, 0.0, uCam.z));
    vec3 rightV = vec3(camFlat.z, 0.0, -camFlat.x);
    float denom = dot(R, camFlat);
    if (denom < -1e-3) {
      float tHit = dot(jarCenter - vWorld, camFlat) / denom;
      if (tHit > 0.0) {
        vec3 hit = vWorld + R * tHit;
        float u = dot(hit - jarCenter, rightV);
        float v = hit.y;
        float blur = 0.03 + 0.07 * tHit;
        float maskU = 1.0 - smoothstep(uJar.x - blur, uJar.x + blur, abs(u));
        float maskV = smoothstep(uJar.y - blur, uJar.y + blur, v) * (1.0 - smoothstep(uJar.z - blur, uJar.z + blur, v));
        float mask = maskU * maskV * exp(-tHit * 0.22);
        vec3 body = uJarBody;
        vec3 lid = uJarLid;
        vec3 jarCol = mix(body, lid, smoothstep(uJar.z - 0.2, uJar.z - 0.1, v));
        col += jarCol * mask * uJar.w * refl;
      }
    }

    float dist = length(vWorld - uCam);
    float fade = 1.0 - exp(-pow(dist * uFade, 2.0));
    col = mix(col, uBg, fade);
    gl_FragColor = vec4(col, 1.0);
  }
`;

type WaterProps = {
  /** Page and fog color. The water fades into it. */
  background: string;
  /** Color of the hot center behind the product. */
  coreColor: string;
  /** How far behind the product the core sits. */
  coreDistance: number;
  /** How high above the origin the core sits. */
  coreHeight: number;
  /** Product footprint for the reflection: half-width, then the bottom and top heights in world units. */
  jar: { radius: number; bottom: number; top: number };
};

/**
 * A dark, nearly black water surface. It is only visible where it catches something: a soft path
 * of the core's light, and a blurred reflection of the product. Everything else fades to the background.
 */
export function Water({ background, coreColor, coreDistance, coreHeight, jar }: WaterProps) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRipple: { value: RIPPLE },
      uFade: { value: DISTANCE_FADE },
      uCam: { value: new THREE.Vector3() },
      uCore: { value: new THREE.Vector3() },
      uBg: { value: new THREE.Color(background) },
      uDeep: { value: new THREE.Color(WATER_DEEP) },
      uCoreColor: { value: new THREE.Color(coreColor) },
      uJar: { value: new THREE.Vector4(jar.radius, jar.bottom, jar.top, JAR_REFLECTION) },
      uJarBody: { value: new THREE.Color(JAR_REFLECTION_BODY) },
      uJarLid: { value: new THREE.Color(JAR_REFLECTION_LID) },
    }),
    [background, coreColor, jar.radius, jar.bottom, jar.top],
  );

  useFrame((state) => {
    const cam = state.camera.position;
    const len = Math.hypot(cam.x, cam.z) || 1;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uCam.value.copy(cam);
    uniforms.uCore.value.set((-cam.x / len) * coreDistance, coreHeight, (-cam.z / len) * coreDistance);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, 0]} frustumCulled={false} renderOrder={-0.5}>
      <planeGeometry args={[60, 60]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={WATER_VERTEX}
        fragmentShader={WATER_FRAGMENT}
        // Do not write depth: the glow sprites cross the water plane, and a depth-writing water
        // cuts them off along that line, leaving a hard horizontal edge.
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
