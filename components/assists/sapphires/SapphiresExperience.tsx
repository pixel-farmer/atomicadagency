'use client';

import { motion } from 'framer-motion';
import { CanvasWrapper } from '@/components/canvas';
import { BACKGROUND_COLOR, SapphiresScene } from '@/components/assists/sapphires/SapphiresScene';

/** Title card. Edit freely; the tagline is a placeholder. */
const TITLE = 'Sapphire Crème';
const TAGLINE = 'Deeply hydrating';
/** Seconds before the title appears, timed to land as the camera settles. */
const TITLE_DELAY = 2.6;

export function SapphiresExperience() {
  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ backgroundColor: BACKGROUND_COLOR }}>
      <CanvasWrapper
        wrapperClassName="relative h-full w-full"
        canvasClassName="h-full w-full touch-none"
        cameraPosition={[0, 1.15, 6.2]}
        cameraFov={36}
        dpr={[1, 2]}
        transparent={false}
      >
        <SapphiresScene />
      </CanvasWrapper>

      {/* Fade up from black while the camera pushes in. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{ backgroundColor: BACKGROUND_COLOR }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center px-6 pb-[clamp(2rem,7vh,4.5rem)] text-center">
        <motion.h1
          className="font-sans text-[clamp(0.8rem,1.4vw,1.05rem)] font-extralight uppercase tracking-[0.55em] text-white/90"
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: TITLE_DELAY, duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {TITLE}
        </motion.h1>
        <motion.span
          aria-hidden
          className="mt-4 block h-px w-14 origin-center bg-white/40"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: TITLE_DELAY + 0.5, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.p
          className="mt-4 font-sans text-[0.65rem] font-extralight uppercase tracking-[0.4em] text-[#9db4ff]/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: TITLE_DELAY + 1, duration: 1.6 }}
        >
          {TAGLINE}
        </motion.p>
      </div>
    </div>
  );
}
