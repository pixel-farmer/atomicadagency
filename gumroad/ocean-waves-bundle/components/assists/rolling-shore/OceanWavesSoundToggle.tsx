'use client';

import { useEffect, useRef, useState } from 'react';

const OCEAN_WAVES_SRC = '/ocean-waves.mp3';

function MicOnIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        stroke="#1a1a1a"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 11a7 7 0 0 1-14 0M12 18v3"
        stroke="#1a1a1a"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9V6a3 3 0 0 0-5.66-1.34"
        stroke="#1a1a1a"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 11a7 7 0 0 1-2.16 4.12M5 11a7 7 0 0 0 11.5 5.4M12 18v3M3 3l18 18"
        stroke="#1a1a1a"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OceanWavesSoundToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    const audio = new Audio(OCEAN_WAVES_SRC);
    audio.loop = true;
    audio.volume = 0.55;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (soundOn) {
      void audio.play().catch(() => setSoundOn(false));
    } else {
      audio.pause();
    }
  }, [soundOn]);

  return (
    <button
      type="button"
      onClick={() => setSoundOn((on) => !on)}
      className="pointer-events-auto absolute left-[clamp(1rem,4vw,2.5rem)] top-[clamp(1.25rem,4vh,2.5rem)] z-20 flex h-10 w-10 items-center justify-center rounded-full border border-[#2a2a2a] bg-white/70 shadow-sm transition hover:bg-white/85 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2a2a2a]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      aria-pressed={soundOn}
      aria-label={soundOn ? 'Turn off ocean sound' : 'Turn on ocean sound'}
    >
      {soundOn ? <MicOnIcon /> : <MicOffIcon />}
    </button>
  );
}
