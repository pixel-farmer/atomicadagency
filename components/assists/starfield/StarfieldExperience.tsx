'use client';

import { Starfield } from '@/components/assists/starfield/Starfield';
import { STARFIELD_CONFIG } from '@/components/assists/starfield/starfieldConfig';
import { StarfieldSoundToggle } from '@/components/assists/starfield/StarfieldSoundToggle';

export function StarfieldExperience() {
  return (
    <div className="relative h-full w-full bg-[#03040c]">
      {STARFIELD_CONFIG.soundButtonEnabled ? <StarfieldSoundToggle /> : null}
      <Starfield layout="fullscreen" />
    </div>
  );
}
