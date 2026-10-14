'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WATER_Y } from '@/components/assists/sapphires/SapphiresWater';

/** Number of fog sheets stacked above the water. */
const FOG_LAYERS = 4;
/** Vertical gap between the sheets, in world units. */
const FOG_SPACING = 0.22;
/** Cool, pale blue. Kept dim so the fog stays a haze, not a cloud. */
const FOG_COLOR = '#5a7fe0';
/** Peak opacity of the lowest, densest sheet. */
const FOG_DENSITY = 0.2;
/** Drift speed of the lowest sheet. Higher sheets move a little faster. */
const FOG_SPEED = 0.018;

const FOG_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FOG_NOISE = /* glsl */ `
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
  float fbm4(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.02 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }
`;

const FOG_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uCam;
  uniform vec3 uCore;
  uniform float uAlpha;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSeed;
  varying vec3 vWorld;
  ${FOG_NOISE}

  void main() {
    vec2 p = vWorld.xz * 0.17 + uSeed;
    float t = uTime * uSpeed;
    vec2 q = vec2(fbm4(p + vec2(t, 0.0)), fbm4(p + vec2(3.1, 7.7) - vec2(0.0, t)));
    float n = fbm4(p + q * 1.7 + 2.0);
    float cloud = smoothstep(0.32, 0.8, n);

    float radial = 1.0 - smoothstep(3.5, 15.0, length(vWorld.xz));
    float nearFade = smoothstep(1.6, 5.0, length(vWorld - uCam));

    // Lit from behind: the haze brightens toward the core and stays dim elsewhere.
    float d = length(vWorld.xz - uCore.xz);
    float lit = 0.22 + 0.78 * exp(-d * d * 0.05);

    float a = cloud * radial * nearFade * lit * uAlpha;
    gl_FragColor = vec4(uColor, a);
  }
`;

type GroundFogProps = {
  coreDistance: number;
};

/** Low fog hugging the water, brightest where the core's light reaches it. */
export function GroundFog({ coreDistance }: GroundFogProps) {
  const sheets = useMemo(
    () =>
      Array.from({ length: FOG_LAYERS }, (_, i) => ({
        y: WATER_Y + 0.08 + i * FOG_SPACING,
        alpha: FOG_DENSITY * (1 - i * 0.18),
        speed: FOG_SPEED * (1 + i * 0.35),
        seed: i * 13.7,
      })),
    [],
  );
  const materials = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const color = useMemo(() => new THREE.Color(FOG_COLOR), []);
  const core = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const cam = state.camera.position;
    const len = Math.hypot(cam.x, cam.z) || 1;
    core.set((-cam.x / len) * coreDistance, 0, (-cam.z / len) * coreDistance);
    materials.current.forEach((mat) => {
      if (!mat) return;
      mat.uniforms.uTime.value = state.clock.elapsedTime;
      mat.uniforms.uCam.value.copy(cam);
      mat.uniforms.uCore.value.copy(core);
    });
  });

  return (
    <group>
      {sheets.map((sheet, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, sheet.y, 0]} frustumCulled={false} renderOrder={1}>
          <planeGeometry args={[40, 40]} />
          <shaderMaterial
            ref={(node) => {
              materials.current[i] = node;
            }}
            transparent
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            uniforms={{
              uColor: { value: color },
              uCam: { value: new THREE.Vector3() },
              uCore: { value: new THREE.Vector3() },
              uAlpha: { value: sheet.alpha },
              uTime: { value: 0 },
              uSpeed: { value: sheet.speed },
              uSeed: { value: sheet.seed },
            }}
            vertexShader={FOG_VERTEX}
            fragmentShader={FOG_FRAGMENT}
          />
        </mesh>
      ))}
    </group>
  );
}
