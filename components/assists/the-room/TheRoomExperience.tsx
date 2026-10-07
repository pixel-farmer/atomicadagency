'use client';

import { CanvasWrapper } from '@/components/canvas';
import { TheRoomScene } from '@/components/assists/the-room/TheRoomScene';

export function TheRoomExperience() {
  return (
    <div className="relative h-full w-full bg-[#f4f4f4]">
      <CanvasWrapper
        wrapperClassName="relative h-full w-full"
        canvasClassName="h-full w-full touch-none"
        cameraPosition={[0, 1.6, 6]}
        cameraFov={60}
        dpr={[1, 1.75]}
        transparent={false}
      >
        <TheRoomScene />
      </CanvasWrapper>
      <p className="pointer-events-none absolute bottom-[clamp(1.25rem,4vh,2.5rem)] left-[clamp(1rem,4vw,2.5rem)] font-sans text-[11px] font-light uppercase tracking-[0.3em] text-[#404040]/70">
        WASD / arrows to move · drag to look
      </p>
    </div>
  );
}
