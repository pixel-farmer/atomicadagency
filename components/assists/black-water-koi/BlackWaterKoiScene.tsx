'use client';

import { useThree } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useRef } from 'react';
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

function ReadySignal({ onReady }: { onReady: () => void }) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => onReadyRef.current());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  return null;
}

type BlackWaterKoiSceneProps = {
  cursorRipples?: boolean;
  onReady?: () => void;
};

export function BlackWaterKoiScene({
  cursorRipples = true,
  onReady,
}: BlackWaterKoiSceneProps = {}) {
  return (
    <>
      <SceneCamera />
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 16, 30]} />
      <ambientLight intensity={0.08} />
      <directionalLight position={[-4, 9, 3]} intensity={0.55} color="#b2d9f5" />
      <directionalLight position={[3, 6, -2]} intensity={0.12} color="#405060" />
      <BlackWaterSurface cursorRipples={cursorRipples} />
      <Suspense fallback={null}>
        <BlackWaterKoiFish />
        {onReady ? <ReadySignal onReady={onReady} /> : null}
      </Suspense>
    </>
  );
}
