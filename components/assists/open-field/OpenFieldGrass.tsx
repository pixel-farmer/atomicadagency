'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const TOUCH_DENSITY = 0.45;

const BLADE_HEIGHT = 0.28;
const BLADE_HEIGHT_JITTER = 0.09;
const BLADE_WIDTH = 0.036;
/** More segments than a short lawn so the taller blades curve smoothly as they sway. */
const BLADE_SEGMENTS = 5;

/** Scales the whole breeze: steady push, rolling gusts and per-blade flutter. */
const WIND_STRENGTH = 1.35;
const WIND_DIRECTION = new THREE.Vector2(1, 0.35).normalize();

/** Footprints: how many recent positions bend the grass, and how long until it springs back. */
const FOOTPRINTS = 14;
const FOOTPRINT_SPACING = 0.28;
const RECOVER_SECONDS = 2.6;

/** Tone of the ground past the blades, matched to the grass as it fades into the haze. */
const GROUND_COLOR = '#2f5a1f';

const vertexShader = /* glsl */ `
uniform float uTime;
uniform vec4 uFootprints[${FOOTPRINTS}];
uniform vec2 uCenter;
uniform vec2 uWrap;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform float uPartRadius;
uniform vec3 uShadow;   // x, z, radius of whatever sits on the grass
uniform vec2 uCaustic;  // xz offset of the bright spot, opposite the sun

attribute vec3 aRoot;   // x, z, facing angle
attribute vec3 aBlade;  // height, width, color variation 0-1

varying float vT;
varying float vVariation;
varying float vTrampled;
varying float vPatch;
varying float vShade;

#include <fog_pars_vertex>

float footprintInfluence(vec2 root, vec4 fp, out vec2 pushDir) {
  pushDir = vec2(0.0);
  if (fp.w <= 0.0) return 0.0;
  vec2 d = root - fp.xy;
  float dist = length(d);
  float age = uTime - fp.z;
  float reach = 1.0 - smoothstep(0.0, uPartRadius, dist);
  float recover = 1.0 - smoothstep(0.0, ${RECOVER_SECONDS.toFixed(2)}, age);
  pushDir = dist > 1e-4 ? d / dist : vec2(0.0, 1.0);
  return reach * recover;
}

void main() {
  float t = position.y;
  vT = t;
  vVariation = aBlade.z;

  // The patch wraps around the camera so blades stay put in the world while the field never
  // runs out; blades shrink away toward the patch edge.
  vec2 root = uCenter + mod(aRoot.xy - uCenter + 0.5 * uWrap, uWrap) - 0.5 * uWrap;
  float r = length(root - uCenter) / (0.5 * min(uWrap.x, uWrap.y));
  float edgeFade = 1.0 - smoothstep(0.4, 1.0, r);

  vPatch = 0.5 + 0.25 * sin(root.x * 0.7 + sin(root.y * 0.5) * 2.0)
               + 0.25 * sin(root.y * 0.9 + sin(root.x * 0.6) * 1.7);
  float c = cos(aRoot.z);
  float s = sin(aRoot.z);
  float across = position.x * aBlade.y;

  // Each blade leans a little in its own direction so the field isn't uniform.
  vec2 lean = vec2(cos(aRoot.z * 2.3), sin(aRoot.z * 2.3)) * 0.18;

  // Slow waves rolling along the wind direction plus a little per-blade flutter.
  vec2 windDir = uWindDir;
  float gust = sin(uTime * 0.9 - dot(root, windDir) * 0.55) * 0.5 + 0.5;
  float sway = sin(uTime * 1.7 + root.x * 1.3 + root.y * 0.9) * 0.35
             + sin(uTime * 3.1 + aRoot.z * 6.0) * 0.08;
  vec2 wind = (windDir * (0.12 + gust * 0.22) + windDir * sway * 0.18) * uWindStrength;

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
  vTrampled = trample;
  // Soft darkening where the ball meets the grass, plus a bright spot on the far side of the sun.
  float shadowD = length(root - uShadow.xy) / max(uShadow.z, 1e-4);
  float contact = 1.0 - 0.5 * (1.0 - smoothstep(0.2, 3.2, shadowD));
  float causticD = length(root - (uShadow.xy + uCaustic)) / max(uShadow.z, 1e-4);
  float caustic = 1.55 * (1.0 - smoothstep(0.0, 0.7, causticD));
  vShade = uShadow.z > 0.0 ? contact + caustic : 1.0;

  vec2 bend = mix(lean + wind, push * 0.92, trample);
  float bendAmount = min(length(bend), 0.92);
  bend = length(bend) > 1e-4 ? normalize(bend) * bendAmount : bend;
  // Keep blade length constant: the more it tips over, the lower the tip sits.
  float h = aBlade.x * sqrt(1.0 - bendAmount * bendAmount) * edgeFade;

  // Bend grows toward the tip (quadratic) so the root stays planted.
  vec2 tipOffset = bend * aBlade.x * edgeFade * t * t;
  vec3 world = vec3(
    root.x + across * c + tipOffset.x,
    t * h,
    root.y + across * s + tipOffset.y
  );

  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragmentShader = /* glsl */ `
varying float vT;
varying float vVariation;
varying float vTrampled;
varying float vPatch;
varying float vShade;

#include <fog_pars_fragment>

void main() {
  vec3 base = vec3(0.012, 0.04, 0.008);
  vec3 deep = vec3(0.06, 0.17, 0.035);
  vec3 fresh = vec3(0.13, 0.26, 0.05);
  vec3 dry = vec3(0.26, 0.28, 0.09);
  vec3 tip = mix(deep, fresh, vVariation);
  // A few percent of blades are drier and yellower, like a real field.
  tip = mix(tip, dry, smoothstep(0.9, 1.0, vVariation));
  // Broad patches where the grass is lusher or more sun-faded.
  tip *= mix(0.75, 1.2, vPatch);
  vec3 col = mix(base, tip, smoothstep(0.0, 0.85, vT));
  // Flattened blades show their paler undersides.
  col = mix(col, col * 1.3 + vec3(0.02, 0.025, 0.0), vTrampled * 0.6);
  col *= vShade;

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
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

function bladeCountForDevice(desktopBlades: number) {
  const touch =
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  return Math.round(desktopBlades * (touch ? TOUCH_DENSITY : 1));
}

/**
 * A square patch of `patchSize` blades that travels with `focus` (or the camera) over a ground
 * plane of `groundSize`, so the field never runs out of grass. The grass parts around `focus`
 * and springs back along its trail.
 */
export function OpenFieldGrass({
  patchSize,
  groundSize,
  bladeCount,
  focus,
  partRadius = 0.55,
  shadowRadius = 0,
}: {
  patchSize: number;
  groundSize: number;
  /** Blade count on desktop; touch devices get a fraction of this. */
  bladeCount: number;
  /** What presses the grass (a rolling ball, say); defaults to the camera's feet. */
  focus?: THREE.Vector3;
  partRadius?: number;
  /** Radius of the soft shadow drawn on the blades under `focus`; 0 for none. */
  shadowRadius?: number;
}) {
  const camera = useThree((s) => s.camera);
  const footprints = useRef<{ x: number; z: number; time: number }[]>([]);
  const lastPrint = useRef<THREE.Vector2 | null>(null);

  const geometry = useMemo(() => {
    const count = bladeCountForDevice(bladeCount);
    const geo = makeBladeGeometry();
    const roots = new Float32Array(count * 3);
    const blades = new Float32Array(count * 3);

    // Jittered grid gives even coverage without visible rows.
    const cols = Math.ceil(Math.sqrt(count));
    const cell = patchSize / cols;
    for (let i = 0; i < count; i++) {
      const cx = i % cols;
      const cz = Math.floor(i / cols);
      roots[i * 3] = -patchSize / 2 + (cx + Math.random()) * cell;
      roots[i * 3 + 1] = -patchSize / 2 + (cz + Math.random()) * cell;
      roots[i * 3 + 2] = Math.random() * Math.PI * 2;
      blades[i * 3] = BLADE_HEIGHT + (Math.random() - 0.5) * 2 * BLADE_HEIGHT_JITTER;
      blades[i * 3 + 1] = BLADE_WIDTH * (0.75 + Math.random() * 0.5);
      blades[i * 3 + 2] = Math.random();
    }
    geo.setAttribute('aRoot', new THREE.InstancedBufferAttribute(roots, 3));
    geo.setAttribute('aBlade', new THREE.InstancedBufferAttribute(blades, 3));
    geo.instanceCount = count;
    return geo;
  }, [patchSize, bladeCount]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.DoubleSide,
        fog: true,
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          uTime: { value: 0 },
          uCenter: { value: new THREE.Vector2() },
          uWrap: { value: new THREE.Vector2(patchSize, patchSize) },
          uWindDir: { value: WIND_DIRECTION.clone() },
          uWindStrength: { value: WIND_STRENGTH },
          uPartRadius: { value: partRadius },
          uShadow: { value: new THREE.Vector3(0, 0, shadowRadius) },
          // Opposite SUN_POSITION's ground direction, just past the ball.
          uCaustic: { value: new THREE.Vector2(-1.0, -0.67) },
          uFootprints: {
            value: Array.from({ length: FOOTPRINTS }, () => new THREE.Vector4(0, 0, 0, 0)),
          },
        },
      }),
    [patchSize, partRadius, shadowRadius],
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
    const u = material.uniforms;
    u.uTime.value = t;

    const source = focus ?? camera.position;
    const feet = new THREE.Vector2(source.x, source.z);
    (u.uCenter.value as THREE.Vector2).copy(feet);
    const shadow = u.uShadow.value as THREE.Vector3;
    shadow.x = feet.x;
    shadow.y = feet.y;

    if (!lastPrint.current || lastPrint.current.distanceTo(feet) >= FOOTPRINT_SPACING) {
      footprints.current.push({ x: feet.x, z: feet.y, time: t });
      lastPrint.current = feet.clone();
    }
    footprints.current = footprints.current
      .filter((f) => t - f.time < RECOVER_SECONDS)
      .slice(-(FOOTPRINTS - 1));

    const slots = u.uFootprints.value as THREE.Vector4[];
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
        <planeGeometry args={[groundSize, groundSize]} />
        <meshBasicMaterial color={GROUND_COLOR} toneMapped={false} />
      </mesh>
      {/* Every blade is drawn in one call; culling is off because the geometry's bounds are
          a single blade, which would otherwise hide the whole field. */}
      <mesh geometry={geometry} material={material} frustumCulled={false} />
    </>
  );
}
