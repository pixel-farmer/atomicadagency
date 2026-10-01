'use client';

import { motion } from 'framer-motion';

export function CanvasFallback() {
  return (
    <motion.div
      className="flex h-full min-h-[280px] w-full items-center justify-center rounded-lg bg-cream-dark/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      aria-hidden
    >
      <motion.div
        className="h-12 w-12 rounded-full border-2 border-surface/20 border-t-surface/70"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      />
      <span className="sr-only">Loading 3D scene</span>
    </motion.div>
  );
}
