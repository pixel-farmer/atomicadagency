'use client';

import { Clone, useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { Box3, Vector3 } from 'three';

const CHAIR_PATH = '/ModernChair.glb';
/** The model is authored in meters, so 1 keeps it life-size. */
export const CHAIR_SCALE = 3;
/** Seat surface height of the unscaled model, in meters. */
const MODEL_SEAT_HEIGHT = 0.45;
export const CHAIR_SEAT_HEIGHT = MODEL_SEAT_HEIGHT * CHAIR_SCALE;

useGLTF.preload(CHAIR_PATH);

/** Places the chair centered on (x, z), standing on the floor and facing +Z. */
export function TheRoomModernChair({ x, z }: { x: number; z: number }) {
  const { scene } = useGLTF(CHAIR_PATH);

  const position = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const center = new Vector3();
    box.getCenter(center);
    return [
      x - center.x * CHAIR_SCALE,
      -box.min.y * CHAIR_SCALE,
      z - center.z * CHAIR_SCALE,
    ] as [number, number, number];
  }, [scene, x, z]);

  return (
    <group position={position} scale={CHAIR_SCALE}>
      <Clone object={scene} deep castShadow receiveShadow />
    </group>
  );
}
