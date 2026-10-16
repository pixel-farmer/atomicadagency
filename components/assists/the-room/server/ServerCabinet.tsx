'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  ANCHORS,
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

/** One server cabinet: a terminal (live screen), a rack (glass door) or the tape drive. */
export function ServerCabinet({ spec }: { spec: MachineSpec }) {
  return (
    <Suspense fallback={null}>
      <CabinetModel spec={spec} />
    </Suspense>
  );
}

function CabinetModel({ spec }: { spec: MachineSpec }) {
  const parts = getSharedParts();
  const gltf = useGLTF(spec.kind === 'rack' ? CABINET_MODELS.rack : CABINET_MODELS.terminal);
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
      // The tape drive has reels where the terminal's screen would be.
      if (spec.kind === 'tape' && name.startsWith('Bezel')) mesh.visible = false;
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
      {spec.kind === 'tape' && <TapeReels />}
      {/* Soft contact shadow, so the cabinet sits on the tiles. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={2} material={parts.materials.shadow}>
        <planeGeometry args={[CABINET.width + 0.8, CABINET.depth + 0.9]} />
      </mesh>
    </group>
  );
}

const FRONT = CABINET.depth / 2;

/** Tape drive window: left reel follows human edits, right reel follows bot edits. */
function TapeReels() {
  const parts = getSharedParts();
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const { reels, screen } = ANCHORS;

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const { rate, botShare } = feedStats.get();
    const perSecond = rate / 60;
    if (left.current) left.current.rotation.y -= delta * (0.4 + perSecond * (1 - botShare) * 0.35);
    if (right.current) right.current.rotation.y -= delta * (0.4 + perSecond * botShare * 0.35);
  });

  return (
    <>
      <mesh position={[0, screen.y, FRONT + 0.012]} material={parts.materials.glass}>
        <boxGeometry args={[screen.width + 0.12, screen.height + 0.14, 0.025]} />
      </mesh>
      {[-reels.spread, reels.spread].map((x, i) => (
        <mesh
          key={x}
          ref={i === 0 ? left : right}
          position={[x, reels.y, FRONT + 0.05]}
          rotation-x={Math.PI / 2}
          material={parts.materials.reel}
        >
          <cylinderGeometry args={[reels.radius, reels.radius, 0.04, 32]} />
        </mesh>
      ))}
    </>
  );
}
