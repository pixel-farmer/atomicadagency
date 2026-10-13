'use client';

import { Canvas } from '@react-three/fiber';
import { useEffect, useState, type ReactNode } from 'react';

export type InnerCanvasProps = {
  children?: ReactNode;
  className?: string;
  cameraPosition?: [number, number, number];
  cameraFov?: number;
  dpr?: number | [number, number];
  shadows?: boolean;
  /** When false (default), canvas clears opaque black — required for full-screen assists. */
  transparent?: boolean;
  /** Stop the render loop while the document is hidden. Defaults off so other scenes stay unchanged. */
  pauseWhenHidden?: boolean;
};

function SceneCanvas({
  children,
  className = 'h-full w-full',
  cameraPosition = [0, 0, 5],
  cameraFov = 45,
  dpr = [1, 2],
  shadows = false,
  transparent = true,
  frameloop = 'always',
}: Omit<InnerCanvasProps, 'pauseWhenHidden'> & { frameloop?: 'always' | 'never' }) {
  return (
    <Canvas
      className={className}
      frameloop={frameloop}
      shadows={shadows}
      dpr={dpr}
      camera={{ position: cameraPosition, fov: cameraFov }}
      gl={{ antialias: true, alpha: transparent }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, transparent ? 0 : 1);
      }}
    >
      {children}
    </Canvas>
  );
}

function PausingCanvas(props: Omit<InnerCanvasProps, 'pauseWhenHidden'>) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return <SceneCanvas {...props} frameloop={hidden ? 'never' : 'always'} />;
}

export function InnerCanvas({ pauseWhenHidden = false, ...props }: InnerCanvasProps) {
  if (pauseWhenHidden) return <PausingCanvas {...props} />;
  return <SceneCanvas {...props} />;
}
