'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { SceneSlug } from '@/components/showcase/sceneCatalog';

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
  const Experience = experiences[slug as SceneSlug];
  if (!Experience) return null;
  return (
    <div className="h-dvh w-full">
      <Experience />
    </div>
  );
}
