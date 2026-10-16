'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { PortalVortex } from '@/components/home/PortalVortex';
import { usePreview } from '@/components/showcase/previewState';
import { preloadPortalTextures, scenes, type SceneConfig } from '@/components/showcase/scenes';

function SceneTile({ scene }: { scene: SceneConfig }) {
  const { enabled, activeSlug, activate, release, setTrack, trackRef } = usePreview();
  const clipRef = useRef<HTMLSpanElement>(null);
  const active = enabled && activeSlug === scene.slug;
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [targetOn, setTargetOn] = useState(false);
  const [origin, setOrigin] = useState<[number, number]>([0.5, 0.5]);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => release(scene.slug);
  }, [release, scene.slug]);

  const settle = useCallback(() => {
    setShown(false);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      setMounted(false);
      setTargetOn(false);
      if (trackRef.current === clipRef.current) setTrack(null);
      release(scene.slug);
    }, 200);
  }, [release, scene.slug, setTrack, trackRef]);

  const preview = (nextOrigin: [number, number]) => {
    if (!enabled) return;
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setOrigin(nextOrigin);
    activate(scene.slug);
    setTargetOn(true);
    setMounted(true);
    setTrack(clipRef.current);
    requestAnimationFrame(() => setShown(true));
  };

  const enterFromPointer = () => {
    preview([0.5, 0.5]);
  };

  const rest = () => {
    if (!enabled) return;
    setTargetOn(false);
  };

  return (
    <Link
      href={scene.href}
      prefetch={false}
      aria-label={`Preview ${scene.title}`}
      onPointerEnter={enterFromPointer}
      onPointerLeave={rest}
      onFocus={() => preview([0.5, 0.5])}
      onBlur={rest}
      className="group relative z-[3] block aspect-square w-full max-w-[260px] cursor-pointer justify-self-center transition duration-300 hover:scale-[1.03] hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#bd5b5b]"
    >
      <span
        ref={clipRef}
        className="absolute inset-0 overflow-hidden rounded-full bg-black shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,255,255,0.08)] transition duration-300 group-hover:shadow-[0_18px_48px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(255,255,255,0.14)]"
      >
        <Image
          src={scene.poster}
          alt=""
          fill
          sizes="260px"
          className="object-cover"
        />
        {mounted ? (
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-full transition-opacity duration-200"
            style={{ opacity: shown ? 1 : 0 }}
          >
            <Canvas
              className="h-full w-full"
              frameloop="demand"
              dpr={[1, 1.5]}
              gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
              onCreated={({ gl }) => {
                gl.setClearColor(0x000000, 0);
              }}
            >
              <Suspense fallback={null}>
                <PortalVortex
                  src={scene.poster}
                  active={targetOn && active}
                  origin={origin}
                  onRest={settle}
                />
              </Suspense>
            </Canvas>
          </div>
        ) : null}
      </span>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-[10%] text-center font-sans text-[13px] font-extralight uppercase leading-snug tracking-[0.16em] text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.85)] sm:text-[14px] md:text-[15px]">
        {scene.title}
      </span>
    </Link>
  );
}

export function AssistShowcaseRow() {
  const { enabled } = usePreview();

  useEffect(() => {
    if (!enabled) return;
    const run = () => preloadPortalTextures();
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run);
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 1);
    return () => window.clearTimeout(id);
  }, [enabled]);

  return (
    <section
      className="relative z-[2] -mt-5 flex min-h-dvh w-full items-center justify-center px-[clamp(1rem,4vw,2.5rem)] py-16"
      aria-label="Web assists"
    >
      <div
        className="pointer-events-auto relative z-[2] grid w-full max-w-5xl grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8 md:gap-12"
        onPointerEnter={() => {
          if (enabled) preloadPortalTextures();
        }}
      >
        {scenes.map((scene) => (
          <SceneTile key={scene.slug} scene={scene} />
        ))}
      </div>
    </section>
  );
}
