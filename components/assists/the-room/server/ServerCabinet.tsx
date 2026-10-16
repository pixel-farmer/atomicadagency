'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  CABINET,
  CABINET_MODELS,
  type MachineSpec,
} from '@/components/assists/the-room/server/serverRoomConfig';
import {
  createLedPanel,
  createScreen,
  registerLed,
  registerMachine,
  registerScreen,
} from '@/components/assists/the-room/server/serverDisplays';
import { getSharedParts } from '@/components/assists/the-room/server/serverTextures';
import { feedStats } from '@/components/assists/the-room/server/wikiFeed';

/** Above 1 so the screens and LEDs bloom through the grade. */
const SCREEN_GLOW: [number, number, number] = [1.35, 1.35, 1.35];
const LED_GLOW: [number, number, number] = [1.7, 1.7, 1.7];
/** Brightness of the lights painted into the models (rack units behind the glass, power lights). */
const PAINTED_GLOW = 1.6;

useGLTF.preload(CABINET_MODELS.terminal);
useGLTF.preload(CABINET_MODELS.rack);
useGLTF.preload(CABINET_MODELS.tape);

/**
 * Model meshes carry UVs into their texture atlas. The live screen and LED canvases fill the
 * whole texture, so those two meshes get their UVs stretched to 0..1 (once per model).
 */
const normalizedGeometry = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function fullTextureUVs(geometry: THREE.BufferGeometry) {
  const cached = normalizedGeometry.get(geometry);
  if (cached) return cached;
  const g = geometry.clone();
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    u0 = Math.min(u0, uv.getX(i));
    u1 = Math.max(u1, uv.getX(i));
    v0 = Math.min(v0, uv.getY(i));
    v1 = Math.max(v1, uv.getY(i));
  }
  for (let i = 0; i < uv.count; i++) {
    // glTF UVs run top-down; canvas textures expect v = 1 at the top.
    uv.setXY(i, (uv.getX(i) - u0) / (u1 - u0 || 1), 1 - (uv.getY(i) - v0) / (v1 - v0 || 1));
  }
  uv.needsUpdate = true;
  normalizedGeometry.set(geometry, g);
  return g;
}

/** One server cabinet: a terminal (live screen), a rack (glass door) or the tape drive (animated). */
export function ServerCabinet({ spec }: { spec: MachineSpec }) {
  return (
    <Suspense fallback={null}>
      <CabinetModel spec={spec} />
    </Suspense>
  );
}

function CabinetModel({ spec }: { spec: MachineSpec }) {
  const parts = getSharedParts();
  const gltf = useGLTF(spec.kind === 'rack' ? CABINET_MODELS.rack : spec.kind === 'tape' ? CABINET_MODELS.tape : CABINET_MODELS.terminal);
  const group = useRef<THREE.Group>(null);
  const led = useMemo(() => createLedPanel({ x: spec.x, z: spec.z }), [spec.x, spec.z]);
  const screen = useMemo(() => (spec.kind === 'screen' ? createScreen(spec.program ?? 0) : null), [spec.kind, spec.program]);

  const model = useMemo(() => {
    const root = gltf.scene.clone(true);
    const owned: THREE.Material[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = mesh.name || mesh.parent?.name || '';
      if (name.startsWith('LedPanel')) {
        mesh.geometry = fullTextureUVs(mesh.geometry);
        mesh.material = new THREE.MeshBasicMaterial({ map: led.texture, color: new THREE.Color(...LED_GLOW) });
        owned.push(mesh.material);
      } else if (name.startsWith('Screen')) {
        if (screen) {
          mesh.geometry = fullTextureUVs(mesh.geometry);
          mesh.material = new THREE.MeshBasicMaterial({ map: screen.texture, color: new THREE.Color(...SCREEN_GLOW) });
          owned.push(mesh.material);
        } else {
          mesh.visible = false;
        }
      } else {
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material.emissiveMap) material.emissiveIntensity = PAINTED_GLOW;
      }
    });
    return { root, owned };
  }, [gltf, led, screen, spec.kind]);

  useLayoutEffect(() => {
    const object = group.current;
    if (!object) return;
    const unregister = [registerLed(led), registerMachine(spec.id, object)];
    if (screen) unregister.push(registerScreen(screen));
    return () => unregister.forEach((off) => off());
  }, [led, screen, spec.id]);

  useEffect(
    () => () => {
      led.texture.dispose();
      screen?.texture.dispose();
      model.owned.forEach((m) => m.dispose());
    },
    [led, screen, model],
  );

  return (
    <group ref={group} position={[spec.x, 0, spec.z]} rotation-y={spec.rotationY} userData={{ machineId: spec.id }}>
      <primitive object={model.root} />
      {spec.kind === 'tape' && <TapeAnimator root={model.root} />}
      {/* Soft contact shadow, so the cabinet sits on the tiles. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={2} material={parts.materials.shadow}>
        <planeGeometry args={[CABINET.width + 0.8, CABINET.depth + 0.9]} />
      </mesh>
    </group>
  );
}

/** Seconds between rewinds, and how long a rewind lasts. */
const REWIND_EVERY = [45, 75] as const;
const REWIND_SECONDS = 3.2;
/** Reel speed in radians per second while writing, and while rewinding. */
const WRITE_SPEED = 7;
const REWIND_SPEED = -18;
/** How far each tape loop hangs into its column, in metres (the columns are 0.54 m tall). */
const LOOP_MIN = 0.12;
const LOOP_MAX = 0.48;

/**
 * Drives a tape cabinet: the reels move in short bursts, more often when edits are pouring in,
 * the vacuum-column loops take up the slack, and every minute or so the tape rewinds.
 */
function TapeAnimator({ root }: { root: THREE.Object3D }) {
  const parts = useMemo(
    () => ({
      left: root.getObjectByName('ReelLeft'),
      right: root.getObjectByName('ReelRight'),
      loopL: root.getObjectByName('LoopLeft'),
      loopR: root.getObjectByName('LoopRight'),
    }),
    [root],
  );
  const state = useRef({ speed: 0, burstLeft: 0, nextRewind: REWIND_EVERY[0] as number, rewindLeft: 0, slack: 0, t: 0 });

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const s = state.current;
    s.t += dt;
    const perSecond = feedStats.get().rate / 60;

    let target = 0;
    if (s.rewindLeft > 0) {
      s.rewindLeft -= dt;
      target = REWIND_SPEED;
    } else if (s.t > s.nextRewind) {
      s.rewindLeft = REWIND_SECONDS;
      s.nextRewind = s.t + REWIND_SECONDS + REWIND_EVERY[0] + Math.random() * (REWIND_EVERY[1] - REWIND_EVERY[0]);
    } else {
      // Busier feed, more frequent bursts (a couple a second at typical Wikipedia traffic).
      if (s.burstLeft <= 0 && Math.random() < dt * Math.min(4, 0.4 + perSecond * 0.2)) {
        s.burstLeft = 0.18 + Math.random() * 0.4;
      }
      if (s.burstLeft > 0) {
        s.burstLeft -= dt;
        target = WRITE_SPEED;
      }
    }
    // Real drives start and stop hard, but not instantly.
    s.speed += (target - s.speed) * (1 - Math.exp(-14 * dt));
    if (parts.left) parts.left.rotation.z -= s.speed * dt;
    // The take-up reel holds more tape, so it turns a little slower.
    if (parts.right) parts.right.rotation.z -= s.speed * 0.82 * dt;

    // Slack swings toward one column while the tape moves, then the servos even it out.
    s.slack += (s.speed / WRITE_SPEED) * dt * 1.6;
    s.slack *= Math.exp(-2.2 * dt);
    const mid = (LOOP_MIN + LOOP_MAX) / 2;
    const swing = (LOOP_MAX - LOOP_MIN) / 2;
    const wobble = Math.sin(s.t * 3.1) * 0.015;
    const k = Math.max(-1, Math.min(1, s.slack));
    if (parts.loopL) parts.loopL.scale.y = mid - k * swing + wobble;
    if (parts.loopR) parts.loopR.scale.y = mid + k * swing - wobble;
  });

  return null;
}
