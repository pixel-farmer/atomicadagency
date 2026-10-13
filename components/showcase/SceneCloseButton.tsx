'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { CloseTone } from '@/components/showcase/sceneCatalog';

type SceneCloseButtonProps = {
  /** `light` is white type for a dark scene. `dark` is dark type for a light scene. */
  tone: CloseTone;
};

export function SceneCloseButton({ tone }: SceneCloseButtonProps) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') router.push('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const toneClass =
    tone === 'dark'
      ? 'border border-[#525252] text-[#404040] hover:bg-black/[0.06] focus-visible:ring-[#525252]'
      : 'border border-white/90 text-white hover:bg-white/5 focus-visible:ring-white';

  return (
    <Link
      href="/"
      className={`pointer-events-auto inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center self-end bg-transparent px-10 py-2.5 font-sans text-xs font-extralight uppercase tracking-[0.35em] transition focus:outline-none focus-visible:ring-1 sm:self-auto ${toneClass}`}
    >
      close
    </Link>
  );
}
