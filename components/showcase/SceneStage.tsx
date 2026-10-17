'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { sceneCatalog, type SceneSlug } from '@/components/showcase/sceneCatalog';
import { SceneCloseButton } from '@/components/showcase/SceneCloseButton';

const experiences: Record<SceneSlug, ComponentType> = {
  'black-water-koi': dynamic(
    () => import('@/components/assists/black-water-koi').then((mod) => mod.BlackWaterKoiExperience),
    { ssr: false },
  ),
  'ocean-waves': dynamic(
    () => import('@/components/assists/rolling-shore').then((mod) => mod.RollingShoreExperience),
    { ssr: false },
  ),
  starfield: dynamic(
    () => import('@/components/assists/starfield').then((mod) => mod.StarfieldExperience),
    { ssr: false },
  ),
  'the-room': dynamic(
    () => import('@/components/assists/the-room').then((mod) => mod.TheRoomExperience),
    { ssr: false },
  ),
  'open-field': dynamic(
    () => import('@/components/assists/open-field').then((mod) => mod.OpenFieldExperience),
    { ssr: false },
  ),
  sapphires: dynamic(
    () => import('@/components/assists/sapphires').then((mod) => mod.SapphiresExperience),
    { ssr: false },
  ),
};

export function SceneStage({ slug }: { slug: string }) {
  const scene = sceneCatalog.find((entry) => entry.slug === slug);
  const Experience = experiences[slug as SceneSlug];
  if (!scene || !Experience) return null;
  const product = 'product' in scene ? scene.product : null;
  const dark = scene.closeTone === 'dark';
  return (
    <div className="relative h-dvh w-full">
      <Experience />
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex gap-4 px-[clamp(1rem,4vw,2.5rem)] pt-[clamp(1.25rem,4vh,2.5rem)] sm:gap-6 ${
          product ? 'flex-col sm:flex-row sm:items-start sm:justify-between' : 'justify-end'
        }`}
      >
        {product ? (
          <p
            className={`pointer-events-auto max-w-lg font-sans text-[11px] font-light leading-relaxed sm:text-xs md:max-w-xl md:text-sm ${
              dark ? 'text-[#404040]/90' : 'text-white/75'
            }`}
          >
            {product.blurb}
            <br />
            <a
              href={product.buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`font-sans font-normal underline underline-offset-[3px] transition ${
                dark
                  ? 'text-[#2a2a2a] decoration-[#525252]/45 hover:decoration-[#525252]/85'
                  : 'text-white decoration-white/35 hover:decoration-white/80'
              }`}
            >
              {product.buyLabel}
            </a>
          </p>
        ) : null}
        <SceneCloseButton tone={scene.closeTone} />
      </div>
    </div>
  );
}
