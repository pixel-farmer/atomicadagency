'use client';

import { View } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { PreviewProvider, usePreview } from '@/components/showcase/previewState';

function WakeFrame() {
  const { activeSlug } = usePreview();
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    invalidate();
  }, [activeSlug, invalidate]);

  return null;
}

function CircleMask() {
  const { trackRef, activeSlug } = usePreview();
  const gl = useThree((state) => state.gl);

  useFrame(() => {
    const sized = gl.domElement.parentElement;
    const host = sized?.parentElement ?? sized;
    if (!host) return;
    const target = activeSlug ? trackRef.current : null;
    if (!target) {
      host.style.opacity = '0';
      return;
    }
    const rect = target.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) / 2;
    const mask = `radial-gradient(circle ${radius}px at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px, #000 98%, transparent 100%)`;
    host.style.opacity = '1';
    host.style.maskImage = mask;
    host.style.setProperty('-webkit-mask-image', mask);
  });

  return null;
}

function ScenePreviewCanvas({ eventSource }: { eventSource: RefObject<HTMLDivElement | null> }) {
  return (
    <Canvas
      eventSource={eventSource as RefObject<HTMLElement>}
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: true }}
      className="pointer-events-none"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 1,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <View.Port />
      <WakeFrame />
      <CircleMask />
    </Canvas>
  );
}

function usePreviewEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setEnabled(hover.matches && !reduced.matches);
    sync();
    hover.addEventListener('change', sync);
    reduced.addEventListener('change', sync);
    return () => {
      hover.removeEventListener('change', sync);
      reduced.removeEventListener('change', sync);
    };
  }, []);

  return enabled;
}

/** One canvas for every tile. It stays mounted across route changes. */
export function ScenePreviewRoot({ children }: { children: ReactNode }) {
  const source = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const enabled = usePreviewEnabled() && !pathname.startsWith('/play');

  return (
    <PreviewProvider enabled={enabled}>
      <div ref={source}>{children}</div>
      {enabled ? <ScenePreviewCanvas eventSource={source} /> : null}
    </PreviewProvider>
  );
}
