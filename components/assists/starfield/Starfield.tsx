"use client";

/**
 * Starfield.tsx — a Skyfield-style sky simulator for React + Next.js (App Router)
 *
 * Does what Skyfield's `boston.at(t).observe(star).apparent().altaz()` does, in
 * simplified form: RA/Dec -> hour angle (via sidereal time) -> altitude/azimuth
 * for an observer at a given latitude/longitude and time. Precession, nutation
 * and aberration are left out, so positions are good to roughly a degree.
 *
 * Usage:  app/page.tsx
 *   import Starfield from "./Starfield";
 *   export default function Page() { return <Starfield />; }
 *
 * No dependencies beyond react / next.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ----------------------------- Star catalogue ----------------------------- */

type Star = { name?: string; ra: number; dec: number; mag: number; tint: number };

// [name, RA (hours), Dec (degrees), apparent magnitude]
const BRIGHT: [string, number, number, number][] = [
  ["Sirius", 6.752, -16.716, -1.46],
  ["Canopus", 6.399, -52.696, -0.74],
  ["Arcturus", 14.261, 19.182, -0.05],
  ["Rigil Kentaurus", 14.66, -60.834, -0.01],
  ["Vega", 18.616, 38.784, 0.03],
  ["Capella", 5.278, 45.998, 0.08],
  ["Rigel", 5.242, -8.202, 0.13],
  ["Procyon", 7.655, 5.225, 0.34],
  ["Achernar", 1.629, -57.237, 0.46],
  ["Betelgeuse", 5.919, 7.407, 0.5],
  ["Hadar", 14.064, -60.373, 0.61],
  ["Altair", 19.846, 8.868, 0.76],
  ["Acrux", 12.443, -63.099, 0.76],
  ["Aldebaran", 4.599, 16.509, 0.85],
  ["Antares", 16.49, -26.432, 0.96],
  ["Spica", 13.42, -11.161, 0.97],
  ["Pollux", 7.755, 28.026, 1.14],
  ["Fomalhaut", 22.961, -29.622, 1.16],
  ["Deneb", 20.69, 45.28, 1.25],
  ["Mimosa", 12.795, -59.689, 1.25],
  ["Regulus", 10.14, 11.967, 1.35],
  ["Adhara", 6.977, -28.972, 1.5],
  ["Castor", 7.577, 31.888, 1.58],
  ["Gacrux", 12.519, -57.113, 1.64],
  ["Shaula", 17.56, -37.104, 1.62],
  ["Bellatrix", 5.419, 6.35, 1.64],
  ["Elnath", 5.438, 28.608, 1.65],
  ["Miaplacidus", 9.22, -69.717, 1.67],
  ["Alnilam", 5.604, -1.202, 1.69],
  ["Alnitak", 5.679, -1.943, 1.74],
  ["Alioth", 12.9, 55.96, 1.76],
  ["Mirfak", 3.405, 49.861, 1.79],
  ["Dubhe", 11.062, 61.751, 1.79],
  ["Wezen", 7.14, -26.393, 1.83],
  ["Kaus Australis", 18.403, -34.385, 1.85],
  ["Alkaid", 13.792, 49.313, 1.86],
  ["Polaris", 2.53, 89.264, 1.98],
  ["Mizar", 13.399, 54.925, 2.04],
  ["Mintaka", 5.533, -0.299, 2.23],
  ["Saiph", 5.796, -9.67, 2.06],
  ["Hamal", 2.12, 23.462, 2.0],
  ["Alpheratz", 0.14, 29.091, 2.06],
  ["Mirach", 1.162, 35.621, 2.05],
  ["Schedar", 0.675, 56.537, 2.24],
  ["Caph", 0.153, 59.15, 2.27],
  ["Navi", 0.945, 60.717, 2.47],
  ["Ruchbah", 1.43, 60.235, 2.68],
  ["Merak", 11.031, 56.382, 2.37],
  ["Phecda", 11.897, 53.695, 2.44],
  ["Megrez", 12.257, 57.033, 3.31],
];

const LINES: [string, string][] = [
  // Orion
  ["Betelgeuse", "Bellatrix"],
  ["Betelgeuse", "Alnitak"],
  ["Bellatrix", "Mintaka"],
  ["Alnitak", "Alnilam"],
  ["Alnilam", "Mintaka"],
  ["Alnitak", "Saiph"],
  ["Mintaka", "Rigel"],
  // Big Dipper
  ["Dubhe", "Merak"],
  ["Merak", "Phecda"],
  ["Phecda", "Megrez"],
  ["Megrez", "Dubhe"],
  ["Megrez", "Alioth"],
  ["Alioth", "Mizar"],
  ["Mizar", "Alkaid"],
  // Cassiopeia
  ["Caph", "Schedar"],
  ["Schedar", "Navi"],
  ["Navi", "Ruchbah"],
  // Summer Triangle
  ["Vega", "Deneb"],
  ["Deneb", "Altair"],
  ["Altair", "Vega"],
];

// Small seeded PRNG so server and client agree (no hydration mismatch).
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCatalogue(faintCount: number): Star[] {
  const rand = mulberry32(421);
  const stars: Star[] = BRIGHT.map(([name, ra, dec, mag]) => ({
    name,
    ra,
    dec,
    mag,
    tint: rand(),
  }));
  for (let i = 0; i < faintCount; i++) {
    // Uniform on the sphere; magnitudes skew faint like the real sky.
    const ra = rand() * 24;
    const dec = (Math.asin(2 * rand() - 1) * 180) / Math.PI;
    const mag = 2.6 + Math.pow(rand(), 0.55) * 3.9;
    stars.push({ ra, dec, mag, tint: rand() });
  }
  return stars;
}

/* ------------------------------ Astronomy math ----------------------------- */

const RAD = Math.PI / 180;

function julianDate(ms: number) {
  return ms / 86400000 + 2440587.5;
}

// Greenwich Mean Sidereal Time in degrees.
function gmstDeg(jd: number) {
  const d = jd - 2451545.0;
  return (((280.46061837 + 360.98564736629 * d) % 360) + 360) % 360;
}

// RA (hours) / Dec (deg) -> altitude / azimuth (deg, azimuth from north through east).
function altAz(raH: number, decDeg: number, latDeg: number, lstDeg: number) {
  const H = (lstDeg - raH * 15) * RAD;
  const dec = decDeg * RAD;
  const lat = latDeg * RAD;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(
    -Math.cos(dec) * Math.sin(H),
    Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H),
  );
  return { alt: alt / RAD, az: (((az / RAD) % 360) + 360) % 360 };
}

function fmtRA(h: number) {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = ((h - hh) * 60 - mm) * 60;
  return `${hh}h ${String(mm).padStart(2, "0")}m ${ss.toFixed(1).padStart(4, "0")}s`;
}
function fmtDeg(d: number) {
  const sign = d < 0 ? "−" : "+";
  const a = Math.abs(d);
  const dd = Math.floor(a);
  const mm = Math.floor((a - dd) * 60);
  return `${sign}${dd}° ${String(mm).padStart(2, "0")}′`;
}

/* -------------------------------- Component -------------------------------- */

type Projected = { star: Star; x: number; y: number; alt: number; az: number };

const SPEEDS = [
  { label: "Real time", value: 1 },
  { label: "1 min/s", value: 60 },
  { label: "10 min/s", value: 600 },
  { label: "1 hr/s", value: 3600 },
  { label: "6 hr/s", value: 21600 },
];

export type StarfieldLayout = "page" | "fullscreen";

export type StarfieldProps = {
  /** `fullscreen` fills the parent (showcase / hero); control panel floats on top. */
  layout?: StarfieldLayout;
};

export function Starfield({ layout = "page" }: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const stars = useMemo(() => buildCatalogue(2200), []);
  const byName = useMemo(() => {
    const m = new Map<string, Star>();
    stars.forEach((s) => s.name && m.set(s.name, s));
    return m;
  }, [stars]);

  // Observer + clock (defaults match the Boston example on the Skyfield page).
  const [lat, setLat] = useState(42.3583);
  const [lon, setLon] = useState(-71.0636);
  const [speed, setSpeed] = useState(600);
  const [playing, setPlaying] = useState(true);
  const [showLines, setShowLines] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [clockLabel, setClockLabel] = useState("");
  const [hover, setHover] = useState<Projected | null>(null);

  // Mutable sim state read by the animation loop (avoids re-render per frame).
  const sim = useRef({
    t: 0,
    lat,
    lon,
    speed,
    playing,
    showLines,
    showNames,
    projected: [] as Projected[],
    pointer: null as { x: number; y: number } | null,
    size: { w: 800, h: 800 },
    fullscreen: layout === "fullscreen",
  });
  sim.current.fullscreen = layout === "fullscreen";
  sim.current.lat = lat;
  sim.current.lon = lon;
  sim.current.speed = speed;
  sim.current.playing = playing;
  sim.current.showLines = showLines;
  sim.current.showNames = showNames;

  // Initialise the clock on the client only.
  useEffect(() => {
    sim.current.t = Date.now();
  }, []);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const s = sim.current;
      const { w, h } = s.size;
      const cx = w / 2;
      const cy = h / 2;
      const R = s.fullscreen
        ? Math.hypot(cx, cy) * 1.02
        : Math.max(40, Math.min(w, h) / 2 - 28);

      ctx.clearRect(0, 0, w, h);

      if (s.fullscreen) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, w, h);
      }

      // Sky dome
      const g = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R);
      g.addColorStop(0, "#31354a");
      g.addColorStop(0.7, "#1c1d26");
      g.addColorStop(1, "#111116");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Altitude rings every 30°
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(160,175,255,0.05)";
      ctx.lineWidth = 0.55;
      for (const alt of [30, 60]) {
        ctx.beginPath();
        ctx.arc(cx, cy, R * ((90 - alt) / 90), 0, Math.PI * 2);
        ctx.stroke();
      }
      // Horizon
      ctx.strokeStyle = "rgba(195,208,255,0.18)";
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // Cardinal directions. Looking up with north at top puts east on the left.
      ctx.fillStyle = "rgba(210,220,255,0.65)";
      ctx.font = "500 13px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("N", cx, cy - R - 14);
      ctx.fillText("S", cx, cy + R + 14);
      ctx.fillText("E", cx - R - 14, cy);
      ctx.fillText("W", cx + R + 14, cy);

      // Project every star
      const lst = gmstDeg(julianDate(s.t)) + s.lon;
      const projected: Projected[] = [];
      const lookup = new Map<Star, Projected>();
      for (const star of stars) {
        const { alt, az } = altAz(star.ra, star.dec, s.lat, lst);
        if (alt < 0) continue;
        const r = R * ((90 - alt) / 90);
        const azr = az * RAD;
        const p: Projected = {
          star,
          alt,
          az,
          x: cx - r * Math.sin(azr),
          y: cy - r * Math.cos(azr),
        };
        projected.push(p);
        lookup.set(star, p);
      }
      s.projected = projected;

      // Constellation lines
      if (s.showLines) {
        ctx.strokeStyle = "rgba(155,175,255,0.14)";
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        for (const [a, b] of LINES) {
          const sa = byName.get(a);
          const sb = byName.get(b);
          const pa = sa && lookup.get(sa);
          const pb = sb && lookup.get(sb);
          if (pa && pb) {
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
          }
        }
        ctx.stroke();
      }

      // Stars: fade near the horizon (atmospheric extinction), size by magnitude.
      for (const p of projected) {
        const { star, alt } = p;
        const extinction = Math.min(1, 0.25 + alt / 25);
        const size = Math.max(0.5, 2.9 - star.mag * 0.5) * (w < 500 ? 0.85 : 1);
        const alpha = Math.min(1, (1.15 - star.mag * 0.12) * extinction);
        const hue = star.tint < 0.25 ? 28 : star.tint > 0.7 ? 220 : 55;
        const sat = star.tint < 0.25 || star.tint > 0.7 ? 70 : 20;
        ctx.fillStyle = `hsla(${hue},${sat}%,92%,${alpha})`;
        if (star.mag < 1.5) {
          ctx.shadowColor = `hsla(${hue},${sat}%,85%,0.9)`;
          ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Names
      if (s.showNames) {
        ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "rgba(200,212,255,0.7)";
        for (const p of projected) {
          if (p.star.name && p.star.mag < 2.0 && p.alt > 4) {
            ctx.fillText(p.star.name, p.x + 8, p.y - 6);
          }
        }
      }

      // Hover ring
      if (s.pointer) {
        let best: Projected | null = null;
        let bestD = 14;
        for (const p of projected) {
          if (!p.star.name) continue;
          const d = Math.hypot(p.x - s.pointer.x, p.y - s.pointer.y);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
        if (best) {
          ctx.strokeStyle = "rgba(255,228,175,0.72)";
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.arc(best.x, best.y, 9, 0, Math.PI * 2);
          ctx.stroke();
        }
        setHover((prev) => (prev?.star === best?.star ? prev : best));
      } else {
        setHover((prev) => (prev ? null : prev));
      }
    },
    [stars, byName],
  );

  // Animation loop + resize handling
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      let w = wrap.clientWidth;
      let h = wrap.clientHeight;
      if ((!w || !h) && wrap.parentElement) {
        w = wrap.parentElement.clientWidth;
        h = wrap.parentElement.clientHeight;
      }
      if (sim.current.fullscreen) {
        w = Math.max(2, w || window.innerWidth);
        h = Math.max(2, h || window.innerHeight);
      } else {
        const side = Math.max(280, Math.min(w || 600, 820));
        w = side;
        h = side;
      }
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sim.current.size = { w, h };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = performance.now();
    let lastLabel = 0;
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame); // schedule first so one bad frame can't stop the loop
      const dt = now - last;
      last = now;
      const s = sim.current;
      if (!s.t) s.t = Date.now();
      if (s.playing && !reduce) s.t += dt * s.speed;
      try {
        draw(ctx);
      } catch (err) {
        console.error("Starfield draw error:", err);
      }
      if (now - lastLabel > 250) {
        lastLabel = now;
        setClockLabel(new Date(s.t).toUTCString().replace("GMT", "UTC"));
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [draw]);

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    sim.current.pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onLeave = () => {
    sim.current.pointer = null;
  };

  const resetToNow = () => {
    sim.current.t = Date.now();
  };

  const rootClass =
    layout === "fullscreen" ? "sf-root sf-root--fullscreen" : "sf-root";
  const layoutClass =
    layout === "fullscreen" ? "sf-layout sf-layout--fullscreen" : "sf-layout";
  const panelClass =
    layout === "fullscreen" ? "sf-panel sf-panel--overlay" : "sf-panel";

  return (
    <main className={rootClass}>
      <style>{css}</style>

      {layout === "page" ? (
        <header className="sf-head">
          <h1>Sky from your window</h1>
          <p>
            Stars placed with the same hour-angle → altitude/azimuth math Skyfield uses for
            topocentric positions. Hover a named star to read its coordinates.
          </p>
        </header>
      ) : null}

      <div className={layoutClass}>
        <div className="sf-stage" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            onPointerMove={onMove}
            onPointerLeave={onLeave}
            aria-label="Planisphere showing the visible night sky for the chosen place and time"
            role="img"
          />
        </div>

        <aside className={panelClass}>
          <div className="sf-clock" aria-live="off">
            {clockLabel || "…"}
          </div>

          <div className="sf-row">
            <button onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
            <button onClick={resetToNow}>Set to now</button>
          </div>

          <label className="sf-field">
            <span>Time speed</span>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              {SPEEDS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="sf-field">
            <span>Latitude: {lat.toFixed(2)}°</span>
            <input
              type="range"
              min={-90}
              max={90}
              step={0.01}
              value={lat}
              onChange={(e) => setLat(Number(e.target.value))}
            />
          </label>

          <label className="sf-field">
            <span>Longitude: {lon.toFixed(2)}°</span>
            <input
              type="range"
              min={-180}
              max={180}
              step={0.01}
              value={lon}
              onChange={(e) => setLon(Number(e.target.value))}
            />
          </label>

          <label className="sf-check">
            <input type="checkbox" checked={showLines} onChange={(e) => setShowLines(e.target.checked)} />
            Constellation lines
          </label>
          <label className="sf-check">
            <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} />
            Star names
          </label>

          <div className="sf-readout">
            {hover ? (
              <>
                <strong>{hover.star.name}</strong>
                <dl>
                  <dt>Magnitude</dt>
                  <dd>{hover.star.mag.toFixed(2)}</dd>
                  <dt>RA</dt>
                  <dd>{fmtRA(hover.star.ra)}</dd>
                  <dt>Dec</dt>
                  <dd>{fmtDeg(hover.star.dec)}</dd>
                  <dt>Altitude</dt>
                  <dd>{fmtDeg(hover.alt)}</dd>
                  <dt>Azimuth</dt>
                  <dd>{hover.az.toFixed(1)}°</dd>
                </dl>
              </>
            ) : (
              <span className="sf-muted">Point at a named star.</span>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

/* --------------------------------- Styles ---------------------------------- */

const css = `
.sf-root {
  min-height: 100vh;
  padding: 28px clamp(14px, 4vw, 48px) 48px;
  background: #03040c;
  color: #d6ddf5;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.sf-head h1 { margin: 0 0 6px; font-size: clamp(22px, 3.2vw, 32px); font-weight: 600; letter-spacing: -0.01em; }
.sf-head p { margin: 0 0 22px; max-width: 62ch; line-height: 1.55; color: #98a3c9; }
.sf-layout { display: flex; flex-wrap: wrap; gap: 28px; align-items: flex-start; }
.sf-stage { flex: 1 1 360px; min-width: 280px; min-height: 280px; display: flex; justify-content: center; }
.sf-stage canvas { display: block; max-width: 100%; touch-action: none; }
.sf-panel {
  flex: 0 0 280px; display: flex; flex-direction: column; gap: 14px;
  padding: 18px; border: 1px solid rgba(150,170,255,0.18); border-radius: 10px;
  background: rgba(12,16,40,0.6);
}
.sf-clock { font-variant-numeric: tabular-nums; font-size: 13px; color: #b9c4ee; min-height: 1.3em; }
.sf-row { display: flex; gap: 8px; }
.sf-panel button {
  flex: 1; padding: 8px 10px; border-radius: 6px; cursor: pointer;
  border: 1px solid rgba(150,170,255,0.35); background: rgba(40,52,110,0.45); color: inherit; font: inherit;
}
.sf-panel button:hover { background: rgba(60,76,150,0.6); }
.sf-panel :focus-visible { outline: 2px solid #ffe1a0; outline-offset: 2px; }
.sf-field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #aab5de; }
.sf-field select {
  padding: 7px 8px; border-radius: 6px; border: 1px solid rgba(150,170,255,0.35);
  background: #0b1030; color: inherit; font: inherit;
}
.sf-field input[type="range"] { width: 100%; accent-color: #ffe1a0; }
.sf-check { display: flex; gap: 8px; align-items: center; font-size: 14px; }
.sf-check input { accent-color: #ffe1a0; }
.sf-readout { min-height: 128px; padding-top: 12px; border-top: 1px solid rgba(150,170,255,0.15); font-size: 14px; }
.sf-readout strong { font-size: 16px; color: #ffe9bd; }
.sf-readout dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 14px; margin: 8px 0 0; font-variant-numeric: tabular-nums; }
.sf-readout dt { color: #8893bb; }
.sf-readout dd { margin: 0; }
.sf-muted { color: #7480a8; }
.sf-root--fullscreen {
  min-height: unset;
  height: 100%;
  width: 100%;
  padding: 0;
  position: relative;
  overflow: hidden;
}
.sf-layout--fullscreen {
  position: relative;
  width: 100%;
  height: 100%;
  display: block;
}
.sf-root--fullscreen .sf-stage {
  position: absolute;
  inset: 0;
  flex: none;
  min-width: 0;
  min-height: 0;
  display: block;
}
.sf-root--fullscreen .sf-stage canvas {
  width: 100% !important;
  height: 100% !important;
  max-width: none;
}
.sf-panel--overlay {
  position: absolute;
  top: clamp(4.75rem, 11vh, 6.25rem);
  right: clamp(1rem, 4vw, 2.5rem);
  z-index: 20;
  max-height: min(520px, calc(100% - 5.5rem));
  overflow-y: auto;
  pointer-events: auto;
  backdrop-filter: blur(8px);
}
`;

export default Starfield;
