'use client';

import { CanvasWrapper } from '@/components/canvas';
import { ArcadeScene } from '@/components/experience/ArcadeScene';

export function ArcadeExperience() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <CanvasWrapper
        wrapperClassName="relative h-full w-full -translate-y-[6vh]"
        canvasClassName="h-full w-full"
        cameraPosition={[15, 5, 15]}
        cameraFov={32}
        dpr={[1, 1.5]}
        shadows
      >
        <ArcadeScene />
      </CanvasWrapper>
    </div>
  );
}
