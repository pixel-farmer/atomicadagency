'use client';

/** Shown while the WebGL canvas chunk loads (Next.js dynamic import). */
export function CanvasFallback() {
  return (
    <div
      className="flex h-full min-h-[200px] w-full items-center justify-center bg-[#5c5668]"
      aria-hidden
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70"
        role="presentation"
      />
      <span className="sr-only">Loading scene</span>
    </div>
  );
}
