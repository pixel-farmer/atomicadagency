'use client';

import { useThree } from '@react-three/fiber';
import { Suspense, useLayoutEffect } from 'react';
import { BlackWaterKoiFish } from '@/components/assists/black-water-koi/BlackWaterKoiFish';
import { BlackWaterSurface } from '@/components/assists/black-water-koi/BlackWaterSurface';

/** ~25° from vertical — almost top-down, tilted toward +Z */
const CAMERA_HEIGHT = 11;
const CAMERA_TILT_Z = 5.2;

function SceneCamera() {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.set(0, CAMERA_HEIGHT, CAMERA_TILT_Z);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

export function BlackWaterKoiScene() {
  return (
    <>
      <SceneCamera />
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 16, 30]} />
      <ambientLight intensity={0.08} />
      <directionalLight position={[-4, 9, 3]} intensity={0.55} color="#b2d9f5" />
      <directionalLight position={[3, 6, -2]} intensity={0.12} color="#405060" />
      <BlackWaterSurface />
      <Suspense fallback={null}>
        <BlackWaterKoiFish />
      </Suspense>
    </>
  );
}
