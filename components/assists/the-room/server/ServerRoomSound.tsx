'use client';

import { useEffect, useState } from 'react';
import { SoundOffIcon, SoundOnIcon } from '@/components/assists/the-room/TheRoomSound';
import { createServerAudio, serverAudio } from '@/components/assists/the-room/server/serverAudio';
import { MACHINES } from '@/components/assists/the-room/server/serverRoomConfig';

const FADE_IN_SECONDS = 1.2;
const FADE_OUT_SECONDS = 0.15;

/** Sets up the room's synthesized sound and shows the on/off button. */
export function ServerRoomSound() {
  const [soundOn, setSoundOn] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const printer = MACHINES.find((m) => m.kind === 'printer');
    const tape = MACHINES.find((m) => m.kind === 'tape');
    const audio = createServerAudio({
      printer: printer ? { x: printer.x, z: printer.z } : { x: 0, z: 0 },
      tape: tape ? { x: tape.x, z: tape.z } : null,
    });
    audio.ctx.onstatechange = () => setRunning(audio.ctx.state === 'running');
    serverAudio.current = audio;
    return () => {
      if (serverAudio.current === audio) serverAudio.current = null;
      audio.ctx.onstatechange = null;
      audio.dispose();
    };
  }, []);

  useEffect(() => {
    const audio = serverAudio.current;
    if (!audio) return;
    const { ctx, master } = audio;

    const rampTo = (value: number, seconds: number) => {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(value, now + seconds);
    };

    if (!soundOn) {
      rampTo(0, FADE_OUT_SECONDS);
      const timer = window.setTimeout(() => {
        if (ctx.state === 'running') void ctx.suspend();
      }, FADE_OUT_SECONDS * 1000 + 50);
      return () => window.clearTimeout(timer);
    }

    const start = () => void ctx.resume().then(() => rampTo(1, FADE_IN_SECONDS));
    start();
    // Browsers keep audio blocked until the visitor interacts, so start on their first touch or key.
    const unlock = (e: Event) => {
      if (ctx.state === 'running') return;
      if (e.target instanceof Element && e.target.closest('[data-room-sound]')) return;
      start();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [soundOn]);

  const audible = soundOn && running;

  return (
    <button
      type="button"
      data-room-sound
      onClick={() => {
        if (audible) {
          setSoundOn(false);
        } else {
          setSoundOn(true);
          void serverAudio.current?.ctx.resume();
        }
      }}
      className="pointer-events-auto absolute bottom-[clamp(1.25rem,4vh,2.5rem)] right-[clamp(1rem,4vw,2.5rem)] z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/90 bg-black/35 text-white shadow-sm backdrop-blur-sm transition hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      aria-pressed={audible}
      aria-label={audible ? 'Turn off sound' : 'Turn on sound'}
    >
      {audible ? <SoundOnIcon /> : <SoundOffIcon />}
    </button>
  );
}
