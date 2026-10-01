'use client';

import Image from 'next/image';
import { AsciiWaveCanvas } from '@/components/marketing/AsciiWaveCanvas';

export function VaxionHomeHero() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <AsciiWaveCanvas />
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-[clamp(1rem,4vw,2.5rem)]">
        <Image
          src="/VaxionStudiosLogo-wh.svg"
          alt="Vaxion Studios"
          width={1983}
          height={793}
          priority
          className="h-auto w-[min(88vw,42rem)] max-w-full drop-shadow-[0_0_48px_rgba(0,0,0,0.85)]"
        />
      </div>
    </div>
  );
}
