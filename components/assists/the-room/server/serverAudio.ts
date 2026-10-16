import type { EditEvent, FeedStats } from '@/components/assists/the-room/server/wikiFeed';

/**
 * Every sound in the server room is synthesized with the Web Audio API, so there are no files to
 * load. Machines are placed in 3D: walk toward the printer and its chatter gets louder.
 *
 *   room tone   brown noise, low-passed, always on
 *   fans        band-passed noise that swells with edit traffic
 *   mains hum   HUM_HZ and harmonics, plus a faint fluorescent buzz
 *   relays      one click per edit at the cabinet that blinked (bots click higher)
 *   new page    a short terminal chirp when a brand-new article is created
 *   printer     dot-matrix chatter per printed line, then a line-feed thunk
 *   tape drive  a whir whose pitch follows the edit rate
 *   alarm       two-tone klaxon during the red alert
 */

/** Overall loudness of each layer. 0 mutes it. */
const LEVELS = {
  roomTone: 0.003,
  fans: 0.01,
  hum: 0.002,
  buzz: 0.002,
  relay: 0.1,
  chirp: 0.01,
  printer: 0.2,
  tape: 0.05,
  alarm: 0.05,
};
/** Pitch of the mains hum in Hz. Real mains is 60 (US) or 50 (Europe); higher reads as a whine. */
const HUM_HZ = 95;
/** Shortest gap between relay clicks, in seconds, so bursts don't turn into a roar. */
const RELAY_MIN_GAP = 0.03;
/** One printed line takes this long; extra lines that arrive meanwhile are skipped. */
const PRINT_LINE_SECONDS = 0.34;

export type Spot = { x: number; z: number };

export type ServerAudio = {
  ctx: AudioContext;
  master: GainNode;
  edit: (ev: EditEvent, at: Spot | null) => void;
  printLine: () => void;
  /** Call every frame with the feed stats and whether the red alert is on. */
  update: (stats: FeedStats, alerting: boolean, time: number) => void;
  setListener: (position: { x: number; y: number; z: number }, forward: { x: number; y: number; z: number }) => void;
  dispose: () => void;
};

/** The live engine, if sound is set up. The canvas reads this; the sound button owns it. */
export const serverAudio: { current: ServerAudio | null } = { current: null };

function noiseBuffer(ctx: AudioContext, seconds: number, kind: 'white' | 'brown') {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === 'white') {
      data[i] = white;
    } else {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buffer;
}

function loop(ctx: AudioContext, buffer: AudioBuffer) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start(0, Math.random() * buffer.duration);
  return source;
}

function filter(ctx: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7) {
  return new BiquadFilterNode(ctx, { type, frequency, Q: q });
}

function panner(ctx: AudioContext, x: number, y: number, z: number) {
  return new PannerNode(ctx, {
    panningModel: 'equalpower',
    distanceModel: 'inverse',
    refDistance: 1.5,
    maxDistance: 40,
    rolloffFactor: 1.1,
    positionX: x,
    positionY: y,
    positionZ: z,
  });
}

/** A short percussive envelope on `gain`, starting at `at`. */
function strike(gain: GainNode, at: number, peak: number, decay: number) {
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
}

export function createServerAudio(spots: { printer: Spot; tape: Spot | null }): ServerAudio {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0;
  const limiter = new DynamicsCompressorNode(ctx, { threshold: -14, ratio: 6, attack: 0.003, release: 0.2 });
  master.connect(limiter).connect(ctx.destination);

  const white = noiseBuffer(ctx, 2, 'white');
  const brown = noiseBuffer(ctx, 5, 'brown');
  const stoppables: AudioScheduledSourceNode[] = [];

  // Room tone.
  const toneGain = new GainNode(ctx, { gain: LEVELS.roomTone });
  const tone = loop(ctx, brown);
  tone.connect(filter(ctx, 'lowpass', 420)).connect(toneGain).connect(master);
  stoppables.push(tone);

  // Fans: a slow wobble, plus a swell that follows traffic.
  const fanGain = new GainNode(ctx, { gain: LEVELS.fans });
  const fans = loop(ctx, white);
  fans.connect(filter(ctx, 'bandpass', 750, 0.6)).connect(fanGain).connect(master);
  const wobble = new OscillatorNode(ctx, { frequency: 0.23 });
  const wobbleDepth = new GainNode(ctx, { gain: LEVELS.fans * 0.25 });
  wobble.connect(wobbleDepth).connect(fanGain.gain);
  stoppables.push(fans, wobble);

  // Mains hum and fluorescent buzz.
  const humGain = new GainNode(ctx, { gain: LEVELS.hum });
  humGain.connect(master);
  for (const [multiple, level] of [[1, 1], [2, 0.5], [3, 0.2]] as const) {
    const osc = new OscillatorNode(ctx, { frequency: HUM_HZ * multiple });
    osc.connect(new GainNode(ctx, { gain: level })).connect(humGain);
    stoppables.push(osc);
  }
  const buzz = new OscillatorNode(ctx, { type: 'sawtooth', frequency: 120 });
  buzz.connect(filter(ctx, 'bandpass', 3200, 3)).connect(new GainNode(ctx, { gain: LEVELS.buzz })).connect(master);
  stoppables.push(buzz);

  // Printer and tape drive sit at their machines.
  const printerBus = new GainNode(ctx, { gain: LEVELS.printer });
  printerBus.connect(panner(ctx, spots.printer.x, 1.1, spots.printer.z)).connect(master);

  const tapeGain = new GainNode(ctx, { gain: 0 });
  const tapeOsc = new OscillatorNode(ctx, { type: 'sawtooth', frequency: 48 });
  if (spots.tape) {
    tapeOsc
      .connect(filter(ctx, 'lowpass', 520))
      .connect(tapeGain)
      .connect(panner(ctx, spots.tape.x, 1.0, spots.tape.z))
      .connect(master);
  }
  stoppables.push(tapeOsc);

  // Alarm klaxon, gated by its gain.
  const alarmGain = new GainNode(ctx, { gain: 0 });
  const alarmOsc = new OscillatorNode(ctx, { type: 'square', frequency: 660 });
  alarmOsc.connect(filter(ctx, 'lowpass', 1800)).connect(alarmGain).connect(master);
  stoppables.push(alarmOsc);

  stoppables.forEach((s) => {
    if (s instanceof OscillatorNode) s.start();
  });

  let nextRelay = 0;
  let printerFreeAt = 0;

  /** A burst of filtered noise: the basic click every machine sound is made from. */
  const tick = (at: number, destination: AudioNode, frequency: number, q: number, peak: number, decay: number) => {
    const src = new AudioBufferSourceNode(ctx, { buffer: white });
    const env = new GainNode(ctx, { gain: 0 });
    src.connect(filter(ctx, 'bandpass', frequency, q)).connect(env).connect(destination);
    strike(env, at, peak, decay);
    src.start(at, Math.random() * (white.duration - 0.1), decay + 0.02);
  };

  return {
    ctx,
    master,

    edit(ev, at) {
      if (ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (now < nextRelay) return;
      nextRelay = now + RELAY_MIN_GAP;
      const spot = at ?? { x: (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 8 };
      const out = panner(ctx, spot.x, 1.7, spot.z);
      out.connect(master);
      const pitch = (ev.bot ? 2600 : 1600) * (0.85 + Math.random() * 0.3);
      tick(now, out, pitch, 4, LEVELS.relay, 0.03);
      // Relays often bounce: a softer second click a moment later.
      if (Math.random() < 0.4) tick(now + 0.012 + Math.random() * 0.01, out, pitch * 0.8, 4, LEVELS.relay * 0.4, 0.025);

      if (ev.isNew) {
        const chirp = new OscillatorNode(ctx, { type: 'square', frequency: 1200 });
        const env = new GainNode(ctx, { gain: 0 });
        chirp.connect(filter(ctx, 'lowpass', 2600)).connect(env).connect(out);
        chirp.frequency.setValueAtTime(1200, now + 0.02);
        chirp.frequency.setValueAtTime(1800, now + 0.09);
        env.gain.setValueAtTime(0, now + 0.02);
        env.gain.linearRampToValueAtTime(LEVELS.chirp, now + 0.025);
        env.gain.setValueAtTime(LEVELS.chirp, now + 0.16);
        env.gain.linearRampToValueAtTime(0, now + 0.17);
        chirp.start(now + 0.02);
        chirp.stop(now + 0.18);
      }
    },

    printLine() {
      if (ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (now < printerFreeAt) return;
      printerFreeAt = now + PRINT_LINE_SECONDS;
      const dots = 7 + Math.floor(Math.random() * 6);
      for (let i = 0; i < dots; i++) {
        tick(now + i * 0.024 + Math.random() * 0.004, printerBus, 3000 + Math.random() * 900, 2, 0.6, 0.014);
      }
      // Line feed: a low, soft thunk after the head returns.
      tick(now + dots * 0.024 + 0.04, printerBus, 380, 1.2, 0.5, 0.06);
    },

    update(stats, alerting, time) {
      const now = ctx.currentTime;
      const perSecond = stats.rate / 60;
      const busy = Math.min(1, perSecond / 25);
      fanGain.gain.setTargetAtTime(LEVELS.fans * (0.7 + 0.8 * busy), now, 0.8);
      tapeGain.gain.setTargetAtTime(LEVELS.tape * (0.4 + busy), now, 0.5);
      tapeOsc.frequency.setTargetAtTime(38 + perSecond * 2.2, now, 0.6);
      alarmGain.gain.setTargetAtTime(alerting ? LEVELS.alarm : 0, now, 0.03);
      if (alerting) alarmOsc.frequency.setTargetAtTime(Math.floor(time * 2.5) % 2 ? 880 : 660, now, 0.01);
    },

    setListener(p, f) {
      const l = ctx.listener;
      const now = ctx.currentTime;
      if (l.positionX) {
        l.positionX.setTargetAtTime(p.x, now, 0.05);
        l.positionY.setTargetAtTime(p.y, now, 0.05);
        l.positionZ.setTargetAtTime(p.z, now, 0.05);
        l.forwardX.setTargetAtTime(f.x, now, 0.05);
        l.forwardY.setTargetAtTime(f.y, now, 0.05);
        l.forwardZ.setTargetAtTime(f.z, now, 0.05);
        l.upX.value = 0;
        l.upY.value = 1;
        l.upZ.value = 0;
      } else {
        // Older Firefox and Safari.
        l.setPosition(p.x, p.y, p.z);
        l.setOrientation(f.x, f.y, f.z, 0, 1, 0);
      }
    },

    dispose() {
      stoppables.forEach((s) => {
        try {
          s.stop();
        } catch {
          // Already stopped.
        }
      });
      void ctx.close();
    },
  };
}
