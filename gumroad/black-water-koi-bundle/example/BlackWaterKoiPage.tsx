'use client';

import dynamic from 'next/dynamic';

const BlackWaterKoiExperience = dynamic(
  () =>
    import('@/components/assists/black-water-koi').then((m) => m.BlackWaterKoiExperience),
  { ssr: false },
);

/**
 * Example full-viewport page. Copy into app/ (App Router) or pages/ (Pages Router).
 * Add your headline in an absolute layer above the experience.
 */
export default function BlackWaterKoiPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black">
      <BlackWaterKoiExperience />
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-sans text-3xl font-light tracking-wide text-white/90">
          Your headline
        </h1>
        <p className="mt-3 max-w-md font-sans text-sm text-white/60">
          Your supporting copy — pointer-events-none on this layer keeps the canvas passive.
        </p>
      </div>
    </main>
  );
}
