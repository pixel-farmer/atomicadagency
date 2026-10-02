'use client';

import { AsciiWaveCanvas } from '@/components/marketing/AsciiWaveCanvas';

/** Fixed swirl + #bd5b5b behind the full scrollable home page. */
export function VaxionHomeBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 bg-[#bd5b5b]"
      aria-hidden
    >
      <AsciiWaveCanvas />
    </div>
  );
}
