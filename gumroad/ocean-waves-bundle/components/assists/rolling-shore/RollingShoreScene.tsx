'use client';

import { useThree } from '@react-three/fiber';
import { Suspense, useLayoutEffect } from 'react';
import { RollingShoreSky } from '@/components/assists/rolling-shore/RollingShoreSky';
import { RollingShoreSurface } from '@/components/assists/rolling-shore/RollingShoreSurface';

/** Low horizon, reference-style framing. */
const CAMERA_POS: [number, number, number] = [0, 0.42, -4.8];
const LOOK_AT: [number, number, number] = [0, 0.38, 16];

function SceneCamera() {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.set(...CAMERA_POS);
    camera.lookAt(...LOOK_AT);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

export function RollingShoreScene() {
  return (
    <>
      <SceneCamera />
      <color attach="background" args={['#5c5668']} />
      <fog attach="fog" args={['#4a4554', 8, 42]} />
      <ambientLight intensity={1.42} />
      <directionalLight position={[-6, 10, -4]} intensity={1.78} color="#c8ccd8" />
      <RollingShoreSky />
      <Suspense fallback={null}>
        <RollingShoreSurface />
      </Suspense>
    </>
  );
}
