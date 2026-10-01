'use client';

import { useEffect, useRef } from 'react';

const CHARSET =
  " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZQdpPqao*b#MW&8%B@$";
const FG = '#ffffff';
const BG = '#bd5b5b';

export function AsciiWaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const cell = 12;
    const fontSize = 11;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w * 0.5;
      const cy = h * 0.5;

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      ctx.textBaseline = 'top';

      for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.hypot(dx, dy) + 1;
          const angle = Math.atan2(dy, dx);

          const swirl =
            Math.sin(angle * 3 + t * 0.9 + dist * 0.028) *
            Math.cos(angle * 2 - t * 0.55 + 12 / dist);

          const ripple = Math.sin(dist * 0.06 - t * 2.2) * 0.35;
          const field = swirl + ripple;

          if (field < 0.08) continue;

          const norm = Math.min(1, (field + 1) * 0.5);
          const idx = Math.floor(norm * (CHARSET.length - 1));
          const ch = CHARSET[idx] ?? '.';

          ctx.fillStyle = FG;
          ctx.globalAlpha = 0.18 + norm * 0.72;
          ctx.fillText(ch, x, y);
        }
      }

      ctx.globalAlpha = 1;

      if (!reducedMotion) {
        t += 0.014;
        raf = requestAnimationFrame(draw);
      }
    };

    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      if (!reducedMotion && !raf) {
        raf = requestAnimationFrame(draw);
      }
    };

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener('change', onMotionChange);

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
