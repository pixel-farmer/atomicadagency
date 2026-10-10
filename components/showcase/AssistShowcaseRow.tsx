'use client';



import { AnimatePresence, motion } from 'framer-motion';

import dynamic from 'next/dynamic';

import { useLenis } from 'lenis/react';
import { useCallback, useEffect, useRef, useState } from 'react';

void import('@/components/assists/black-water-koi').then(() => undefined);
void import('@/components/assists/rolling-shore').then(() => undefined);
void import('@/components/assists/starfield').then(() => undefined);
void import('@/components/assists/the-room').then(() => undefined);
void import('@/components/assists/open-field').then(() => undefined);

const BlackWaterKoiExperience = dynamic(

  () =>

    import('@/components/assists/black-water-koi').then((m) => m.BlackWaterKoiExperience),

  { ssr: false },

);

const RollingShoreExperience = dynamic(

  () =>

    import('@/components/assists/rolling-shore').then((m) => m.RollingShoreExperience),

  { ssr: false },

);

const StarfieldExperience = dynamic(

  () =>

    import('@/components/assists/starfield').then((m) => m.StarfieldExperience),

  { ssr: false },

);

const TheRoomExperience = dynamic(
  () => import('@/components/assists/the-room').then((m) => m.TheRoomExperience),
  { ssr: false },
);

const OpenFieldExperience = dynamic(
  () => import('@/components/assists/open-field').then((m) => m.OpenFieldExperience),
  { ssr: false },
);



/** One circle per entry; the grid is 3 wide, so entry 4 starts a new row under the first. */
const ASSIST_CAPTIONS = [
  'BLACK WATER KOI',
  'OCEAN WAVES',
  'STARFIELD',
  'THE ROOM',
  'OPEN FIELD',
] as const;



const EXPAND_MS = 0.62;

const EASE = [0.32, 0.72, 0, 1] as const;

const BLACK_WATER_KOI_GUMROAD_URL =
  'https://vaxionstudios.gumroad.com/l/blackwaterkoi';

const OCEAN_WAVES_GUMROAD_URL =
  'https://vaxionstudios.gumroad.com/l/oceanwaves';

export type ThumbnailRect = {

  left: number;

  top: number;

  width: number;

  height: number;

};



function scaleToCoverViewport(rect: ThumbnailRect) {

  const cx = rect.left + rect.width / 2;

  const cy = rect.top + rect.height / 2;

  const vw = window.innerWidth;

  const vh = window.innerHeight;

  const corners: [number, number][] = [

    [0, 0],

    [vw, 0],

    [0, vh],

    [vw, vh],

  ];

  let maxDist = 0;

  for (const [x, y] of corners) {

    maxDist = Math.max(maxDist, Math.hypot(x - cx, y - cy));

  }

  return ((maxDist * 2) / rect.width) * 1.03;

}



function AssistThumbnail({

  onSelect,

  label,

  caption,

}: {

  onSelect: (rect: ThumbnailRect) => void;

  label: string;

  caption?: string;

}) {

  return (

    <button

      type="button"

      onClick={(e) => {

        const r = e.currentTarget.getBoundingClientRect();

        onSelect({

          left: r.left,

          top: r.top,

          width: r.width,

          height: r.height,

        });

      }}

      className="relative z-[3] aspect-square w-full max-w-[260px] cursor-pointer justify-self-center transition duration-300 hover:scale-[1.03] hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#bd5b5b]"

      aria-label={label}

    >

      <span className="block h-full w-full rounded-full bg-black shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,255,255,0.08)] transition duration-300 group-hover:shadow-[0_18px_48px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(255,255,255,0.14)]" />

      {caption ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-[10%] text-center font-sans text-[13px] font-extralight uppercase leading-snug tracking-[0.16em] text-white sm:text-[14px] md:text-[15px]">
          {caption}
        </span>
      ) : null}

    </button>

  );

}



function AssistGrowingOverlay({

  assistIndex,

  origin,

  onClose,

}: {

  assistIndex: number;

  origin: ThumbnailRect;

  onClose: () => void;

}) {

  const cx = origin.left + origin.width / 2;

  const cy = origin.top + origin.height / 2;

  const endScale = scaleToCoverViewport(origin);

  const [phase, setPhase] = useState<'entering' | 'open' | 'exiting'>('entering');
  const [sceneReady, setSceneReady] = useState(false);
  const expandDone = useRef(false);
  const lenis = useLenis();

  const requestClose = useCallback(() => {
    setPhase((p) => (p === 'exiting' ? p : 'exiting'));
    setSceneReady(false);
  }, []);

  useEffect(() => {
    setPhase('entering');
    setSceneReady(false);
    expandDone.current = false;
  }, [assistIndex, origin.left, origin.top]);

  useEffect(() => {
    lenis?.stop();
    return () => {
      lenis?.start();
    };
  }, [lenis]);

  useEffect(() => {

    const prev = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {

      if (e.key === 'Escape') requestClose();

    };

    window.addEventListener('keydown', onKey);

    return () => {

      document.body.style.overflow = prev;

      window.removeEventListener('keydown', onKey);

    };

  }, [requestClose]);

  const showBlackWaterKoi = assistIndex === 0 && sceneReady;
  const showRollingShore = assistIndex === 1 && sceneReady;
  const showStarfield = assistIndex === 2 && sceneReady;
  const showTheRoom = assistIndex === 3 && sceneReady;
  const showOpenField = assistIndex === 4 && sceneReady;
  /** Scenes bright enough that the close button needs its dark style. */
  const lightScene =
    (assistIndex === 1 || assistIndex === 3 || assistIndex === 4) && phase === 'open';
  const circleHidden = phase === 'open';
  const circleScale = phase === 'exiting' ? 1 : endScale;
  const overlayOpenBg =
    sceneReady && phase === 'open'
      ? assistIndex === 1
        ? 'bg-[#5c5668]'
        : assistIndex === 2
          ? 'bg-[#03040c]'
          : assistIndex === 3
            ? 'bg-[#a9c2d4]'
            : assistIndex === 4
              ? 'bg-[#cfdde3]'
              : 'bg-black'
      : 'bg-transparent';

  return (

    <motion.div

      className={`fixed inset-0 z-[100] overflow-hidden ${overlayOpenBg}`}

      role="dialog"

      aria-modal="true"

      aria-label="Assist preview"

      initial={{ opacity: 1 }}

      exit={{ opacity: 1 }}

    >

      {showBlackWaterKoi ? (

        <div className="absolute inset-0 z-[1]">

          <BlackWaterKoiExperience />

        </div>

      ) : null}

      {showRollingShore ? (

        <div className="absolute inset-0 z-[1]">

          <RollingShoreExperience />

        </div>

      ) : null}

      {showStarfield ? (

        <div className="absolute inset-0 z-[1]">

          <StarfieldExperience />

        </div>

      ) : null}

      {showTheRoom ? (
        <div className="absolute inset-0 z-[1]">
          <TheRoomExperience />
        </div>
      ) : null}

      {showOpenField ? (
        <div className="absolute inset-0 z-[1]">
          <OpenFieldExperience />
        </div>
      ) : null}



      <motion.div

        className={`pointer-events-none absolute z-[6] rounded-full bg-black ${circleHidden ? 'invisible opacity-0' : 'opacity-100'}`}

        style={{

          left: cx,

          top: cy,

          width: origin.width,

          height: origin.height,

        }}

        initial={{ scale: 1, x: '-50%', y: '-50%' }}

        animate={{ scale: circleScale, x: '-50%', y: '-50%' }}

        transition={{ duration: EXPAND_MS, ease: EASE }}

        onAnimationComplete={() => {
          if (phase === 'exiting') {
            onClose();
            return;
          }
          if (phase !== 'entering' || expandDone.current) return;
          expandDone.current = true;
          setSceneReady(true);
          if (assistIndex >= 0 && assistIndex <= 4) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => setPhase('open'));
            });
          } else {
            setPhase('open');
          }
        }}

      />



      <motion.div

        className="pointer-events-none absolute inset-0 z-10 flex flex-col"

        initial={{ opacity: 0 }}

        animate={{ opacity: phase === 'exiting' ? 0 : phase === 'open' ? 1 : 0 }}

        transition={{
          delay: phase === 'open' ? 0 : phase === 'entering' ? EXPAND_MS * 0.45 : 0,
          duration: phase === 'exiting' ? 0.12 : 0.25,
        }}

      >

        <div
          className={`pointer-events-none flex shrink-0 gap-4 px-[clamp(1rem,4vw,2.5rem)] pt-[clamp(1.25rem,4vh,2.5rem)] sm:gap-6 ${
            (assistIndex === 0 || assistIndex === 1) && phase === 'open'
              ? 'flex-col sm:flex-row sm:items-start sm:justify-between'
              : 'justify-end'
          }`}
        >
          {assistIndex === 0 && phase === 'open' ? (
            <p className="pointer-events-auto max-w-lg font-sans text-[11px] font-light leading-relaxed text-white/75 sm:text-xs md:max-w-xl md:text-sm">
              A drop-in, full-viewport 3D koi pond for Next.js and React Three Fiber:
              dark shader water, rain ripples, and a configurable school of animated koi.
              Built for landing pages, hero sections, and portfolio sites where you want
              calm motion without a heavy video file.
              <br />
              <a
                href={BLACK_WATER_KOI_GUMROAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-sans font-normal text-white underline decoration-white/35 underline-offset-[3px] transition hover:decoration-white/80"
              >
                Get Black Water Koi on Gumroad
              </a>
            </p>
          ) : null}

          {assistIndex === 1 && phase === 'open' ? (
            <p className="pointer-events-auto max-w-lg font-sans text-[11px] font-light leading-relaxed text-[#404040]/90 sm:text-xs md:max-w-xl md:text-sm">
              A drop-in, full-viewport moody shore for Next.js and React Three Fiber:
              shader rolling swells, tiled sand, soft sky, and optional looped wave audio
              with a mic toggle you can hide in config. Built for hero sections and
              landing pages without a heavy video file.
              <br />
              <a
                href={OCEAN_WAVES_GUMROAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-sans font-normal text-[#2a2a2a] underline decoration-[#525252]/45 underline-offset-[3px] transition hover:decoration-[#525252]/85"
              >
                Get Ocean Waves on Gumroad
              </a>
            </p>
          ) : null}

          <button
            type="button"
            onClick={requestClose}
            className={`pointer-events-auto shrink-0 self-end bg-transparent px-10 py-2.5 font-sans text-xs font-extralight uppercase tracking-[0.35em] transition focus:outline-none focus-visible:ring-1 sm:self-auto ${
              lightScene
                ? 'border border-[#525252] text-[#404040] hover:bg-black/[0.06] focus-visible:ring-[#525252]'
                : 'border border-white/90 text-white hover:bg-white/5 focus-visible:ring-white'
            }`}
          >
            close
          </button>
        </div>

        <div className="min-h-0 flex-1" />

      </motion.div>

    </motion.div>

  );

}



type FocusState = {

  index: number;

  rect: ThumbnailRect;

};



export function AssistShowcaseRow() {

  const [focus, setFocus] = useState<FocusState | null>(null);



  const close = useCallback(() => setFocus(null), []);



  return (

    <>

      <section

        className="relative z-[2] -mt-5 flex min-h-dvh w-full items-center justify-center px-[clamp(1rem,4vw,2.5rem)] py-16"

        aria-label="Web assists"

      >

        <div className="pointer-events-auto relative z-[2] grid w-full max-w-5xl grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8 md:gap-12">

          {ASSIST_CAPTIONS.map((caption, i) => (

            <AssistThumbnail

              key={i}

              label={`Open assist preview ${i + 1}`}

              caption={caption}

              onSelect={(rect) => setFocus({ index: i, rect })}

            />

          ))}

        </div>

      </section>



      <AnimatePresence initial={false}>

        {focus ? (

          <AssistGrowingOverlay

            key={focus.index}

            assistIndex={focus.index}

            origin={focus.rect}

            onClose={close}

          />

        ) : null}

      </AnimatePresence>

    </>

  );

}

