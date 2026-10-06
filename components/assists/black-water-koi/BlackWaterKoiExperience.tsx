'use client';

import { CanvasWrapper } from '@/components/canvas';
import { BLACK_WATER_KOI_CONFIG } from '@/components/assists/black-water-koi/blackWaterKoiConfig';
import { BlackWaterKoiScene } from '@/components/assists/black-water-koi/BlackWaterKoiScene';
import { BlackWaterKoiSoundToggle } from '@/components/assists/black-water-koi/BlackWaterKoiSoundToggle';

export function BlackWaterKoiExperience() {
  return (
    <div className="relative h-full w-full bg-black">
      <CanvasWrapper
        wrapperClassName="relative h-full w-full"
        canvasClassName="h-full w-full touch-none"
        cameraPosition={[0, 11, 5.2]}
        cameraFov={42}
        dpr={[1, 1.75]}
        shadows={false}
        transparent={false}
      >
        <BlackWaterKoiScene />
      </CanvasWrapper>
      {BLACK_WATER_KOI_CONFIG.soundButtonEnabled ? <BlackWaterKoiSoundToggle /> : null}
    </div>
  );
}
