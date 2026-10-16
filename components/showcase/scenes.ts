import { useTexture } from '@react-three/drei';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { sceneCatalog, type CloseTone, type SceneSlug } from '@/components/showcase/sceneCatalog';

export type ScenePreview = ComponentType<{ onReady?: () => void }>;

export type SceneConfig = {
  slug: SceneSlug;
  title: string;
  poster: string;
  closeTone: CloseTone;
  /** Where the tile links. Defaults to /scenes/<slug>. */
  href: string;
  Preview: ScenePreview;
};

const previews: Record<SceneSlug, ScenePreview> = {
  'black-water-koi': dynamic(() => import('@/components/showcase/previews/BlackWaterKoiPreview'), { ssr: false }),
  'ocean-waves': dynamic(() => import('@/components/showcase/previews/OceanWavesPreview'), { ssr: false }),
  starfield: dynamic(() => import('@/components/showcase/previews/StarfieldPreview'), { ssr: false }),
  'the-room': dynamic(() => import('@/components/showcase/previews/TheRoomPreview'), { ssr: false }),
  'open-field': dynamic(() => import('@/components/showcase/previews/OpenFieldPreview'), { ssr: false }),
  sapphires: dynamic(() => import('@/components/showcase/previews/SapphiresPreview'), { ssr: false }),
};

/** One entry per tile. The hover treatment uses the poster still, not the scene chunk. */
export const scenes: SceneConfig[] = sceneCatalog.map((scene) => ({
  slug: scene.slug,
  title: scene.title,
  poster: scene.poster,
  closeTone: scene.closeTone,
  href: 'href' in scene ? scene.href : `/scenes/${scene.slug}`,
  Preview: previews[scene.slug],
}));

/** Warm the six poster textures when the pointer enters the grid, or on idle. */
export function preloadPortalTextures() {
  for (const scene of scenes) useTexture.preload(scene.poster);
}
