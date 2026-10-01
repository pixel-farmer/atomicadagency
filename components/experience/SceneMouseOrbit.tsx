'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';

export type SceneMouseOrbitProps = {
  /** Orbit target (world). */
  center?: [number, number, number];
  /** Horizontal distance from center at rest (pitch = 0). */
  radius: number;
  /** Camera height at rest (pitch = 0). */
  eyeHeight: number;
  /** Rest yaw when mouse is centered (radians). */
  baseYaw?: number;
  /** Extra vertical motion from pitch input. */
  pitchLift?: number;
  maxYaw?: number;
  maxPitch?: number;
  smoothing?: number;
};

export function SceneMouseOrbit({
  center = [0, 0.75, 0],
  radius,
  eyeHeight,
  baseYaw = 0,
  pitchLift = 2.2,
  maxYaw = 0.28,
  maxPitch = 0.14,
  smoothing = 0.045,
}: SceneMouseOrbitProps) {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0 });
  const smooth = useRef({ x: 0, y: 0 });
  const orbitCenter = useMemo(
    () => new Vector3(center[0], center[1], center[2]),
    [center[0], center[1], center[2]],
  );
  const lookAt = useMemo(() => new Vector3(), []);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      target.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      target.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame(() => {
    smooth.current.x += (target.current.x - smooth.current.x) * smoothing;
    smooth.current.y += (target.current.y - smooth.current.y) * smoothing;

    const yaw = baseYaw + smooth.current.x * maxYaw;
    const pitch = smooth.current.y * maxPitch;
    const horizontal = radius * Math.cos(pitch);

    camera.position.set(
      orbitCenter.x + Math.sin(yaw) * horizontal,
      eyeHeight + Math.sin(pitch) * pitchLift,
      orbitCenter.z + Math.cos(yaw) * horizontal,
    );

    lookAt.copy(orbitCenter);
    camera.lookAt(lookAt);
  });

  return null;
}
