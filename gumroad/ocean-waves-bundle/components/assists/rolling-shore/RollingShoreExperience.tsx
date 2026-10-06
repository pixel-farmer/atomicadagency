'use client';

import { useTexture } from '@react-three/drei';
import { CanvasWrapper } from '@/components/canvas';
import { OceanWavesSoundToggle } from '@/components/assists/rolling-shore/OceanWavesSoundToggle';
import { ROLLING_SHORE_CONFIG } from '@/components/assists/rolling-shore/rollingShoreConfig';
import { RollingShoreScene } from '@/components/assists/rolling-shore/RollingShoreScene';

useTexture.preload('/sand03-seamless.png');

export function RollingShoreExperience() {
  return (
    <div className="relative h-full w-full bg-[#5c5668]">
      {ROLLING_SHORE_CONFIG.soundButtonEnabled ? <OceanWavesSoundToggle /> : null}
      <CanvasWrapper
        wrapperClassName="relative h-full w-full"
        canvasClassName="h-full w-full touch-none"
        cameraPosition={[0, 0.42, -4.8]}
        cameraFov={48}
        dpr={[1, 1.75]}
        shadows={false}
        transparent={false}
      >
        <RollingShoreScene />
      </CanvasWrapper>
    </div>
  );
}
