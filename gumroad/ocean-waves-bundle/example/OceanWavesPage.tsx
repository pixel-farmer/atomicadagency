'use client';

import dynamic from 'next/dynamic';

const RollingShoreExperience = dynamic(
  () =>
    import('@/components/assists/rolling-shore').then((m) => m.RollingShoreExperience),
  { ssr: false },
);

/**
 * Example full-viewport page. Copy into app/ (App Router) or pages/ (Pages Router).
 * No demo "close" button — add your own nav / CTAs in a layer above the scene.
 */
export default function OceanWavesPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#5c5668]">
      <RollingShoreExperience />
    </main>
  );
}
