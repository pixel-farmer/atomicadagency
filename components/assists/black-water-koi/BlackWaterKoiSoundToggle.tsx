'use client';

import { useEffect, useRef, useState } from 'react';

const RAIN_AUDIO_SRC = '/raining.ogg';

function MicOnIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="text-white"
    >
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

function MicOffIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="text-white"
    >
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

const RAIN_VOLUME = 0.55;
/**
 * Exact length of raining.ogg (1,940,400 samples @ 44.1 kHz). Chrome decodes ~15 ms of
 * near-silent encoder padding past this, so the padding is never played.
 * Update if the file is re-rendered at a different length.
 */
const RAIN_LOOP_SECONDS = 44;
/**
 * The decoded start and end don't line up exactly (the 528 Hz tone is a few samples out of
 * phase), so the loop seam is crossfaded instead of hard-cut.
 */
const SEAM_CROSSFADE_SECONDS = 0.5;
/** Search window for the tone-phase-aligned crossfade start. */
const SEAM_SEARCH_SECONDS = 0.007;
/** Short ramp so toggling on/off doesn't click. */
const FADE_SECONDS = 0.08;

/**
 * Builds a buffer whose last `fade` samples blend the file's tail into its head, so playback
 * wraps from the blend straight into the continuation of the head with no discontinuity.
 */
function buildSeamlessLoop(ctx: AudioContext, src: AudioBuffer): AudioBuffer {
  const sr = src.sampleRate;
  const contentLen = Math.min(src.length, Math.round(RAIN_LOOP_SECONDS * sr));
  const fade = Math.round(SEAM_CROSSFADE_SECONDS * sr);
  if (contentLen < fade * 4) return src;

  const probe = Math.min(2048, fade);
  const ref = src.getChannelData(0);
  const latest = contentLen - fade;
  const earliest = Math.max(fade, latest - Math.round(SEAM_SEARCH_SECONDS * sr));
  let end = latest;
  let bestCorr = -Infinity;
  for (let e = earliest; e <= latest; e++) {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let k = 0; k < probe; k++) {
      const a = ref[e + k];
      const b = ref[k];
      dot += a * b;
      na += a * a;
      nb += b * b;
    }
    const corr = dot / Math.sqrt(na * nb || 1);
    if (corr > bestCorr) {
      bestCorr = corr;
      end = e;
    }
  }

  const out = ctx.createBuffer(src.numberOfChannels, end, sr);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const x = src.getChannelData(ch);
    const y = out.getChannelData(ch);
    y.set(x.subarray(fade, end));
    for (let k = 0; k < fade; k++) {
      const w = 0.5 - 0.5 * Math.cos((Math.PI * k) / fade);
      y[end - fade + k] = x[end + k] * (1 - w) + x[k] * w;
    }
  }
  return out;
}

export function BlackWaterKoiSoundToggle() {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const bufferRef = useRef<Promise<AudioBuffer> | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    return () => {
      sourceRef.current?.stop();
      sourceRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
      gainRef.current = null;
      bufferRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!soundOn) {
      const ctx = ctxRef.current;
      const gain = gainRef.current;
      if (!ctx || !gain) return;
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
      void new Promise((r) => setTimeout(r, FADE_SECONDS * 1000 + 20)).then(() => {
        if (ctxRef.current === ctx && ctx.state === 'running') void ctx.suspend();
      });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        if (!ctxRef.current) {
          const ctx = new AudioContext();
          const gain = ctx.createGain();
          gain.gain.value = 0;
          gain.connect(ctx.destination);
          ctxRef.current = ctx;
          gainRef.current = gain;
          bufferRef.current = fetch(RAIN_AUDIO_SRC)
            .then((res) => res.arrayBuffer())
            .then((data) => ctx.decodeAudioData(data))
            .then((decoded) => buildSeamlessLoop(ctx, decoded));
        }
        const ctx = ctxRef.current;
        const gain = gainRef.current!;
        await ctx.resume();
        const buffer = await bufferRef.current!;
        if (cancelled) return;

        if (!sourceRef.current) {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(gain);
          source.start();
          sourceRef.current = source;
        }

        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(RAIN_VOLUME, now + FADE_SECONDS);
      } catch {
        if (!cancelled) setSoundOn(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [soundOn]);

  return (
    <button
      type="button"
      onClick={() => setSoundOn((on) => !on)}
      className="pointer-events-auto absolute bottom-[clamp(1.25rem,4vh,2.5rem)] right-[clamp(1rem,4vw,2.5rem)] z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/90 bg-black/35 text-white shadow-sm backdrop-blur-sm transition hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      aria-pressed={soundOn}
      aria-label={soundOn ? 'Turn off rain sound' : 'Turn on rain sound'}
    >
      {soundOn ? <MicOnIcon /> : <MicOffIcon />}
    </button>
  );
}
