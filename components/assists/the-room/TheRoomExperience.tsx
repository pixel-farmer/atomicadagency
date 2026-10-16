'use client';

import { useEffect, useState } from 'react';
import { CanvasWrapper } from '@/components/canvas';
import { TheRoomJoystick } from '@/components/assists/the-room/TheRoomJoystick';
import { ServerRoomHud } from '@/components/assists/the-room/server/ServerRoomHud';
import { ServerRoomScene } from '@/components/assists/the-room/server/ServerRoomScene';
import { startWikiFeed } from '@/components/assists/the-room/server/wikiFeed';

export function TheRoomExperience() {
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const sync = () => setTouch(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // Live Wikipedia edits drive the machines. Falls back to a sample feed if the stream is unreachable.
  useEffect(() => startWikiFeed(), []);

  return (
    <div className="relative h-full w-full bg-[#0d0e0f]">
      <CanvasWrapper
        wrapperClassName="relative h-full w-full"
        canvasClassName="h-full w-full touch-none"
        cameraPosition={[0, 1.65, 7.5]}
        cameraFov={60}
        dpr={[1, 1.5]}
        transparent={false}
      >
        <ServerRoomScene />
      </CanvasWrapper>
      <ServerRoomHud />
      {touch && (
        <TheRoomJoystick className="absolute bottom-[calc(clamp(1.25rem,4vh,2.5rem)+2rem)] left-[clamp(1rem,4vw,2.5rem)] z-10" />
      )}
      <p className="pointer-events-none absolute bottom-[clamp(1.25rem,4vh,2.5rem)] left-[clamp(1rem,4vw,2.5rem)] z-10 font-sans text-[11px] font-light uppercase tracking-[0.3em] text-[#ecebe6]/70 [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">
        {touch ? 'Joystick to move · drag to look' : 'WASD / arrows to move · drag to look'}
      </p>
    </div>
  );
}
