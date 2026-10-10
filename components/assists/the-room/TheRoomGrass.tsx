'use client';

import { useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { RoomPuzzleState } from '@/components/assists/the-room/theRoomPuzzle';

/** Blade count on desktop for the whole floor; touch devices get a fraction of this. */
const DESKTOP_BLADES = 140_000;
const TOUCH_DENSITY = 0.45;

const BLADE_HEIGHT = 0.12;
const BLADE_HEIGHT_JITTER = 0.05;
const BLADE_WIDTH = 0.024;
const BLADE_SEGMENTS = 4;

/** Footprints: how many recent positions bend the grass, and how long until it springs back. */
const FOOTPRINTS = 14;
const FOOTPRINT_SPACING = 0.28;
const FOOTPRINT_RADIUS = 0.5;
const RECOVER_SECONDS = 2.6;

const BASE_TEXTURE = '/grass1024x1024.png';

const vertexShader = /* glsl */ `
uniform float uTime;
uniform vec4 uFootprints[${FOOTPRINTS}];
uniform float uCalm;
uniform vec2 uWindDir;
uniform vec2 uPathA;
uniform vec2 uPathB;
uniform float uPathReveal;
uniform float uHint;

attribute vec3 aRoot;   // x, z, facing angle
attribute vec3 aBlade;  // height, width, color variation 0-1

varying float vT;
varying float vVariation;
varying float vTrampled;
varying float vPatch;

float footprintInfluence(vec2 root, vec4 fp, out vec2 pushDir) {
  pushDir = vec2(0.0);
  if (fp.w <= 0.0) return 0.0;
  vec2 d = root - fp.xy;
  float dist = length(d);
  float age = uTime - fp.z;
  float reach = 1.0 - smoothstep(0.0, ${FOOTPRINT_RADIUS.toFixed(2)}, dist);
  float recover = 1.0 - smoothstep(0.0, ${RECOVER_SECONDS.toFixed(2)}, age);
  pushDir = dist > 1e-4 ? d / dist : vec2(0.0, 1.0);
  return reach * recover;
}

void main() {
  float t = position.y;
  vT = t;
  vVariation = aBlade.z;

  vec2 root = aRoot.xy;
  vPatch = 0.5 + 0.25 * sin(root.x * 0.7 + sin(root.y * 0.5) * 2.0)
               + 0.25 * sin(root.y * 0.9 + sin(root.x * 0.6) * 1.7);
  float c = cos(aRoot.z);
  float s = sin(aRoot.z);
  float across = position.x * aBlade.y;

  // Each blade leans a little in its own direction so the lawn isn't uniform.
  vec2 lean = vec2(cos(aRoot.z * 2.3), sin(aRoot.z * 2.3)) * 0.18 * (1.0 - 0.4 * uCalm);

  // Gentle wind: slow waves rolling along the wind direction plus a little per-blade flutter.
  // As the room calms, the wind turns to blow from the chair toward the visitor and the flutter settles.
  vec2 windDir = normalize(mix(vec2(1.0, 0.35), uWindDir, uCalm) + vec2(1e-4, 0.0));
  float gust = sin(uTime * 0.9 - dot(root, windDir) * 0.55) * 0.5 + 0.5;
  float flutter = 1.0 - 0.75 * uCalm;
  float sway = (sin(uTime * 1.7 + root.x * 1.3 + root.y * 0.9) * 0.35
             + sin(uTime * 3.1 + aRoot.z * 6.0) * 0.08) * flutter;
  vec2 wind = windDir * (0.12 + gust * (0.22 + 0.08 * uCalm)) + windDir * sway * 0.18;

  // The path from the visitor to the chair: distance to the segment, and how far along it this blade is.
  vec2 ab = uPathB - uPathA;
  float abLen2 = max(dot(ab, ab), 1e-4);
  float along = clamp(dot(root - uPathA, ab) / abLen2, 0.0, 1.0);
  vec2 closest = uPathA + ab * along;
  float pathDist = length(root - closest);
  vec2 pathDir = ab / sqrt(abLen2);

  // Hint: after a long time walking, blades near the line lean faintly toward the chair.
  lean += pathDir * (1.0 - smoothstep(0.25, 1.1, pathDist)) * uHint * 0.45;

  // Trampling: blades push away from recent footprints and lie down, then recover.
  float trample = 0.0;
  vec2 push = vec2(0.0);
  for (int i = 0; i < ${FOOTPRINTS}; i++) {
    vec2 dir;
    float k = footprintInfluence(root, uFootprints[i], dir);
    if (k > trample) {
      trample = k;
      push = dir;
    }
  }

  // The revealed stretch of path lies flat, blades combed toward the chair and slightly outward.
  float revealed = (1.0 - smoothstep(uPathReveal - 0.03, uPathReveal + 0.03, along))
                 * smoothstep(0.0, 0.05, uPathReveal);
  float pathK = (1.0 - smoothstep(0.22, 0.5, pathDist)) * revealed * uCalm * 0.85;
  if (pathK > trample) {
    vec2 side = root - closest;
    vec2 outward = length(side) > 1e-4 ? normalize(side) : vec2(0.0);
    trample = pathK;
    push = normalize(pathDir * 0.8 + outward * 0.35);
  }
  vTrampled = trample;

  vec2 bend = mix(lean + wind, push * 0.92, trample);
  float bendAmount = min(length(bend), 0.92);
  bend = length(bend) > 1e-4 ? normalize(bend) * bendAmount : bend;
  // Keep blade length constant: the more it tips over, the lower the tip sits.
  float h = aBlade.x * sqrt(1.0 - bendAmount * bendAmount);

  // Bend grows toward the tip (quadratic) so the root stays planted.
  vec2 tipOffset = bend * aBlade.x * t * t;
  vec3 world = vec3(
    root.x + across * c + tipOffset.x,
    t * h,
    root.y + across * s + tipOffset.y
  );

  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const fragmentShader = /* glsl */ `
varying float vT;
varying float vVariation;
varying float vTrampled;
varying float vPatch;

void main() {
  vec3 base = vec3(0.012, 0.04, 0.008);
  vec3 deep = vec3(0.06, 0.17, 0.035);
  vec3 fresh = vec3(0.13, 0.26, 0.05);
  vec3 dry = vec3(0.26, 0.28, 0.09);
  vec3 tip = mix(deep, fresh, vVariation);
  // A few percent of blades are drier and yellower, like a real lawn.
  tip = mix(tip, dry, smoothstep(0.9, 1.0, vVariation));
  // Broad patches where the lawn is lusher or more sun-faded.
  tip *= mix(0.75, 1.2, vPatch);
  vec3 col = mix(base, tip, smoothstep(0.0, 0.85, vT));
  // Flattened blades show their paler undersides.
  col = mix(col, col * 1.3 + vec3(0.02, 0.025, 0.0), vTrampled * 0.6);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function makeBladeGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < BLADE_SEGMENTS; i++) {
    const t = i / BLADE_SEGMENTS;
    const halfWidth = 0.5 * (1 - t);
    positions.push(-halfWidth, t, 0, halfWidth, t, 0);
  }
  positions.push(0, 1, 0);
  for (let i = 0; i < BLADE_SEGMENTS - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (BLADE_SEGMENTS - 1) * 2;
  indices.push(last, last + 1, last + 2);

  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

function bladeCountForDevice() {
  const touch =
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  return Math.round(DESKTOP_BLADES * (touch ? TOUCH_DENSITY : 1));
}

export function TheRoomGrass({
  width,
  depth,
  puzzle,
}: {
  width: number;
  depth: number;
  puzzle: RoomPuzzleState;
}) {
  const camera = useThree((s) => s.camera);
  const footprints = useRef<{ x: number; z: number; time: number }[]>([]);
  const lastPrint = useRef<THREE.Vector2 | null>(null);

  const baseTexture = useTexture(BASE_TEXTURE);
  useMemo(() => {
    baseTexture.wrapS = baseTexture.wrapT = THREE.RepeatWrapping;
    baseTexture.repeat.set(width / 2, depth / 2);
    baseTexture.colorSpace = THREE.SRGBColorSpace;
    baseTexture.anisotropy = 8;
  }, [baseTexture, width, depth]);

  const geometry = useMemo(() => {
    const count = bladeCountForDevice();
    const geo = makeBladeGeometry();
    const roots = new Float32Array(count * 3);
    const blades = new Float32Array(count * 3);

    // Jittered grid gives even coverage without visible rows.
    const cols = Math.ceil(Math.sqrt((count * width) / depth));
    const rows = Math.ceil(count / cols);
    const cellW = width / cols;
    const cellD = depth / rows;
    for (let i = 0; i < count; i++) {
      const cx = i % cols;
      const cz = Math.floor(i / cols);
      roots[i * 3] = -width / 2 + (cx + Math.random()) * cellW;
      roots[i * 3 + 1] = -depth / 2 + (cz + Math.random()) * cellD;
      roots[i * 3 + 2] = Math.random() * Math.PI * 2;
      blades[i * 3] = BLADE_HEIGHT + (Math.random() - 0.5) * 2 * BLADE_HEIGHT_JITTER;
      blades[i * 3 + 1] = BLADE_WIDTH * (0.75 + Math.random() * 0.5);
      blades[i * 3 + 2] = Math.random();
    }
    geo.setAttribute('aRoot', new THREE.InstancedBufferAttribute(roots, 3));
    geo.setAttribute('aBlade', new THREE.InstancedBufferAttribute(blades, 3));
    geo.instanceCount = count;
    return geo;
  }, [width, depth]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uFootprints: {
            value: Array.from({ length: FOOTPRINTS }, () => new THREE.Vector4(0, 0, 0, 0)),
          },
          uCalm: { value: 0 },
          uWindDir: { value: new THREE.Vector2(0, 1) },
          uPathA: { value: new THREE.Vector2() },
          uPathB: { value: new THREE.Vector2() },
          uPathReveal: { value: 0 },
          uHint: { value: 0 },
        },
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    material.uniforms.uTime.value = t;

    const feet = new THREE.Vector2(camera.position.x, camera.position.z);

    const u = material.uniforms;
    u.uCalm.value = puzzle.calm;
    u.uPathReveal.value = puzzle.pathReveal;
    u.uHint.value = puzzle.hint;
    (u.uPathA.value as THREE.Vector2).copy(puzzle.pathStart);
    (u.uPathB.value as THREE.Vector2).copy(puzzle.pathEnd);
    const towardVisitor = feet.clone().sub(puzzle.pathEnd);
    if (towardVisitor.lengthSq() > 0.01) (u.uWindDir.value as THREE.Vector2).copy(towardVisitor.normalize());
    if (!lastPrint.current || lastPrint.current.distanceTo(feet) >= FOOTPRINT_SPACING) {
      footprints.current.push({ x: feet.x, z: feet.y, time: t });
      lastPrint.current = feet.clone();
    }
    footprints.current = footprints.current
      .filter((f) => t - f.time < RECOVER_SECONDS)
      .slice(-(FOOTPRINTS - 1));

    const slots = material.uniforms.uFootprints.value as THREE.Vector4[];
    // Slot 0 is always where you're standing now, so grass stays flat under you while still.
    slots[0].set(feet.x, feet.y, t, 1);
    for (let i = 1; i < FOOTPRINTS; i++) {
      const f = footprints.current[i - 1];
      if (f) slots[i].set(f.x, f.z, f.time, 1);
      else slots[i].set(0, 0, 0, 0);
    }
  });

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={baseTexture} roughness={1} color="#9fb88f" />
      </mesh>
      {/* Every blade is drawn in one call; culling is off because the geometry's bounds are
          a single blade, which would otherwise hide the whole lawn. */}
      <mesh geometry={geometry} material={material} frustumCulled={false} />
    </>
  );
}
