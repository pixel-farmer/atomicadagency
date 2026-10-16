'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import {
  ANCHORS,
  CABINET,
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

const FRONT = CABINET.depth / 2;
/** Above 1 so screens and LEDs bloom through the grade. */
const SCREEN_GLOW: [number, number, number] = [1.45, 1.45, 1.45];
const LED_GLOW: [number, number, number] = [1.7, 1.7, 1.7];

/**
 * One server cabinet. The body is a plain box for now; swap the `CabinetBody` mesh for the
 * modeled cabinet and keep the screen, LED strip, vent and tag at the ANCHORS positions.
 */
export function ServerCabinet({ spec }: { spec: MachineSpec }) {
  const parts = getSharedParts();
  const group = useRef<THREE.Group>(null);
  const led = useMemo(() => createLedPanel({ x: spec.x, z: spec.z }), [spec.x, spec.z]);
  const screen = useMemo(() => (spec.kind === 'screen' ? createScreen(spec.program ?? 0) : null), [spec.kind, spec.program]);

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
    },
    [led, screen],
  );

  const { screen: s, vent, led: l, tag } = ANCHORS;

  return (
    <group ref={group} position={[spec.x, 0, spec.z]} rotation-y={spec.rotationY} userData={{ machineId: spec.id }}>
      {/* CabinetBody: replace with the modeled cabinet. */}
      <mesh position-y={CABINET.height / 2} material={parts.materials.body}>
        <boxGeometry args={[CABINET.width, CABINET.height, CABINET.depth]} />
      </mesh>

      <mesh position={[0, vent.y, FRONT + 0.002]} material={parts.materials.vent}>
        <planeGeometry args={[vent.width, vent.height]} />
      </mesh>

      <mesh position={[0, l.y, FRONT + 0.002]}>
        <planeGeometry args={[l.width, l.height]} />
        <meshBasicMaterial map={led.texture} color={LED_GLOW} />
      </mesh>

      <mesh position={[tag.x, tag.y, tag.z]} rotation-x={-0.35} material={parts.materials.tag}>
        <boxGeometry args={[0.38, 0.13, 0.05]} />
      </mesh>
      <mesh position={[-0.2, CABINET.height + 0.09, -0.15]} material={parts.materials.speaker}>
        <boxGeometry args={[0.5, 0.18, 0.4]} />
      </mesh>

      {screen && (
        <>
          <mesh position={[0, s.y, FRONT + 0.012]} material={parts.materials.frame}>
            <boxGeometry args={[s.width + 0.08, s.height + 0.1, 0.025]} />
          </mesh>
          <mesh position={[0, s.y, FRONT + 0.026]}>
            <planeGeometry args={[s.width, s.height]} />
            <meshBasicMaterial map={screen.texture} color={SCREEN_GLOW} />
          </mesh>
        </>
      )}

      {spec.kind === 'tape' && <TapeReels />}

      {/* Soft contact shadow, so the low-poly box sits on the tiles. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={2} material={parts.materials.shadow}>
        <planeGeometry args={[CABINET.width + 0.8, CABINET.depth + 0.9]} />
      </mesh>
    </group>
  );
}

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
        <boxGeometry args={[screen.width + 0.06, screen.height + 0.08, 0.025]} />
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
