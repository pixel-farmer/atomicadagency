'use client';

import { CanvasWrapper } from '@/components/canvas';
import { FloorWalkScene } from '@/components/experience/FloorWalkScene';
import LightRays from '@/components/reactbits/lightrays';

export function FloorExperience() {
  return (
    <div className="relative h-dvh w-full bg-black">
      <CanvasWrapper
        wrapperClassName="relative z-[1] h-full w-full"
        canvasClassName="h-full w-full"
        cameraPosition={[0, 1.65, 4]}
        cameraFov={60}
        dpr={[1, 1.75]}
        shadows
      >
        <FloorWalkScene />
      </CanvasWrapper>

      <div className="pointer-events-none absolute inset-0 z-[2]">
        <LightRays
          raysOrigin="top-center"
          raysColor="#ffffff"
          raysSpeed={1}
          lightSpread={0.5}
          rayLength={3}
          followMouse
          mouseInfluence={0.1}
          noiseAmount={0}
          distortion={0}
          className="custom-rays"
          pulsating={false}
          fadeDistance={1}
          saturation={1}
        />
      </div>
    </div>
  );
}
