'use client';

import { MeshReflectorMaterial } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PALETTE, SERVER_ROOM } from '@/components/assists/the-room/server/serverRoomConfig';
import { display } from '@/components/assists/the-room/server/serverDisplays';
import {
  createPosterTexture,
  createRockTexture,
  createTileTexture,
} from '@/components/assists/the-room/server/serverTextures';

const { width: RW, depth: RD, height: RH } = SERVER_ROOM;
/** Meters of floor per texture repeat (4 × 4 tiles), so one tile is 0.6 m. */
const FLOOR_REPEAT_METERS = 2.4;
/** How strongly the floor mirrors the machines. 0 is matte. */
const FLOOR_REFLECTION = 1.1;
/** Fill light. The fluorescent fixtures and screens do the rest. */
const AMBIENT_LIGHT = 1.0;
const KEY_LIGHT = 1.4;
const FIXTURE_GLOW = 2.4;
/** Ceiling light rows, as [x, z] centers. */
const FIXTURES: [number, number][] = [-4.5, 0, 4.5].flatMap((x) => [-7, -2.5, 2, 6.5].map((z) => [x, z] as [number, number]));
/** This fixture's tube is on its way out. */
const FLICKERING_FIXTURE = 5;
const COLUMN_XS = [-6, 0, 6];

const alertRed = new THREE.Color(PALETTE.alert);
const fixtureWhite = new THREE.Color('#ffffff');

export function ServerRoomShell() {
  const floorMap = useMemo(() => createTileTexture(FLOOR_REPEAT_METERS, RW, RD), []);
  const rock = useMemo(() => createRockTexture(), []);
  const poster = useMemo(() => createPosterTexture(), []);
  const fixtures = useMemo(
    () => ({
      steady: new THREE.MeshStandardMaterial({ color: '#202124', emissive: fixtureWhite, emissiveIntensity: FIXTURE_GLOW }),
      flicker: new THREE.MeshStandardMaterial({ color: '#202124', emissive: fixtureWhite, emissiveIntensity: FIXTURE_GLOW }),
    }),
    [],
  );
  useEffect(
    () => () => {
      [floorMap, rock, poster].forEach((t) => t.dispose());
      fixtures.steady.dispose();
      fixtures.flicker.dispose();
    },
    [floorMap, rock, poster, fixtures],
  );

  const alarm = useRef<THREE.PointLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const flick = useRef({ off: 0 });

  useFrame((state, rawDelta) => {
    const t = state.clock.elapsedTime;
    const delta = Math.min(rawDelta, 0.05);
    const alerting = display.alertUntil > 0;
    const pulse = alerting ? 0.5 + 0.5 * Math.sin(t * 12) : 0;

    if (alarm.current) alarm.current.intensity = pulse * 60;
    if (hemi.current) hemi.current.intensity = alerting ? AMBIENT_LIGHT * 0.45 : AMBIENT_LIGHT;
    for (const material of [fixtures.steady, fixtures.flicker]) {
      material.emissive.copy(alerting ? alertRed : fixtureWhite);
      material.emissiveIntensity = alerting ? FIXTURE_GLOW * (0.3 + pulse) : FIXTURE_GLOW;
    }

    // Dying tube: mostly on, with short stutters every few seconds.
    const f = flick.current;
    f.off = Math.max(0, f.off - delta);
    if (f.off === 0 && Math.random() < delta * 0.35) f.off = 0.08 + Math.random() * 0.4;
    if (!alerting && f.off > 0) fixtures.flicker.emissiveIntensity = Math.random() < 0.5 ? 0.15 : FIXTURE_GLOW * 0.7;
  });

  return (
    <>
      <color attach="background" args={[PALETTE.background]} />
      <fog attach="fog" args={[PALETTE.background, 20, 36]} />
      <hemisphereLight ref={hemi} args={['#f2f2ee', '#3a3b3e', AMBIENT_LIGHT]} />
      <directionalLight position={[6, 12, 8]} intensity={KEY_LIGHT} />
      <pointLight position={[-6, 5, 4]} intensity={18} distance={22} color="#dfe3ea" />
      <pointLight ref={alarm} position={[0, 5, -2]} intensity={0} distance={30} color={PALETTE.alert} />

      {/* Glossy tile floor. */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[RW, RD]} />
        <MeshReflectorMaterial
          map={floorMap}
          resolution={1024}
          blur={[400, 120]}
          mixBlur={0.8}
          mixStrength={FLOOR_REFLECTION}
          mixContrast={1}
          mirror={0.6}
          depthScale={0}
          roughness={0.35}
          metalness={0.05}
          color="#ffffff"
        />
      </mesh>

      {/* Walls: dark rock behind the poster, dark left, pale right and entrance. */}
      <mesh position={[0, RH / 2, -RD / 2]}>
        <planeGeometry args={[RW, RH]} />
        <meshStandardMaterial map={rock} roughness={0.95} />
      </mesh>
      <mesh position={[-RW / 2, RH / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[RD, RH]} />
        <meshStandardMaterial color={PALETTE.wallDark} roughness={0.9} />
      </mesh>
      <mesh position={[RW / 2, RH / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[RD, RH]} />
        <meshStandardMaterial color={PALETTE.wallLight} roughness={0.85} />
      </mesh>
      <mesh position={[0, RH / 2, RD / 2]} rotation-y={Math.PI}>
        <planeGeometry args={[RW, RH]} />
        <meshStandardMaterial color={PALETTE.wallLight} roughness={0.85} />
      </mesh>
      <mesh position={[0, RH, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[RW, RD]} />
        <meshStandardMaterial color={PALETTE.ceiling} roughness={0.9} />
      </mesh>

      {/* Columns and header beam along the back wall. */}
      {COLUMN_XS.map((x) => (
        <mesh key={x} position={[x, RH / 2, -RD / 2 + 0.4]}>
          <boxGeometry args={[0.8, RH, 0.8]} />
          <meshStandardMaterial color={PALETTE.column} roughness={0.6} metalness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, RH - 0.35, -RD / 2 + 0.4]}>
        <boxGeometry args={[RW, 0.7, 0.8]} />
        <meshStandardMaterial color={PALETTE.column} roughness={0.6} metalness={0.2} />
      </mesh>

      <mesh position={[-3, 3.1, -RD / 2 + 0.05]}>
        <planeGeometry args={[3.4, 4.25]} />
        <meshBasicMaterial map={poster} />
      </mesh>

      {/* Fluorescent fixtures. Emissive, so they bloom. */}
      {FIXTURES.map(([x, z], i) => (
        <mesh
          key={`${x},${z}`}
          position={[x, RH - 0.05, z]}
          material={i === FLICKERING_FIXTURE ? fixtures.flicker : fixtures.steady}
        >
          <boxGeometry args={[2.4, 0.06, 0.3]} />
        </mesh>
      ))}
    </>
  );
}
