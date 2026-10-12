'use client';

import { CanvasWrapper } from '@/components/canvas';
import { BACKGROUND_COLOR, SapphiresScene } from '@/components/assists/sapphires/SapphiresScene';

export function SapphiresExperience() {
  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ backgroundColor: BACKGROUND_COLOR }}>
      <CanvasWrapper
        wrapperClassName="relative h-full w-full"
        canvasClassName="h-full w-full touch-none"
        cameraPosition={[0, 1.15, 6.2]}
        cameraFov={36}
        dpr={[1, 2]}
        transparent={false}
      >
        <SapphiresScene />
      </CanvasWrapper>
    </div>
  );
}
