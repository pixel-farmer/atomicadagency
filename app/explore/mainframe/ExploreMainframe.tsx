'use client';

import { useEffect, useState } from 'react';
import { TheRoomExperience } from '@/components/assists/the-room/TheRoomExperience';

/** Full-screen Mainframe at /explore/mainframe, for sharing a direct link. */
export function ExploreMainframe() {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const { body } = document;
    const previous = body.style.overscrollBehavior;
    body.style.overscrollBehavior = 'none';
    return () => {
      body.style.overscrollBehavior = previous;
    };
  }, []);

  // The first tap or key press also unlocks the room's sound.
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
      <TheRoomExperience />
      {started ? null : (
        <button
          type="button"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 font-sans text-[13px] font-extralight uppercase leading-snug tracking-[0.16em] text-white sm:text-[14px] md:text-[15px]"
        >
          tap to enter
        </button>
      )}
    </div>
  );
}
