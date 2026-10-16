'use client';

import { useTexture } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { PALETTE } from '@/components/assists/the-room/server/serverRoomConfig';

/** Artwork from scripts/models/gopher_sign.py. */
const FACE_URL = '/models/mainframe/gopher-sign.jpg';
/** Panel size in metres (the artwork is 1600 × 2000 px). */
const FACE = { width: 3.4, height: 4.25 };
/** Width of the amber frame around the panel. */
const FRAME = 0.1;
const DEPTH = 0.14;
/** Above 1 so the lit parts of the panel catch the bloom. */
const FACE_GLOW: [number, number, number] = [1.15, 1.15, 1.15];
/** How strongly the amber frame glows. 0 is plain painted metal. */
const FRAME_GLOW = 0.55;

type Props = { position: [number, number, number]; scale?: number };

/** Backlit Gopher sign on the back wall, in an amber frame so it stands off the dark rock. */
export function GopherSign(props: Props) {
  return (
    <Suspense fallback={null}>
      <SignPanel {...props} />
    </Suspense>
  );
}

function SignPanel({ position, scale = 1 }: Props) {
  const face = useTexture(FACE_URL);
  useMemo(() => {
    face.colorSpace = THREE.SRGBColorSpace;
    face.anisotropy = 8;
    face.needsUpdate = true;
  }, [face]);

  const { width: w, height: h } = FACE;
  const amber = new THREE.Color(PALETTE.amber);

  return (
    <group position={position} scale={scale}>
      {/* Amber frame: four bars around the panel. */}
      {[
        [0, h / 2 + FRAME / 2, w + FRAME * 2, FRAME],
        [0, -h / 2 - FRAME / 2, w + FRAME * 2, FRAME],
        [-w / 2 - FRAME / 2, 0, FRAME, h],
        [w / 2 + FRAME / 2, 0, FRAME, h],
      ].map(([x, y, bw, bh], i) => (
        <mesh key={i} position={[x, y, DEPTH / 2]}>
          <boxGeometry args={[bw, bh, DEPTH]} />
          <meshStandardMaterial color={amber} emissive={amber} emissiveIntensity={FRAME_GLOW} roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
      {/* Light box behind the face. */}
      <mesh position-z={DEPTH / 2 - 0.01}>
        <boxGeometry args={[w, h, DEPTH - 0.02]} />
        <meshStandardMaterial color="#141516" roughness={0.8} />
      </mesh>
      <mesh position-z={DEPTH - 0.012}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={face} color={FACE_GLOW} />
      </mesh>
      {/* Warm spill from the sign onto the floor and cabinets in front of it. */}
      <pointLight position={[0, -h / 2 + 0.4, 1.2]} intensity={8} distance={7} color="#ffb060" />
    </group>
  );
}
