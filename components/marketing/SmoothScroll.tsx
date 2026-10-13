'use client';

import { ReactLenis } from 'lenis/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

type SmoothScrollProps = {
  children: ReactNode;
};

export function SmoothScroll({ children }: SmoothScrollProps) {
  const pathname = usePathname();
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  if (reduceMotion || pathname.startsWith('/play')) {
    return children;
  }

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.085,
        smoothWheel: true,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.1,
        infinite: false,
      }}
    >
      {children}
    </ReactLenis>
  );
}
