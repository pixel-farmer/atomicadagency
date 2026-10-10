'use client';

import { useEffect, useState } from 'react';
import { CanvasWrapper } from '@/components/canvas';
import { OpenFieldScene } from '@/components/assists/open-field/OpenFieldScene';
import { TheRoomJoystick } from '@/components/assists/the-room/TheRoomJoystick';
import { TheRoomSound } from '@/components/assists/the-room/TheRoomSound';

export function OpenFieldExperience() {
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const sync = () => setTouch(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return (
    <div className="relative h-full w-full bg-[#cfdde3]">
      <CanvasWrapper
        wrapperClassName="relative h-full w-full"
        canvasClassName="h-full w-full touch-none"
        cameraPosition={[0, 2.9, 0]}
        cameraFov={60}
        dpr={[1, 1.75]}
        transparent={false}
      >
        <OpenFieldScene />
      </CanvasWrapper>
      <TheRoomSound src="/room-thin.ogg" />
      {touch && (
        <TheRoomJoystick className="absolute bottom-[calc(clamp(1.25rem,4vh,2.5rem)+2rem)] left-[clamp(1rem,4vw,2.5rem)]" />
      )}
      <p className="pointer-events-none absolute bottom-[clamp(1.25rem,4vh,2.5rem)] left-[clamp(1rem,4vw,2.5rem)] font-sans text-[11px] font-light uppercase tracking-[0.3em] text-[#404040]/70">
        {touch ? 'Joystick to move · drag to look' : 'WASD / arrows to move · drag to look'}
      </p>
    </div>
  );
}
