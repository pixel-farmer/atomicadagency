'use client';



import { AnimatePresence, motion } from 'framer-motion';

import dynamic from 'next/dynamic';

import { useLenis } from 'lenis/react';
import { useCallback, useEffect, useRef, useState } from 'react';

void import('@/components/assists/black-water-koi').then(() => undefined);

const BlackWaterKoiExperience = dynamic(

  () =>

    import('@/components/assists/black-water-koi').then((m) => m.BlackWaterKoiExperience),

  { ssr: false },

);



const PLACEHOLDER_COUNT = 3;



const EXPAND_MS = 0.62;

const EASE = [0.32, 0.72, 0, 1] as const;



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

}: {

  onSelect: (rect: ThumbnailRect) => void;

  label: string;

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

  const [sceneReady, setSceneReady] = useState(false);
  const [hideCircle, setHideCircle] = useState(false);
  const expandDone = useRef(false);
  const lenis = useLenis();

  useEffect(() => {
    setSceneReady(false);
    setHideCircle(false);
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

      if (e.key === 'Escape') onClose();

    };

    window.addEventListener('keydown', onKey);

    return () => {

      document.body.style.overflow = prev;

      window.removeEventListener('keydown', onKey);

    };

  }, [onClose]);



  const showBlackWaterKoi = assistIndex === 0 && sceneReady;

  useEffect(() => {
    if (!sceneReady) return;

    if (assistIndex === 0) {
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setHideCircle(true));
      });
      return () => cancelAnimationFrame(id);
    }

    setHideCircle(true);
  }, [sceneReady, assistIndex]);

  return (

    <motion.div

      className={`fixed inset-0 z-[100] overflow-hidden ${sceneReady ? 'bg-black' : 'bg-transparent'}`}

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



      <motion.div

        className={`pointer-events-none absolute z-[6] rounded-full bg-black ${hideCircle ? 'invisible opacity-0' : 'opacity-100'}`}

        style={{

          left: cx,

          top: cy,

          width: origin.width,

          height: origin.height,

        }}

        initial={{ scale: 1, x: '-50%', y: '-50%' }}

        animate={{ scale: endScale, x: '-50%', y: '-50%' }}

        exit={{ scale: 1, x: '-50%', y: '-50%' }}

        transition={{ duration: EXPAND_MS, ease: EASE }}

        onAnimationComplete={() => {
          if (expandDone.current) return;
          expandDone.current = true;
          setSceneReady(true);
        }}

      />



      <motion.div

        className="pointer-events-none absolute inset-0 z-10 flex flex-col"

        initial={{ opacity: 0 }}

        animate={{ opacity: 1 }}

        exit={{ opacity: 0 }}

        transition={{ delay: EXPAND_MS * 0.45, duration: 0.25 }}

      >

        <div className="pointer-events-auto flex shrink-0 justify-center pt-[clamp(1.25rem,4vh,2.5rem)]">

          <button

            type="button"

            onClick={onClose}

            className="border border-white/90 bg-transparent px-10 py-2.5 font-sans text-xs font-extralight uppercase tracking-[0.35em] text-white transition hover:bg-white/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-white"

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

          {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (

            <AssistThumbnail

              key={i}

              label={`Open assist preview ${i + 1}`}

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

