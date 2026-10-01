'use client';

import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Spherical, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

const ORBIT_TARGET = new Vector3(0, 1.2, 0);
const YAW_LIMIT = Math.PI / 2;
const TOP_DOWN_EXTRA = Math.PI / 4;
const MIN_POLAR = 0.12;
const MAX_POLAR = Math.PI / 2 - 0.06;

function computeLimits(cameraPosition: Vector3) {
  const offset = cameraPosition.clone().sub(ORBIT_TARGET);
  const spherical = new Spherical().setFromVector3(offset);

  return {
    minAzimuth: spherical.theta - YAW_LIMIT,
    maxAzimuth: spherical.theta + YAW_LIMIT,
    minPolar: Math.max(MIN_POLAR, spherical.phi - TOP_DOWN_EXTRA),
    maxPolar: Math.min(MAX_POLAR, spherical.phi + 0.04),
  };
}

export function ArcadeOrbitControls() {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const limitsRef = useRef<ReturnType<typeof computeLimits> | null>(null);

  if (limitsRef.current === null) {
    limitsRef.current = computeLimits(camera.position);
  }

  const limits = limitsRef.current;

  return (
    <OrbitControls
      ref={controlsRef}
      target={ORBIT_TARGET}
      enablePan={false}
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.65}
      minAzimuthAngle={limits.minAzimuth}
      maxAzimuthAngle={limits.maxAzimuth}
      minPolarAngle={limits.minPolar}
      maxPolarAngle={limits.maxPolar}
    />
  );
}
