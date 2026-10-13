'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

type SceneCloseButtonProps = {
  /** Dark type for a light scene. Light type for a dark scene. */
  tone: 'on-light' | 'on-dark';
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
    tone === 'on-light'
      ? 'border border-[#525252] text-[#404040] hover:bg-black/[0.06] focus-visible:ring-[#525252]'
      : 'border border-white/90 text-white hover:bg-white/5 focus-visible:ring-white';

  return (
    <Link
      href="/"
      className={`absolute right-[clamp(1rem,4vw,2.5rem)] top-[clamp(1.25rem,4vh,2.5rem)] z-20 bg-transparent px-10 py-2.5 font-sans text-xs font-extralight uppercase tracking-[0.35em] transition focus:outline-none focus-visible:ring-1 ${toneClass}`}
    >
      close
    </Link>
  );
}
