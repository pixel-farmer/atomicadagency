import type * as THREE from 'three';
import {
  ALERT_BYTES,
  ALERT_COOLDOWN_SECONDS,
  ALERT_SECONDS,
  PALETTE,
  SCREEN_PX,
} from '@/components/assists/the-room/server/serverRoomConfig';
import { hudAlert } from '@/components/assists/the-room/server/serverStore';
import { canvasTexture, MONO_FONT, type CanvasTex } from '@/components/assists/the-room/server/serverTextures';
import { feedStats, wikiLabel, type EditEvent } from '@/components/assists/the-room/server/wikiFeed';

/* ------------------------------------------------------------------------------------------ */
/* Shared state the screens read. The driver feeds it one edit at a time.                      */
/* ------------------------------------------------------------------------------------------ */

type LogLine = { text: string; bot: boolean };
type Ping = { lon: number; lat: number; life: number; bot: boolean };

export const display = {
  log: [] as LogLine[],
  paper: [] as string[],
  /** Bumps whenever the printer has a new line. */
  paperVersion: 0,
  deltas: [] as number[],
  pings: [] as Ping[],
  /** 0..3, rises with each edit and drains over time. Drives the operator's jumping. */
  spike: 0,
  /** Sheets on the printer's pile. */
  sheets: 0,
  linesPrinted: 0,
  /** performance.now() when the red alert ends, 0 when it's off. */
  alertUntil: 0,
  lastAlert: -Infinity,
};

/** Clears the room's history, e.g. when a visitor comes back to the scene. */
export function resetDisplay() {
  display.log.length = 0;
  display.paper.length = 0;
  display.deltas.length = 0;
  display.pings.length = 0;
  display.paperVersion++;
  display.spike = 0;
  display.sheets = 0;
  display.linesPrinted = 0;
  display.alertUntil = 0;
  hudAlert.set(null);
}

const LINES_PER_SHEET = 30;
export const MAX_SHEETS = 26;

function formatBytes(delta: number) {
  return (delta >= 0 ? '+' : '−') + Math.abs(delta).toLocaleString('en-US');
}

/** Turns one edit into blinks, log lines and printer paper. */
export function ingest(ev: EditEvent, now: number) {
  const panel = leds[Math.floor(Math.random() * leds.length)];
  if (panel) {
    const cell = Math.floor(Math.random() * panel.values.length);
    panel.values[cell] = 1;
    panel.bot[cell] = ev.bot ? 1 : 0;
  }

  const text = `${wikiLabel(ev.wiki).padEnd(8)} ${ev.isNew ? 'NEW ' : 'EDIT'} ${formatBytes(ev.delta).padStart(7)}`;
  display.log.push({ text, bot: ev.bot });
  if (display.log.length > 14) display.log.shift();
  display.paper.push(text);
  if (display.paper.length > 16) display.paper.shift();
  display.paperVersion++;

  display.deltas.push(ev.delta);
  if (display.deltas.length > 120) display.deltas.shift();
  display.spike = Math.min(display.spike + 0.12, 3);
  display.pings.push({ lon: Math.random() * Math.PI * 2, lat: (Math.random() - 0.5) * 2.4, life: 1, bot: ev.bot });
  if (display.pings.length > 60) display.pings.shift();

  if (++display.linesPrinted % LINES_PER_SHEET === 0) display.sheets = Math.min(display.sheets + 1, MAX_SHEETS);

  if (Math.abs(ev.delta) >= ALERT_BYTES && now - display.lastAlert > ALERT_COOLDOWN_SECONDS * 1000) {
    display.lastAlert = now;
    display.alertUntil = now + ALERT_SECONDS * 1000;
    hudAlert.set(`Large edit detected · ${wikiLabel(ev.wiki)} ${formatBytes(ev.delta)} bytes`);
  }
}

/** Per-frame easing that doesn't depend on new edits. */
export function settle(dt: number, now: number) {
  display.spike = Math.max(0, display.spike - dt * 1.4);
  for (const p of display.pings) p.life = Math.max(0, p.life - dt * 0.6);
  if (display.alertUntil && now > display.alertUntil) {
    display.alertUntil = 0;
    hudAlert.set(null);
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Registries. Machines add their canvases on mount; the driver redraws them.                  */
/* ------------------------------------------------------------------------------------------ */

export type ScreenEntry = CanvasTex & { program: number };
export type LedPanel = CanvasTex & { values: Float32Array; bot: Uint8Array };

export const screens: ScreenEntry[] = [];
export const leds: LedPanel[] = [];
export const machineObjects = new Map<string, THREE.Object3D>();

function addTo<T>(list: T[], item: T) {
  list.push(item);
  return () => {
    const i = list.indexOf(item);
    if (i >= 0) list.splice(i, 1);
  };
}
export const registerScreen = (entry: ScreenEntry) => addTo(screens, entry);
export const registerLed = (panel: LedPanel) => addTo(leds, panel);
export function registerMachine(id: string, object: THREE.Object3D) {
  machineObjects.set(id, object);
  return () => {
    if (machineObjects.get(id) === object) machineObjects.delete(id);
  };
}

const LED_COLS = 24;
const LED_ROWS = 5;

export function createLedPanel(): LedPanel {
  return {
    ...canvasTexture(192, 48),
    values: new Float32Array(LED_COLS * LED_ROWS),
    bot: new Uint8Array(LED_COLS * LED_ROWS),
  };
}

export function createScreen(program: number): ScreenEntry {
  return { ...canvasTexture(SCREEN_PX.width, SCREEN_PX.height), program };
}

/* ------------------------------------------------------------------------------------------ */
/* Drawing                                                                                     */
/* ------------------------------------------------------------------------------------------ */

const W = SCREEN_PX.width;
const H = SCREEN_PX.height;
const INK = PALETTE.ink;
const AMBER = PALETTE.amber;
const DIM = 'rgba(233,232,226,.6)';

let crtOverlay: HTMLCanvasElement | null = null;
function getCrtOverlay() {
  if (crtOverlay) return crtOverlay;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = 'rgba(0,0,0,.28)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    const vignette = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = vignette;
    g.fillRect(0, 0, W, H);
  }
  crtOverlay = c;
  return c;
}

/** The operator sprite. X is a pixel, the two eye pixels are drawn amber. */
const OPERATOR = ['..XXXXXX..', '.XXXXXXXX.', 'XX..XX..XX', 'XXXXXXXXXX', 'XXX.XX.XXX', 'XXXX..XXXX', '.XXXXXXXX.', 'X.X....X.X'];

function heading(g: CanvasRenderingContext2D, text: string) {
  g.fillStyle = 'rgba(233,232,226,.55)';
  g.font = `500 11px ${MONO_FONT}`;
  g.textAlign = 'left';
  g.fillText(text, 14, 22);
}

export function drawScreen(screen: ScreenEntry, t: number) {
  const g = screen.ctx;
  const stats = feedStats.get();
  g.fillStyle = '#0b0c0d';
  g.fillRect(0, 0, W, H);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.lineWidth = 2;
  const flicker = 0.92 + Math.random() * 0.08;
  g.globalAlpha = flicker;

  switch (screen.program) {
    case 0: {
      heading(g, 'EDITS / LANGUAGE · 60s');
      const max = stats.top[0]?.[1] ?? 1;
      stats.top.forEach(([wiki, count], i) => {
        const y = 42 + i * 25;
        g.fillStyle = INK;
        g.font = `500 12px ${MONO_FONT}`;
        g.fillText(wikiLabel(wiki).slice(0, 8), 14, y + 12);
        g.fillStyle = i === 0 ? AMBER : INK;
        g.fillRect(92, y + 2, Math.max(3, (count / max) * 130), 12);
        g.fillStyle = DIM;
        g.font = `11px ${MONO_FONT}`;
        g.fillText(String(count), 228, y + 12);
      });
      break;
    }
    case 1: {
      heading(g, 'TTY0 · RECENT CHANGES');
      g.font = `12px ${MONO_FONT}`;
      const lines = display.log.slice(-10);
      lines.forEach((line, i) => {
        g.fillStyle = line.bot ? AMBER : INK;
        g.fillText(line.text, 14, 44 + i * 15);
      });
      if (Math.floor(t * 2) % 2) {
        g.fillStyle = INK;
        g.fillRect(14, 44 + lines.length * 15 - 10, 8, 12);
      }
      break;
    }
    case 2: {
      heading(g, 'OPERATOR ON DUTY');
      const px = 9;
      const width = OPERATOR[0].length * px;
      const hop = Math.abs(Math.sin(t * 3.2)) * (18 + display.spike * 14);
      const x0 = W / 2 - width / 2 + Math.sin(t * 0.9) * 40;
      const y0 = 112 - hop;
      g.fillStyle = 'rgba(233,232,226,.18)';
      g.beginPath();
      g.ellipse(x0 + width / 2, 176, Math.max(6, 40 - hop * 0.4), 5, 0, 0, Math.PI * 2);
      g.fill();
      OPERATOR.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          if (row[c] !== 'X') continue;
          g.fillStyle = r === 2 && (c === 2 || c === 7) ? AMBER : INK;
          g.fillRect(x0 + c * px, y0 + r * px, px - 1, px - 1);
        }
      });
      if (display.spike > 1.6) {
        g.fillStyle = AMBER;
        g.font = `600 13px ${MONO_FONT}`;
        g.textAlign = 'center';
        g.fillText('BUSY!', W / 2, 46);
      }
      break;
    }
    case 3: {
      heading(g, 'BYTE SCOPE · Δ PER EDIT');
      const cy = 112;
      g.strokeStyle = 'rgba(233,232,226,.15)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(10, cy);
      g.lineTo(W - 10, cy);
      for (let x = 10; x < W; x += 30) {
        g.moveTo(x, 36);
        g.lineTo(x, 186);
      }
      g.stroke();
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.beginPath();
      display.deltas.forEach((d, i) => {
        const x = 10 + i * ((W - 20) / 119);
        const y = cy - Math.sign(d) * Math.log10(1 + Math.abs(d)) * 15;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      });
      g.stroke();
      break;
    }
    case 4: {
      heading(g, 'EDITS SINCE YOU ARRIVED');
      g.textAlign = 'center';
      g.fillStyle = INK;
      g.font = `600 42px ${MONO_FONT}`;
      g.fillText(stats.total.toLocaleString('en-US'), W / 2, 112);
      g.font = `12px ${MONO_FONT}`;
      g.fillStyle = AMBER;
      g.fillText(`${(stats.rate / 60).toFixed(1)} EDITS / SEC`, W / 2, 150);
      break;
    }
    case 5: {
      heading(g, 'GLOBAL ACTIVITY');
      const cx = W / 2;
      const cy = 112;
      const r = 68;
      const spin = t * 0.5;
      g.strokeStyle = 'rgba(233,232,226,.5)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      for (let k = 0; k < 6; k++) {
        const a = spin + (k * Math.PI) / 6;
        g.beginPath();
        g.ellipse(cx, cy, Math.abs(Math.cos(a)) * r, r, 0, 0, Math.PI * 2);
        g.stroke();
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const la = (lat * Math.PI) / 180;
        const y = cy + r * Math.sin(la);
        const half = r * Math.cos(la);
        g.beginPath();
        g.moveTo(cx - half, y);
        g.lineTo(cx + half, y);
        g.stroke();
      }
      for (const p of display.pings) {
        const a = p.lon + spin;
        if (Math.cos(a) < 0) continue;
        g.globalAlpha = p.life * flicker;
        g.fillStyle = p.bot ? AMBER : INK;
        g.beginPath();
        g.arc(cx + r * Math.cos(p.lat * 0.6) * Math.sin(a), cy + r * Math.sin(p.lat * 0.6), 2 + (1 - p.life) * 5, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = flicker;
      break;
    }
    default: {
      heading(g, 'WHO IS EDITING');
      const bot = stats.botShare;
      const human = 1 - bot;
      g.font = `600 34px ${MONO_FONT}`;
      g.fillStyle = INK;
      g.fillText(`${Math.round(human * 100)}%`, 14, 92);
      g.fillStyle = AMBER;
      g.textAlign = 'right';
      g.fillText(`${Math.round(bot * 100)}%`, W - 14, 92);
      g.font = `11px ${MONO_FONT}`;
      g.fillStyle = DIM;
      g.fillText('BOTS', W - 14, 110);
      g.textAlign = 'left';
      g.fillText('HUMANS', 14, 110);
      g.fillStyle = INK;
      g.fillRect(14, 128, (W - 28) * human, 18);
      g.fillStyle = AMBER;
      g.fillRect(14 + (W - 28) * human, 128, (W - 28) * bot, 18);
    }
  }

  g.globalAlpha = 1;
  g.drawImage(getCrtOverlay(), 0, 0);
  screen.texture.needsUpdate = true;
}

export function drawLedPanel(panel: LedPanel) {
  const g = panel.ctx;
  g.fillStyle = '#0a0a0b';
  g.fillRect(0, 0, 192, 48);
  for (let i = 0; i < panel.values.length; i++) {
    const v = panel.values[i];
    const x = 4 + (i % LED_COLS) * 8;
    const y = 5 + Math.floor(i / LED_COLS) * 9;
    if (v > 0.04) {
      g.fillStyle = panel.bot[i] ? `rgba(242,154,31,${v})` : `rgba(240,240,232,${v})`;
      panel.values[i] *= 0.93;
    } else {
      g.fillStyle = '#242527';
      // An occasional idle twinkle keeps quiet panels alive.
      panel.values[i] = Math.random() < 0.0015 ? 0.5 : 0;
    }
    g.beginPath();
    g.arc(x, y, 2.6, 0, Math.PI * 2);
    g.fill();
  }
  panel.texture.needsUpdate = true;
}

/** Green-bar printer paper, scrolling upward as lines arrive. */
export function drawPaper(paper: CanvasTex, scroll: number) {
  const g = paper.ctx;
  const { width: w, height: h } = paper.canvas;
  g.fillStyle = '#ecebe5';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(120,170,130,.18)';
  for (let y = -28; y < h; y += 28) g.fillRect(14, y + (scroll % 28), w - 28, 14);
  g.fillStyle = '#b9b8b2';
  for (let y = 0; y < h; y += 14) {
    for (const x of [6, w - 6]) {
      g.beginPath();
      g.arc(x, y + (scroll % 14), 2.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = '#2d2d2d';
  g.font = `11px ${MONO_FONT}`;
  g.textAlign = 'left';
  const lines = display.paper.slice(-13);
  lines.forEach((line, i) => g.fillText(line.slice(0, 22), 16, h - (lines.length - i) * 14 + 8));
  paper.texture.needsUpdate = true;
}
