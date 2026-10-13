'use client';

import { useEffect, useState } from 'react';
import { OpenFieldExperience } from '@/components/assists/open-field';

export function PlayGlassBead() {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const { body } = document;
    const previous = body.style.overscrollBehavior;
    body.style.overscrollBehavior = 'none';
    return () => {
      body.style.overscrollBehavior = previous;
    };
  }, []);

  useEffect(() => {
    if (started) return;
    const start = () => setStarted(true);
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, [started]);

  return (
    <div className="relative h-dvh w-full touch-none overflow-hidden overscroll-none">
      <OpenFieldExperience pauseWhenHidden />
      {started ? null : (
        <button
          type="button"
          className="absolute inset-0 z-30 flex items-center justify-center bg-transparent font-sans text-[13px] font-extralight uppercase leading-snug tracking-[0.16em] text-[#404040] sm:text-[14px] md:text-[15px]"
        >
          tap to start
        </button>
      )}
    </div>
  );
}
