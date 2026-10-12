'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, MeshRefractionMaterial } from '@react-three/drei';
import {
  BloomEffect,
  ChromaticAberrationEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Large foreground gems at the lower corners of the frame. */
const NEAR_GEM_COUNT = 3;
/** Mid-size gems along the diagonal band. */
const MID_GEM_COUNT = 8;
/** Small gems scattered on the band. One shared glossy material, instanced. */
const SMALL_GEM_COUNT = 12;
/** Sapphire index of refraction. Raise toward 2.4 for diamond. */
const GEM_IOR = 1.77;
/** Body tint. Swap for ruby (#9b1b2e), emerald (#0d6b45), or diamond (#f7f8fa). */
const GEM_COLOR = '#04102b';
/** How far light travels before the tint takes hold. Higher is clearer. */
const GEM_ATTENUATION_DISTANCE = 0.95;
/** 0 keeps the facets sharp. Anything above ~0.05 goes frosted. */
const GEM_ROUGHNESS = 0;
/** Thickness of the gem for the transmission shader, in world units. */
const GEM_THICKNESS = 0.85;
/** Splits the refracted color into a thin spectrum along the facet edges. */
const GEM_CHROMATIC_ABERRATION = 0.08;
/** Transmission samples. Lower is faster; 6 is enough for a hard facet. */
const GEM_SAMPLES = 6;
/** How strongly the gems reflect the studio lights. */
const GEM_ENV_INTENSITY = 1.6;
/** Table width as a fraction of the girdle diameter. */
const GEM_TABLE_RATIO = 0.57;
/** Crown height as a fraction of the girdle diameter. */
const GEM_CROWN_HEIGHT = 0.16;
/** Pavilion depth as a fraction of the girdle diameter. */
const GEM_PAVILION_DEPTH = 0.43;
/** Girdle thickness as a fraction of the girdle diameter. */
const GEM_GIRDLE_THICKNESS = 0.02;
/** Base distance from the origin to each gem. */
const ORBIT_RADIUS = 2.55;
/** Radians per second of the slowest orbit. */
const ORBIT_SPEED = 0.12;
/** Nothing but the product may sit inside this sphere. */
const CENTER_CLEAR_RADIUS = 1.5;
/** Shared transmission buffer size. One buffer for every gem. */
const TRANSMISSION_RESOLUTION = 512;
/** Bloom on the core and gem highlights only. Kept low so the core stays tinted. */
const BLOOM_STRENGTH = 0.06;
/** Luminance where bloom starts. Only the hot core and gem sparks. */
const BLOOM_THRESHOLD = 0.58;
/** How dark the vignette corners get. */
const VIGNETTE_STRENGTH = 0.82;
/** Lens color split. Radial, so it grows toward the frame edges. */
const CHROMATIC_ABERRATION = 0.0016;
/** World-unit falloff. Wide, so foreground gems stay only slightly soft. */
const DOF_RANGE = 9;
/** Bokeh size. Low, so the near gems don't dissolve into blur. */
const DOF_SCALE = 1.5;
/** Camera distance from the product. */
const CAMERA_DISTANCE = 6.2;
/** Sharp plane, in world units from the camera. The product sits on it. */
const DOF_FOCUS = CAMERA_DISTANCE;
/** Height of the auto-orbit camera. */
const CAMERA_HEIGHT = 1.15;
/** Radians per second of the camera sway. */
const CAMERA_ORBIT_SPEED = 0.08;
/** Half-angle of the sway around the front view. */
const CAMERA_SWAY = (15 * Math.PI) / 180;
/** How far the camera leans toward the cursor. */
const CAMERA_PARALLAX = 0.35;
/** How far gems slide away from the cursor. */
const CURSOR_DRIFT = 0.22;
/** Soft key on the product only, from the front, so it keeps its own color. */
const PRODUCT_KEY = 8;
/** Faint neutral rim on the product only. */
const PRODUCT_RIM = 1.1;
/** Jar diameter. Wider than it is tall. */
const JAR_WIDTH = 1.05;
/** Jar body height, not including the lid. */
const JAR_HEIGHT = 0.58;
/** Lid height. A small seam sits between it and the jar. */
const LID_HEIGHT = 0.18;
/** Warm pearl. The jar stays out of the blue cast. */
const JAR_COLOR = '#f0e9df';
/** Brushed silver for the lid. */
const LID_COLOR = '#c8ccd2';
/** Radians per second. Slow enough that the lid highlights travel. */
const JAR_ROTATION_SPEED = 0.05;
/** Word on the front of the jar. */
const BRAND_TEXT = 'SAPPHIRE';
/** Hot center of the backlight. Warm it for ruby, cool it for emerald or diamond. */
export const CORE_COLOR = '#e7fbff';
/** Peak brightness of the core sprite and the point light inside it. */
const CORE_INTENSITY = 1.2;
/** How far behind the product the core sits, in world units. */
const CORE_Z = -2.5;
/** How far above the product the core sits. */
const CORE_Y = 0.2;
/** Fractional pulse of the core, a few percent. */
const CORE_PULSE = 0.04;
/** Radians per second of that pulse. */
const CORE_PULSE_SPEED = 0.55;
/** How many haze sheets fill the volume. */
const HAZE_LAYERS = 5;
/** Drifting dust motes. */
const PARTICLE_COUNT = 220;
/** Pale dust. A few motes are brighter and catch the core. */
const DUST_COLOR = '#d5e2ff';
/** One color for the clear, the fog, and the page behind the canvas. */
export const BACKGROUND_COLOR = '#070814';
/** Slightly lighter deep blue gathered around the core. */
const BACKGROUND_GLOW = '#0c1c44';
/** Haze body. Dark and desaturated, so the frame stays navy. */
const HAZE_COLOR = '#101624';
/** Haze only where it nears the core. Still muted, never white. */
const HAZE_LIFT = '#2a354c';
/** Exponential fog density, in the same navy as the background. */
const FOG_DENSITY = 0.038;

const PRODUCT_LAYER = 1;

type GemTier = 'large' | 'mid' | 'small';

type Gem = {
  tier: GemTier;
  /** Position along the diagonal arc, 0 at the lower left and 1 at the lower right. */
  u: number;
  scale: number;
  speed: number;
  spin: number;
  phase: number;
  tilt: number;
  roll: number;
  drift: number;
  jitter: [number, number, number];
};

/** Loose diagonal. Ends sit in the lower corners; the middle passes behind the product. */
const ARC: [number, number, number][] = [
  [-0.552, -0.08, 3.07],
  [-0.387, 0.13, 2.88],
  [-0.85, 0.5, 0.55],
  [-0.734, 0.81, -1.05],
  [-0.294, 0.39, -1.79],
  [0.201, -0.02, -1.92],
  [0.625, -0.17, -0.98],
  [0.673, -0.12, 1.35],
  [0.591, -0.2, 2.94],
];

function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function arcAt(u: number, target: THREE.Vector3) {
  const spans = ARC.length - 1;
  const t = Math.min(Math.max(u, 0), 1) * spans;
  const i = Math.min(Math.floor(t), spans - 1);
  const f = t - i;
  const s = f * f * (3 - 2 * f);
  const a = ARC[i];
  const b = ARC[i + 1];
  target.set(
    (a[0] + (b[0] - a[0]) * s) * ORBIT_RADIUS,
    a[1] + (b[1] - a[1]) * s,
    a[2] + (b[2] - a[2]) * s,
  );
}

/** More gems near the middle of the band, thinning toward both ends. */
function bandU(i: number, count: number, salt: number) {
  const x = ((i + 0.5) / count) * 2 - 1;
  const shaped = Math.sign(x) * Math.pow(Math.abs(x), 1.55);
  return 0.5 + shaped * 0.36 + (rand(salt) - 0.5) * 0.05;
}

function makeGems(): Gem[] {
  const largeU = [0.0, 0.055, 0.985].slice(0, NEAR_GEM_COUNT);
  const largeScale = [1.52, 1.24, 1.4];
  const large: Gem[] = largeU.map((u, i) => ({
    tier: 'large',
    u,
    scale: (largeScale[i] ?? 1.3) * (i === 2 ? 0.78 : 1),
    speed: ORBIT_SPEED * (0.35 + i * 0.12),
    spin: 0.05 + i * 0.03,
    phase: i * 2.2,
    tilt: -0.4 + i * 0.45,
    roll: 0.2 - i * 0.28,
    drift: 0.012,
    jitter: (
      [
        [-0.78, -0.48, 0.16],
        [-0.58, 0.72, -0.12],
        [0.04, -0.04, 0.04],
      ] as [number, number, number][]
    )[i] ?? [0, 0, 0],
  }));
  const mid: Gem[] = Array.from({ length: MID_GEM_COUNT }, (_, i) => ({
    tier: 'mid' as const,
    u: bandU(i, MID_GEM_COUNT, i * 3.1 + 1.7),
    scale: 0.3 + rand(i * 5.3 + 0.4) * 0.3,
    speed: ORBIT_SPEED * (0.45 + rand(i * 2.2 + 8) * 1.1),
    spin: 0.08 + rand(i * 4.4) * 0.22,
    phase: rand(i * 9.1) * Math.PI * 2,
    tilt: (rand(i * 1.3) - 0.5) * 1.4,
    roll: (rand(i * 6.6) - 0.5) * 1.1,
    drift: 0.02 + rand(i * 7.7) * 0.02,
    jitter: [
      (rand(i * 2.9) - 0.5) * 0.16,
      (rand(i * 3.7) - 0.5) * 0.2,
      (rand(i * 4.1) - 0.5) * 0.14,
    ],
  }));
  const small: Gem[] = Array.from({ length: SMALL_GEM_COUNT }, (_, i) => ({
    tier: 'small' as const,
    u: bandU(i, SMALL_GEM_COUNT, i * 8.3 + 4.2),
    scale: 0.08 + rand(i * 6.1 + 2) * 0.12,
    speed: ORBIT_SPEED * (0.55 + rand(i * 1.9 + 3) * 1.35),
    spin: 0.12 + rand(i * 5.5) * 0.35,
    phase: rand(i * 2.7 + 1) * Math.PI * 2,
    tilt: (rand(i * 8.8) - 0.5) * 2.2,
    roll: (rand(i * 3.3) - 0.5) * 2.2,
    drift: 0.018 + rand(i * 4.8) * 0.028,
    jitter: [
      (rand(i * 9.4) - 0.5) * 0.2,
      (rand(i * 1.1) - 0.5) * 0.22,
      (rand(i * 7.2) - 0.5) * 0.16,
    ],
  }));
  const leftSide: Gem[] = [
    {
      tier: 'mid',
      u: 0.24,
      scale: 0.46,
      speed: ORBIT_SPEED * 0.72,
      spin: 0.11,
      phase: 1.1,
      tilt: 0.35,
      roll: -0.22,
      drift: 0.018,
      jitter: [-0.24, 0.16, 0.05],
    },
    {
      tier: 'mid',
      u: 0.37,
      scale: 0.34,
      speed: ORBIT_SPEED * 0.95,
      spin: 0.15,
      phase: 2.6,
      tilt: -0.28,
      roll: 0.36,
      drift: 0.02,
      jitter: [-0.18, -0.14, -0.06],
    },
    {
      tier: 'small',
      u: 0.17,
      scale: 0.15,
      speed: ORBIT_SPEED * 1.05,
      spin: 0.2,
      phase: 0.7,
      tilt: 0.48,
      roll: 0.18,
      drift: 0.02,
      jitter: [-0.2, 0.26, 0.08],
    },
    {
      tier: 'small',
      u: 0.43,
      scale: 0.12,
      speed: ORBIT_SPEED * 0.82,
      spin: 0.17,
      phase: 3.2,
      tilt: -0.36,
      roll: -0.12,
      drift: 0.016,
      jitter: [-0.12, 0.1, 0.02],
    },
  ];
  return [...large, ...mid, ...small, ...leftSide];
}

/**
 * Round brilliant. One triangle owns each copy of its vertices, so the normals
 * stay flat and every facet edge stays sharp. Diameter is 1.2 so the existing
 * gem scales still read the same size.
 */
function brilliantCutGeometry() {
  const D = 1.2;
  const R = D * 0.5;
  const tableR = R * GEM_TABLE_RATIO;
  const crownH = D * GEM_CROWN_HEIGHT;
  const pavilionD = D * GEM_PAVILION_DEPTH;
  const girdleH = D * GEM_GIRDLE_THICKNESS;
  const yGirdleTop = girdleH * 0.5;
  const yGirdleBot = -girdleH * 0.5;
  const yTable = yGirdleTop + crownH;
  const yCulet = yGirdleBot - pavilionD;
  // Star points lie on the kite plane, partway from the table down the crown.
  const crownU = 0.38;
  const starR = (tableR + crownU * (R - tableR)) / Math.cos(Math.PI / 8);
  const yStar = yTable + crownU * (yGirdleTop - yTable);
  // Break points lie on the main-facet plane, partway from the culet up to the girdle.
  const pavU = 0.28;
  const breakR = (pavU * R) / Math.cos(Math.PI / 8);
  const yBreak = yCulet + pavU * (yGirdleBot - yCulet);

  const at = (angle: number, radius: number, y: number): [number, number, number] => [
    Math.cos(angle) * radius,
    y,
    Math.sin(angle) * radius,
  ];
  const main = (i: number) => (i * Math.PI) / 4;
  const half = (i: number) => main(i) + Math.PI / 8;
  const N = 8;

  const positions: number[] = [];
  const tri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => {
    positions.push(...a, ...b, ...c);
  };
  const quad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
  ) => {
    tri(a, b, c);
    tri(a, c, d);
  };

  const tableCenter: [number, number, number] = [0, yTable, 0];
  const culet: [number, number, number] = [0, yCulet, 0];

  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const prev = (i + N - 1) % N;
    const T = at(main(i), tableR, yTable);
    const Tj = at(main(j), tableR, yTable);
    const S = at(half(i), starR, yStar);
    const Sprev = at(half(prev), starR, yStar);
    const B = at(main(i), R, yGirdleTop);
    const Bj = at(main(j), R, yGirdleTop);
    const M = at(half(i), R, yGirdleTop);
    const Bb = at(main(i), R, yGirdleBot);
    const Bbj = at(main(j), R, yGirdleBot);
    const Mb = at(half(i), R, yGirdleBot);
    const P = at(half(i), breakR, yBreak);
    const Pprev = at(half(prev), breakR, yBreak);

    // Table: flat octagon.
    tri(tableCenter, Tj, T);
    // Star facet, base on a table edge.
    tri(T, Tj, S);
    // Kite (bezel): table corner down to the girdle, split into two coplanar triangles.
    tri(T, B, Sprev);
    tri(T, S, B);
    // Upper girdle facets, two per sector.
    tri(S, M, B);
    tri(S, Bj, M);
    // Thin girdle ring.
    quad(B, M, Mb, Bb);
    quad(M, Bj, Bbj, Mb);
    // Lower girdle facets, two per sector, meeting the mains partway down.
    tri(Bb, Mb, P);
    tri(Mb, Bbj, P);
    // Pavilion main, a kite from the girdle through the breaks to the culet.
    tri(Bb, culet, Pprev);
    tri(Bb, P, culet);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Faces a strip at the stage, then rolls it so each light sits at its own angle. */
function stripFacing(position: [number, number, number], roll: number): [number, number, number] {
  const stand = new THREE.Object3D();
  stand.position.set(position[0], position[1], position[2]);
  stand.lookAt(0, 0, 0);
  stand.rotateZ(roll);
  return [stand.rotation.x, stand.rotation.y, stand.rotation.z];
}

function coreOffset(cam: THREE.Vector3, target: THREE.Vector3) {
  const len = Math.hypot(cam.x, cam.z) || 1;
  target.set((-cam.x / len) * Math.abs(CORE_Z), CORE_Y, (-cam.z / len) * Math.abs(CORE_Z));
}

function Studio() {
  const camera = useThree((s) => s.camera);
  const key = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const sky = useRef<THREE.ShaderMaterial>(null);
  const coreDir = useMemo(() => {
    const spot = new THREE.Vector3();
    coreOffset(new THREE.Vector3(0, CAMERA_HEIGHT, CAMERA_DISTANCE), spot);
    return spot.normalize();
  }, []);

  useLayoutEffect(() => {
    camera.layers.enable(PRODUCT_LAYER);
    key.current?.layers.set(PRODUCT_LAYER);
    rim.current?.layers.set(PRODUCT_LAYER);
  }, [camera]);

  useFrame(() => {
    coreOffset(camera.position, coreDir);
    coreDir.normalize();
  });

  const background = useMemo(() => new THREE.Color(BACKGROUND_COLOR), []);
  const glow = useMemo(() => new THREE.Color(BACKGROUND_GLOW), []);

  return (
    <>
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <fogExp2 attach="fog" args={[BACKGROUND_COLOR, FOG_DENSITY]} />
      <Suspense fallback={null}>
        <Environment resolution={512} frames={1}>
          <Lightformer
            form="rect"
            intensity={7}
            color="#ffffff"
            position={[0.2, 2.4, -3.6]}
            rotation={stripFacing([0.2, 2.4, -3.6], 0.35)}
            scale={[6.4, 0.16, 1]}
          />
          <Lightformer
            form="rect"
            intensity={6}
            color="#ffffff"
            position={[-2.4, 1.5, -3.1]}
            rotation={stripFacing([-2.4, 1.5, -3.1], 1.05)}
            scale={[4.8, 0.12, 1]}
          />
          <Lightformer
            form="rect"
            intensity={5}
            color="#ffffff"
            position={[2.5, 1.7, -2.9]}
            rotation={stripFacing([2.5, 1.7, -2.9], -0.9)}
            scale={[4.6, 0.12, 1]}
          />
          <Lightformer
            form="rect"
            intensity={4.5}
            color="#d5ecff"
            position={[0.1, 0.2, -3.8]}
            rotation={stripFacing([0.1, 0.2, -3.8], 0.15)}
            scale={[5.4, 0.2, 1]}
          />
          <Lightformer form="circle" intensity={9} color={CORE_COLOR} position={[0, CORE_Y, CORE_Z]} scale={[4.2, 1.7, 1]} />
          <Lightformer
            form="rect"
            intensity={2}
            color="#2a62ff"
            position={[-4.6, -0.8, 0.2]}
            rotation={stripFacing([-4.6, -0.8, 0.2], 0.5)}
            scale={[10, 7, 1]}
          />
          <Lightformer
            form="rect"
            intensity={2}
            color="#2a62ff"
            position={[4.6, -0.7, 0.1]}
            rotation={stripFacing([4.6, -0.7, 0.1], -0.45)}
            scale={[10, 7, 1]}
          />
          <Lightformer
            form="rect"
            intensity={2.6}
            color="#1d4dff"
            position={[0.1, -3.6, 0.2]}
            rotation={stripFacing([0.1, -3.6, 0.2], 0.15)}
            scale={[14, 6, 1]}
          />
          <Lightformer form="circle" intensity={1.2} color="#2458f0" position={[0, -1.1, -0.4]} scale={[16, 11, 1]} />
        </Environment>
      </Suspense>

      <directionalLight ref={key} position={[0.35, 0.7, 2.6]} intensity={PRODUCT_KEY} color="#fff8f2" />
      <directionalLight ref={rim} position={[-2.4, 1.2, 2.8]} intensity={PRODUCT_RIM} color="#f3f5f8" />

      <mesh name="studio-sky" frustumCulled={false} renderOrder={-1}>
        <sphereGeometry args={[30, 24, 16]} />
        <shaderMaterial
          ref={sky}
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={{ uBg: { value: background }, uGlow: { value: glow }, uCore: { value: coreDir } }}
          vertexShader={`
            varying vec3 vDir;
            void main() {
              vDir = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uBg;
            uniform vec3 uGlow;
            uniform vec3 uCore;
            varying vec3 vDir;
            void main() {
              vec3 dir = normalize(vDir);
              float around = pow(max(dot(dir, normalize(uCore)), 0.0), 2.8);
              float edge = smoothstep(0.05, 0.9, abs(dir.y));
              vec3 col = mix(uBg, uGlow, around * 0.22);
              col = mix(col, uBg, edge);
              gl_FragColor = vec4(col, 1.0);
            }
          `}
        />
      </mesh>
    </>
  );
}

const NOISE_GLSL = `
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
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.02 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }
`;

function Core() {
  const sprite = useRef<THREE.Mesh>(null);
  const streaks = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const streakMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const spot = useMemo(() => {
    const placed = new THREE.Vector3();
    coreOffset(new THREE.Vector3(0, CAMERA_HEIGHT, CAMERA_DISTANCE), placed);
    return placed;
  }, []);
  const coreColor = useMemo(() => new THREE.Color(CORE_COLOR), []);
  const blueColor = useMemo(() => new THREE.Color(GEM_COLOR), []);
  const glowColor = useMemo(() => new THREE.Color(BACKGROUND_GLOW), []);
  const edgeColor = useMemo(() => new THREE.Color(BACKGROUND_COLOR), []);

  useFrame((state) => {
    const cam = state.camera.position;
    const dx = -cam.x;
    const dz = -cam.z;
    const len = Math.hypot(dx, dz) || 1;
    spot.set((dx / len) * Math.abs(CORE_Z), 0.16, (dz / len) * Math.abs(CORE_Z));
    const pulse = 1 + Math.sin(state.clock.elapsedTime * CORE_PULSE_SPEED) * CORE_PULSE;
    if (sprite.current) {
      sprite.current.position.copy(spot);
      sprite.current.quaternion.copy(state.camera.quaternion);
    }
    if (streaks.current) {
      streaks.current.position.copy(spot);
      streaks.current.quaternion.copy(state.camera.quaternion);
    }
    if (light.current) {
      light.current.position.copy(spot);
      light.current.intensity = CORE_INTENSITY * 6 * pulse;
    }
    if (material.current) {
      material.current.uniforms.uIntensity.value = CORE_INTENSITY * pulse;
      material.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
    const t = state.clock.elapsedTime;
    streakMeshes.current.forEach((mesh, i) => {
      if (!mesh) return;
      const drift = Math.sin(t * (0.07 + i * 0.02) + i) * (0.7 + i * 0.25);
      mesh.position.set(drift, (i - 1) * 0.22, 0.05 * i);
    });
  });

  return (
    <>
      <mesh ref={sprite} scale={[8.2, 3.28, 1]} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={material}
          transparent
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
          uniforms={{
            uCore: { value: coreColor },
            uBlue: { value: blueColor },
            uGlow: { value: glowColor },
            uEdge: { value: edgeColor },
            uIntensity: { value: CORE_INTENSITY },
            uTime: { value: 0 },
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uCore;
            uniform vec3 uBlue;
            uniform vec3 uGlow;
            uniform vec3 uEdge;
            uniform float uIntensity;
            uniform float uTime;
            varying vec2 vUv;
            ${NOISE_GLSL}
            void main() {
              vec2 uv = vUv - 0.5;
              float t = uTime * 0.045;
              float cloud = fbm(uv * vec2(2.4, 4.2) + t);
              cloud += fbm(uv * vec2(5.5, 9.0) - t * 1.3 + 3.1) * 0.45;
              float angle = atan(uv.y, uv.x);
              float wobble = fbm(vec2(angle * 1.3, t * 0.6));
              float d = length(uv) * 2.0;
              float edgeNoise = smoothstep(0.18, 0.72, d);
              d += (cloud - 0.5) * 0.62 * edgeNoise;
              d += (wobble - 0.5) * 0.4 * edgeNoise;
              float hot = exp(-d * d * 160.0);
              float blue = exp(-d * d * 9.5);
              float navy = exp(-d * d * 1.35) * smoothstep(1.3, 0.2, d);
              vec3 deep = mix(uBlue, vec3(0.05, 0.12, 0.55), 0.85);
              vec3 col = uGlow * navy * 0.2 + deep * blue * 0.8 + uCore * hot * 0.7;
              float peak = max(col.r, max(col.g, col.b));
              float cap = 0.48;
              if (peak > cap) col *= cap / peak;
              float edge = smoothstep(0.5, 0.28, max(abs(uv.x), abs(uv.y)));
              gl_FragColor = vec4(col, clamp(navy, 0.0, 1.0) * edge);
            }
          `}
        />
      </mesh>
      <group ref={streaks}>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            ref={(node) => {
              streakMeshes.current[i] = node;
            }}
            scale={[2.4 + i * 0.7, 0.07 + (i % 2) * 0.04, 1]}
            rotation={[0, 0, (i - 1) * 0.18]}
            frustumCulled={false}
            renderOrder={1}
          >
            <planeGeometry args={[1, 1]} />
            <shaderMaterial
              transparent
              depthWrite={false}
              toneMapped={false}
              blending={THREE.AdditiveBlending}
              uniforms={{
                uColor: { value: i === 1 ? coreColor : glowColor },
              }}
              vertexShader={`
                varying vec2 vUv;
                void main() {
                  vUv = uv;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `}
              fragmentShader={`
                uniform vec3 uColor;
                varying vec2 vUv;
                void main() {
                  vec2 uv = vUv - 0.5;
                  float across = exp(-pow(abs(uv.y) * 2.0, 2.0) * 14.0);
                  float along = exp(-pow(abs(uv.x) * 2.0, 2.0) * 1.1);
                  float a = across * along * 0.028;
                  gl_FragColor = vec4(uColor, a);
                }
              `}
            />
          </mesh>
        ))}
      </group>
      <pointLight ref={light} color={CORE_COLOR} intensity={CORE_INTENSITY * 6} distance={16} decay={2} />
    </>
  );
}

function Haze() {
  const sheets = useMemo(
    () =>
      Array.from({ length: HAZE_LAYERS }, (_, i) => {
        const u = i / Math.max(HAZE_LAYERS - 1, 1);
        return {
          position: [(i - 2) * 0.85, (i % 2 === 0 ? 0.35 : -0.2) + u * 0.15, -2.4 + u * 3.6] as [
            number,
            number,
            number,
          ],
          alpha: 0.11 + (1 - u) * 0.07,
          scale: 18 - u * 3,
          speed: 0.03 + i * 0.008,
        };
      }),
    [],
  );
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const hazeColor = useMemo(() => new THREE.Color(HAZE_COLOR), []);
  const hazeLift = useMemo(() => new THREE.Color(HAZE_LIFT), []);
  const corePos = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    coreOffset(state.camera.position, corePos);
    meshes.current.forEach((mesh) => {
      if (!mesh) return;
      mesh.quaternion.copy(state.camera.quaternion);
      const mat = mesh.material as THREE.ShaderMaterial;
      if (!mat.uniforms) return;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uCorePos.value.copy(corePos);
    });
  });

  return (
    <group>
      {sheets.map((sheet, i) => (
        <mesh
          key={i}
          position={sheet.position}
          scale={sheet.scale}
          frustumCulled={false}
          renderOrder={2}
          ref={(node) => {
            meshes.current[i] = node;
          }}
        >
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            uniforms={{
              uColor: { value: hazeColor },
              uLift: { value: hazeLift },
              uAlpha: { value: sheet.alpha },
              uTime: { value: 0 },
              uSpeed: { value: sheet.speed },
              uCorePos: { value: new THREE.Vector3() },
            }}
            vertexShader={`
              varying vec2 vUv;
              varying vec3 vWorld;
              void main() {
                vUv = uv;
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xyz;
                gl_Position = projectionMatrix * viewMatrix * world;
              }
            `}
            fragmentShader={`
              uniform vec3 uColor;
              uniform vec3 uLift;
              uniform float uAlpha;
              uniform float uTime;
              uniform float uSpeed;
              uniform vec3 uCorePos;
              varying vec2 vUv;
              varying vec3 vWorld;
              ${NOISE_GLSL}
              void main() {
                vec2 p = (vUv - 0.5) * 3.2;
                float t = uTime * uSpeed;
                vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
                vec2 r = vec2(
                  fbm(p + q * 1.7 + vec2(1.7, 9.2)),
                  fbm(p + q * 1.7 + vec2(8.3, 2.8) + t * 0.4)
                );
                float n = fbm(p + r * 1.45);
                float cloud = smoothstep(0.26, 0.68, n);
                float fade = smoothstep(0.0, 0.28, vUv.x) * smoothstep(1.0, 0.72, vUv.x);
                fade *= smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
                float dist = length(vWorld - uCorePos);
                float nearCore = exp(-dist * dist * 0.055);
                vec3 col = mix(uColor, uLift, 0.8) * (1.4 + nearCore * 2.4);
                float a = cloud * fade * (uAlpha * 0.25 + nearCore * 0.45);
                gl_FragColor = vec4(col, a);
              }
            `}
          />
        </mesh>
      ))}
    </group>
  );
}

function dustTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Dust() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const map = useMemo(dustTexture, []);
  const motes = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        x: (Math.random() - 0.5) * 11,
        y: (Math.random() - 0.5) * 6.5,
        z: (Math.random() - 0.5) * 12,
        size: 0.004 + Math.random() * 0.008,
        phase: Math.random() * Math.PI * 2,
        bright: i % 20 === 0,
      })),
    [],
  );

  useLayoutEffect(() => {
    const color = new THREE.Color(DUST_COLOR);
    motes.forEach((mote, i) => {
      mesh.current?.setColorAt(i, color.clone().multiplyScalar(mote.bright ? 1.55 : 0.16));
    });
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [motes]);

  useEffect(() => () => map.dispose(), [map]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const inst = mesh.current;
    if (!inst) return;
    motes.forEach((mote, i) => {
      dummy.position.set(
        mote.x + Math.sin(t * 0.05 + mote.phase) * 0.45,
        mote.y + Math.sin(t * 0.07 + mote.phase * 1.3) * 0.28,
        mote.z + Math.cos(t * 0.04 + mote.phase) * 0.4,
      );
      dummy.scale.setScalar(mote.size * (mote.bright ? 2.4 : 1));
      dummy.quaternion.copy(state.camera.quaternion);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[null as unknown as THREE.BufferGeometry, null as unknown as THREE.Material, PARTICLE_COUNT]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} color="#ffffff" blending={THREE.AdditiveBlending} toneMapped={false} />
    </instancedMesh>
  );
}

function profile(points: [number, number][]) {
  return points.map(([x, y]) => new THREE.Vector2(x, y));
}

function jarProfile() {
  const R = JAR_WIDTH * 0.5;
  const H = JAR_HEIGHT;
  const corner = 0.11;
  const pts: [number, number][] = [[0.001, 0], [R - corner, 0]];
  for (let i = 1; i <= 7; i++) {
    const a = (i / 7) * (Math.PI / 2);
    pts.push([R - corner + Math.sin(a) * corner, (1 - Math.cos(a)) * corner]);
  }
  pts.push([R * 0.99, H * 0.62], [R * 0.965, H * 0.82], [R * 0.99, H * 0.91], [R * 1.015, H * 0.965], [R, H]);
  // Thick lip: the top steps inward so the wall reads as a rim, not a knife edge.
  pts.push([R * 0.78, H], [R * 0.74, H - 0.05], [0.001, H - 0.05]);
  return profile(pts);
}

function lidProfile() {
  const R = JAR_WIDTH * 0.5 * 0.92;
  const H = LID_HEIGHT;
  return profile([
    [0.001, 0],
    [R * 0.9, 0],
    [R, 0.03],
    [R, H * 0.58],
    [R * 0.955, H * 0.66],
    [R, H * 0.74],
    [R, H * 0.86],
    [R * 0.9, H],
    [0.001, H],
  ]);
}

function bandProfile() {
  const R = JAR_WIDTH * 0.5 + 0.012;
  const y = 0.085;
  return profile([
    [R - 0.014, y],
    [R, y + 0.008],
    [R, y + 0.026],
    [R - 0.014, y + 0.034],
  ]);
}

function brandTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (!ctx) return tex;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1a2744';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const drawTracked = (text: string, y: number, tracking: number) => {
    const glyphs = [...text];
    const widths = glyphs.map((glyph) => ctx.measureText(glyph).width);
    const total = widths.reduce((sum, width) => sum + width, 0) + tracking * (glyphs.length - 1);
    let cursor = (canvas.width - total) / 2;
    glyphs.forEach((glyph, i) => {
      ctx.fillText(glyph, cursor, y);
      cursor += widths[i] + tracking;
    });
  };
  ctx.font = '500 198px Outfit, Helvetica, sans-serif';
  drawTracked(BRAND_TEXT, 90, 18);
  ctx.fillStyle = 'rgba(15, 24, 43, 0.84)';
  ctx.font = '500 152px Outfit, Helvetica, sans-serif';
  drawTracked('CRÈME', 268, 10);
  tex.needsUpdate = true;
  return tex;
}

function shadeJar(shader: { vertexShader: string; fragmentShader: string }) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vJarNormal;')
    .replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
       vJarNormal = normalize(mat3(modelMatrix) * objectNormal);`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vJarNormal;')
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       vec3 jarN = normalize(vJarNormal);
       float glowSide = clamp(dot(jarN, normalize(vec3(0.0, 0.22, -1.0))), 0.0, 1.0);
       diffuseColor.rgb *= mix(0.78, 1.16, glowSide);
       float sweep = pow(clamp(dot(jarN, normalize(vec3(0.3, 0.58, 0.75))), 0.0, 1.0), 7.0);
       diffuseColor.rgb += vec3(0.16, 0.15, 0.13) * sweep;`,
    );
}

function Product() {
  const jar = useMemo(jarProfile, []);
  const lid = useMemo(lidProfile, []);
  const band = useMemo(bandProfile, []);
  const brand = useMemo(brandTexture, []);
  const glowColor = useMemo(() => new THREE.Color(JAR_COLOR), []);

  useEffect(() => () => brand.dispose(), [brand]);

  const onProduct = (mesh: THREE.Object3D) => {
    mesh.layers.set(PRODUCT_LAYER);
  };

  return (
    <group name="PRODUCT_SLOT" position={[0, 0.05, 0]}>
      <group name="PRODUCT_MODEL" position={[0, -JAR_HEIGHT * 0.42, 0]} rotation={[0, 0, 0]}>
        <mesh onUpdate={onProduct} castShadow>
          <latheGeometry args={[jar, 72]} />
          <meshPhysicalMaterial
            color={JAR_COLOR}
            roughness={0.35}
            metalness={0.02}
            clearcoat={0.4}
            clearcoatRoughness={0.42}
            sheen={0.35}
            sheenRoughness={0.55}
            sheenColor={JAR_COLOR}
            envMapIntensity={0}
            onBeforeCompile={shadeJar}
          />
        </mesh>
        <mesh onUpdate={onProduct} position={[0, JAR_HEIGHT + 0.01, 0]}>
          <latheGeometry args={[lid, 72]} />
          <meshPhysicalMaterial color={LID_COLOR} metalness={1} roughness={0.28} envMapIntensity={0.15} />
        </mesh>
        <mesh onUpdate={onProduct}>
          <latheGeometry args={[band, 72]} />
          <meshPhysicalMaterial
            color={GEM_COLOR}
            roughness={0.22}
            metalness={0.2}
            clearcoat={0.55}
            clearcoatRoughness={0.25}
            emissive={GEM_COLOR}
            emissiveIntensity={0.22}
            envMapIntensity={0}
          />
        </mesh>
        <mesh
          onUpdate={onProduct}
          position={[0, JAR_HEIGHT * 0.46, 0]}
        >
          <cylinderGeometry args={[JAR_WIDTH * 0.5 + 0.012, JAR_WIDTH * 0.5 + 0.012, 0.2, 48, 1, true, -0.52, 1.04]} />
          <meshStandardMaterial
            map={brand}
            transparent
            depthWrite={false}
            roughness={0.4}
            metalness={0.35}
            color="#f4f2ec"
            envMapIntensity={0}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -JAR_HEIGHT * 0.42 + 0.01, -0.02]} renderOrder={2}>
        <planeGeometry args={[1.15, 1.15]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          uniforms={{ uColor: { value: glowColor } }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vUv;
            uniform vec3 uColor;
            void main() {
              vec2 p = vUv * 2.0 - 1.0;
              float r = length(p);
              float ring = smoothstep(0.4, 0.62, r) * smoothstep(1.0, 0.68, r);
              float back = smoothstep(0.2, 0.95, vUv.y);
              gl_FragColor = vec4(uColor, ring * (0.07 + back * 0.2));
            }
          `}
        />
      </mesh>
    </group>
  );
}

function holdClear(target: THREE.Vector3) {
  const limit = CENTER_CLEAR_RADIUS + 0.08;
  const r = Math.hypot(target.x, target.z);
  if (r < limit) {
    const side = Math.abs(target.x) < 0.08 ? 1 : Math.sign(target.x);
    const room = limit * limit - target.z * target.z;
    target.x = side * Math.sqrt(Math.max(room, 0.04));
  }
}

function placeGem(gem: Gem, time: number, target: THREE.Vector3) {
  const u = gem.u + Math.sin(time * gem.speed + gem.phase) * gem.drift;
  arcAt(u, target);
  target.x += gem.jitter[0];
  target.y += gem.jitter[1];
  target.z += gem.jitter[2];
  holdClear(target);
}

/** Girdle radius of the brilliant at scale 1. Stones stay at least this far apart. */
const GEM_REACH = 0.6;

function relaxGems(points: THREE.Vector3[], gems: Gem[]) {
  const n = gems.length;
  for (let pass = 0; pass < 12; pass++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const minDist = GEM_REACH * (gems[i].scale + gems[j].scale) + 0.06;
        let dx = points[j].x - points[i].x;
        let dy = points[j].y - points[i].y;
        let dz = points[j].z - points[i].z;
        let dist = Math.hypot(dx, dy, dz);
        if (dist >= minDist) continue;
        if (dist < 1e-4) {
          dx = (i % 5) - 2;
          dy = (j % 3) - 1;
          dz = ((i + j) % 4) - 1.5;
          dist = Math.hypot(dx, dy, dz) || 1;
        }
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        const share = gems[i].scale + gems[j].scale;
        const mi = (gems[j].scale / share) * overlap;
        const mj = (gems[i].scale / share) * overlap;
        points[i].x -= nx * mi;
        points[i].y -= ny * mi;
        points[i].z -= nz * mi;
        points[j].x += nx * mj;
        points[j].y += ny * mj;
        points[j].z += nz * mj;
      }
    }
    for (let i = 0; i < n; i++) holdClear(points[i]);
  }
}

function liftGem(intensity: number) {
  return (shader: { uniforms: Record<string, { value: unknown }>; fragmentShader: string }) => {
    shader.uniforms.envMapIntensity = { value: intensity };
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform float opacity;', 'uniform float opacity;\nuniform float envMapIntensity;')
      .replace(
        'gl_FragColor = vec4(mix(diffuseColor.rgb, vec3(1.0), nFresnel), diffuseColor.a);',
        `diffuseColor.rgb *= envMapIntensity;
         vec3 lit = mix(diffuseColor.rgb, vec3(1.0), nFresnel);
         float peak = max(lit.r, max(lit.g, lit.b));
         vec3 sapphire = vec3(0.02, 0.04, 0.1);
         lit = mix(sapphire, lit, smoothstep(0.0, 0.18, peak));
         lit = min(lit, vec3(0.82));
         gl_FragColor = vec4(lit, diffuseColor.a);`,
      );
  };
}

const liftLargeGem = liftGem(2.3);
const liftMidGem = liftGem(4);

function Gems() {
  const environment = useThree((s) => s.scene.environment);
  const geometry = useMemo(brilliantCutGeometry, []);
  const gems = useMemo(makeGems, []);
  const refractive = useMemo(() => gems.filter((gem) => gem.tier !== 'small'), [gems]);
  const smallCount = useMemo(() => gems.filter((gem) => gem.tier === 'small').length, [gems]);
  const smallTint = useMemo(() => new THREE.Color(GEM_COLOR).lerp(new THREE.Color('#001544'), 0.45), []);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const instanced = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const points = useMemo(() => gems.map(() => new THREE.Vector3()), [gems]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // next to the other useMemo/useRef lines
  const smooth = useMemo(() => gems.map(() => new THREE.Vector3()), [gems]);
  const primed = useRef(false);

  useFrame((state, rawDelta) => {
    const t = state.clock.elapsedTime;
    const px = state.pointer.x * CURSOR_DRIFT;
    const py = state.pointer.y * CURSOR_DRIFT;
    gems.forEach((gem, i) => placeGem(gem, t, points[i]));
    relaxGems(points, gems);
    // damp toward the solved positions so any flip becomes a glide
      const k = 1 - Math.exp(-3.5 * Math.min(rawDelta, 0.05));
      points.forEach((p, i) => {
        if (!primed.current) smooth[i].copy(p);
        else smooth[i].lerp(p, k);
      });
    primed.current = true;
    let mid = 0;
    let pebble = 0;
    gems.forEach((gem, i) => {
      const p = smooth[i];
      const x = p.x - px * 0.35;
      const z = p.z - py * 0.2;
      if (gem.tier === 'small') {
        const inst = instanced.current;
        if (!inst) return;
        dummy.position.set(x, p.y, z);
        dummy.rotation.set(gem.tilt, t * gem.spin + gem.phase, gem.roll);
        dummy.scale.setScalar(gem.scale);
        dummy.updateMatrix();
        inst.setMatrixAt(pebble, dummy.matrix);
        pebble += 1;
      } else {
        const mesh = meshes.current[mid];
        mid += 1;
        if (!mesh) return;
        mesh.position.set(x, p.y, z);
        mesh.rotation.set(gem.tilt, t * gem.spin + gem.phase, gem.roll);
      }
    });
    if (instanced.current) instanced.current.instanceMatrix.needsUpdate = true;
  });

  if (!environment) return null;

  return (
    <group>
      {refractive.map((gem, i) => (
        <mesh
          key={i}
          ref={(node) => {
            meshes.current[i] = node;
          }}
          geometry={geometry}
          scale={gem.scale}
        >
          <MeshRefractionMaterial
            envMap={environment}
            bounces={gem.tier === 'large' ? 6 : 4}
            ior={GEM_IOR}
            fresnel={0.8}
            aberrationStrength={gem.tier === 'large' ? 0 : 0.02}
            fastChroma={gem.tier !== 'large'}
            color={GEM_COLOR}
            onBeforeCompile={gem.tier === 'large' ? liftLargeGem : liftMidGem}
          />
        </mesh>
      ))}
      <instancedMesh
        ref={instanced}
        args={[geometry, undefined as unknown as THREE.Material, smallCount]}
        frustumCulled={false}
      >
        <meshStandardMaterial
          color={smallTint}
          emissive={smallTint}
          emissiveIntensity={0.55}
          roughness={0.08}
          metalness={0.42}
          envMapIntensity={2.9}
        />
      </instancedMesh>
    </group>
  );
}

function Look() {
  const look = useMemo(() => new THREE.Vector3(0, 0.05, 0), []);
  const goal = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const sway = Math.sin(state.clock.elapsedTime * CAMERA_ORBIT_SPEED) * CAMERA_SWAY;
    goal.set(
      Math.sin(sway) * CAMERA_DISTANCE + state.pointer.x * CAMERA_PARALLAX,
      CAMERA_HEIGHT - state.pointer.y * CAMERA_PARALLAX * 0.45,
      Math.cos(sway) * CAMERA_DISTANCE,
    );
    state.camera.position.lerp(goal, 1 - Math.exp(-2.4 * delta));
    state.camera.lookAt(look);
  });

  return null;
}

function Grade() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const composer = useMemo(() => {
    const effect = new EffectComposer(gl, { multisampling: 0, frameBufferType: THREE.HalfFloatType });
    const dof = new DepthOfFieldEffect(camera, {
      worldFocusDistance: DOF_FOCUS,
      worldFocusRange: DOF_RANGE,
      bokehScale: DOF_SCALE,
      resolutionScale: 0.5,
    });
    effect.addPass(new RenderPass(scene, camera));
    effect.addPass(new EffectPass(camera, dof));
    effect.addPass(
      new EffectPass(
        camera,
        new BloomEffect({
          intensity: BLOOM_STRENGTH,
          luminanceThreshold: BLOOM_THRESHOLD,
          luminanceSmoothing: 0.4,
          mipmapBlur: true,
          radius: 0.32,
        }),
      ),
    );
    effect.addPass(
      new EffectPass(
        camera,
        new ChromaticAberrationEffect({
          offset: new THREE.Vector2(CHROMATIC_ABERRATION, CHROMATIC_ABERRATION * 0.6),
          radialModulation: true,
          modulationOffset: 0.18,
        }),
      ),
    );
    effect.addPass(new EffectPass(camera, new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })));
    effect.addPass(new EffectPass(camera, new VignetteEffect({ darkness: VIGNETTE_STRENGTH, offset: 0.18 })));
    return effect;
  }, [gl, scene, camera]);

  useLayoutEffect(() => {
    gl.toneMapping = THREE.NoToneMapping;
  }, [gl]);

  useEffect(() => composer.setSize(size.width, size.height), [composer, size]);
  useEffect(() => () => composer.dispose(), [composer]);

  useFrame((_, delta) => {
    composer.render(delta);
  }, 1);

  return null;
}

export function SapphiresScene() {
  return (
    <>
      <Studio />
      <Core />
      <Haze />
      <Dust />
      <Product />
      <Gems />
      <Look />
      <Grade />
    </>
  );
}
