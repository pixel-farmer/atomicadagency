'use client';

import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';

export type InnerCanvasProps = {
  children?: ReactNode;
  className?: string;
  cameraPosition?: [number, number, number];
  cameraFov?: number;
  dpr?: number | [number, number];
  shadows?: boolean;
};

export function InnerCanvas({
  children,
  className = 'h-full w-full',
  cameraPosition = [0, 0, 5],
  cameraFov = 45,
  dpr = [1, 2],
  shadows = false,
}: InnerCanvasProps) {
  return (
    <Canvas
      className={className}
      shadows={shadows}
      dpr={dpr}
      camera={{ position: cameraPosition, fov: cameraFov }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      {children}
    </Canvas>
  );
}
