'use client';

import { useEffect, useRef, useState } from 'react';
import type { RoomPuzzleState } from '@/components/assists/the-room/theRoomPuzzle';

const THIN_SRC = '/room-thin.ogg';
/** The deeper layer that fades in with calm. Set to e.g. '/room-full.ogg' once the file exists. */
const FULL_SRC: string | null = null;

const THIN_VOLUME = 0.6;
const FULL_VOLUME = 0.7;
/** The wind swells by this fraction as the room calms and the breeze turns toward the visitor. */
const THIN_CALM_SWELL = 0.35;
/** Seam blend length. Wind is noise, so an equal-power blend keeps the loudness steady. */
const SEAM_SECONDS = 2;
/**
 * room-thin.ogg fades in over ~0.5 s and out over ~1.5 s; blending those fades would dip the
 * volume at every loop, so they're skipped. Set both to 0 for a file exported without fades.
 */
const EDGE_TRIM_START_SECONDS = 0.6;
const EDGE_TRIM_END_SECONDS = 1.6;
const FADE_IN_SECONDS = 0.8;
const FADE_OUT_SECONDS = 0.15;

/** Ignores near-silent encoder padding some browsers decode past the real end of the file. */
function audibleLength(src: AudioBuffer) {
  const ref = src.getChannelData(0);
  let end = ref.length;
  while (end > 0 && Math.abs(ref[end - 1]) < 1e-4) end--;
  return end;
}

/** Folds the tail into the head so the buffer loops with no audible restart. */
function buildSeamlessLoop(ctx: AudioContext, src: AudioBuffer): AudioBuffer {
  const sr = src.sampleRate;
  const start = Math.round(EDGE_TRIM_START_SECONDS * sr);
  const stop = audibleLength(src) - Math.round(EDGE_TRIM_END_SECONDS * sr);
  const length = stop - start;
  const fade = Math.round(SEAM_SECONDS * sr);
  if (length < fade * 4) return src;

  // Plays x[fade..length); its last `fade` samples blend the tail into x[0..fade), so the wrap
  // back to x[fade] continues exactly where the blend left off.
  const out = ctx.createBuffer(src.numberOfChannels, length - fade, sr);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const x = src.getChannelData(ch).subarray(start, stop);
    const y = out.getChannelData(ch);
    y.set(x.subarray(fade));
    for (let k = 0; k < fade; k++) {
      const w = (k / fade) * (Math.PI / 2);
      y[length - 2 * fade + k] = x[length - fade + k] * Math.cos(w) + x[k] * Math.sin(w);
    }
  }
  return out;
}

function SoundOnIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 11a7 7 0 0 1-14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SoundOffIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9V6a3 3 0 0 0-5.66-1.34"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 11a7 7 0 0 1-2.16 4.12M5 11a7 7 0 0 0 11.5 5.4M12 18v3M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type RoomAudio = { ctx: AudioContext; master: GainNode };

/** Plays the room's wind (and later the full layer), following the puzzle's calm, with an on/off button. */
export function TheRoomSound({ puzzle }: { puzzle: RoomPuzzleState }) {
  const audio = useRef<RoomAudio | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const thinGain = ctx.createGain();
    thinGain.gain.value = THIN_VOLUME;
    thinGain.connect(master);
    const fullGain = ctx.createGain();
    fullGain.gain.value = 0;
    fullGain.connect(master);

    let cancelled = false;
    const sources: AudioBufferSourceNode[] = [];
    const load = async (src: string, gain: GainNode) => {
      const res = await fetch(src);
      const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
      if (cancelled) return;
      const source = ctx.createBufferSource();
      source.buffer = buildSeamlessLoop(ctx, decoded);
      source.loop = true;
      source.connect(gain);
      source.start();
      sources.push(source);
    };
    void load(THIN_SRC, thinGain).catch(() => {});
    if (FULL_SRC) void load(FULL_SRC, fullGain).catch(() => {});

    ctx.onstatechange = () => setRunning(ctx.state === 'running');
    audio.current = { ctx, master };

    // Layer volumes follow calm; ten updates a second with a smoothing curve is plenty.
    const follow = window.setInterval(() => {
      const now = ctx.currentTime;
      thinGain.gain.setTargetAtTime(THIN_VOLUME * (1 + THIN_CALM_SWELL * puzzle.calm), now, 0.4);
      fullGain.gain.setTargetAtTime(FULL_VOLUME * puzzle.calm, now, 0.5);
    }, 100);

    return () => {
      cancelled = true;
      window.clearInterval(follow);
      sources.forEach((s) => s.stop());
      ctx.onstatechange = null;
      void ctx.close();
      audio.current = null;
    };
  }, [puzzle]);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const { ctx, master } = a;

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
    // Some browsers keep audio blocked until the visitor interacts; start on their first touch or key.
    // The sound button handles its own clicks, so it's excluded here.
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
          void audio.current?.ctx.resume();
        }
      }}
      className="pointer-events-auto absolute bottom-[clamp(1.25rem,4vh,2.5rem)] right-[clamp(1rem,4vw,2.5rem)] z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/90 bg-black/35 text-white shadow-sm backdrop-blur-sm transition hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      aria-pressed={audible}
      aria-label={audible ? 'Turn off room sound' : 'Turn on room sound'}
    >
      {audible ? <SoundOnIcon /> : <SoundOffIcon />}
    </button>
  );
}
