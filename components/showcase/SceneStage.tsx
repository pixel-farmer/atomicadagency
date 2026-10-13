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
  return (
    <div className="relative h-dvh w-full">
      <Experience />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-end px-[clamp(1rem,4vw,2.5rem)] pt-[clamp(1.25rem,4vh,2.5rem)]">
        <SceneCloseButton tone={scene.closeTone} />
      </div>
    </div>
  );
}
