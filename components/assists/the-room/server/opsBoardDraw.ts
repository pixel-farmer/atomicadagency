import {
  BUCKET_SECONDS,
  TRENDING_WIKIS,
  TRENDING_WINDOW_MINUTES,
  WINDOW_MINUTES,
  type Insights,
} from '@/components/assists/the-room/server/wikiInsights';
import type { FeedSource } from '@/components/assists/the-room/server/wikiFeed';

/**
 * Draws the operations board onto a 2D canvas (BOARD_PX). Kept free of three.js so the layout can
 * be previewed on its own. Five panels: headline numbers, trending pages, activity over time,
 * largest edits, and edits by language.
 */
export const BOARD_PX = { width: 2048, height: 896 } as const;

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const INK = '#e9e8e2';
const DIM = 'rgba(233,232,226,.55)';
const FAINT = 'rgba(233,232,226,.14)';
const AMBER = '#f29a1f';
const LIVE = '#7fd59a';
const BG = '#0b0c0d';

const W = BOARD_PX.width;
const H = BOARD_PX.height;
const PAD = 40;

type Ctx = CanvasRenderingContext2D;

function text(g: Ctx, s: string, x: number, y: number, size: number, color: string, opts: { weight?: number; align?: CanvasTextAlign; spacing?: number } = {}) {
  g.font = `${opts.weight ?? 400} ${size}px ${MONO}`;
  g.fillStyle = color;
  g.textAlign = opts.align ?? 'left';
  if (opts.spacing) {
    // Letter-spaced labels, drawn a character at a time.
    const chars = [...s];
    const total = chars.reduce((w, c) => w + g.measureText(c).width + opts.spacing!, -opts.spacing!);
    let cx = opts.align === 'right' ? x - total : opts.align === 'center' ? x - total / 2 : x;
    g.textAlign = 'left';
    for (const c of chars) {
      g.fillText(c, cx, y);
      cx += g.measureText(c).width + opts.spacing;
    }
    return;
  }
  g.fillText(s, x, y);
}

/** Cuts a string to fit `max` pixels, ending in an ellipsis. */
function fit(g: Ctx, s: string, max: number) {
  if (g.measureText(s).width <= max) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (g.measureText(`${s.slice(0, mid)}…`).width <= max) lo = mid;
    else hi = mid - 1;
  }
  return `${s.slice(0, lo).trimEnd()}…`;
}

function label(g: Ctx, s: string, x: number, y: number, align: CanvasTextAlign = 'left') {
  text(g, s.toUpperCase(), x, y, 19, AMBER, { weight: 600, spacing: 3, align });
}

function rule(g: Ctx, x: number, y: number, w: number) {
  g.fillStyle = FAINT;
  g.fillRect(x, y, w, 1);
}

const number = (n: number) => Math.round(n).toLocaleString('en-US');
const bytes = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('en-US')}`;
function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
}
function clock(t: number) {
  return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

export function drawOpsBoard(g: Ctx, d: Insights, source: FeedSource, now: number) {
  g.textBaseline = 'alphabetic';
  g.fillStyle = BG;
  g.fillRect(0, 0, W, H);

  /* Header */
  label(g, 'Operations board · Wikipedia recent changes', PAD, 54);
  const dot = source === 'live' ? LIVE : source === 'sample' ? AMBER : DIM;
  const status = source === 'live' ? 'LIVE' : source === 'sample' ? 'SAMPLE FEED' : 'CONNECTING';
  text(g, clock(now), W - PAD, 54, 24, INK, { align: 'right' });
  g.font = `400 24px ${MONO}`;
  const clockW = g.measureText(clock(now)).width;
  text(g, status, W - PAD - clockW - 36, 54, 19, dot, { weight: 600, spacing: 3, align: 'right' });
  g.font = `600 19px ${MONO}`;
  const statusW = [...status].reduce((w, c) => w + g.measureText(c).width + 3, -3);
  g.fillStyle = dot;
  g.beginPath();
  g.arc(W - PAD - clockW - 36 - statusW - 18, 47, 7, 0, Math.PI * 2);
  g.fill();
  rule(g, PAD, 78, W - PAD * 2);

  /* Headline numbers */
  const stats: [string, string, string][] = [
    ['Edits per second', d.perSecond.toFixed(1), 'last minute, all wikis'],
    ['New articles', number(d.newArticles), `last ${WINDOW_MINUTES} min`],
    ['Edits by bots', `${Math.round(d.botShare * 100)}%`, `last ${WINDOW_MINUTES} min`],
    ['Wikis active', number(d.activeWikis), `last ${WINDOW_MINUTES} min`],
  ];
  const statW = (W - PAD * 2 - 3 * 24) / 4;
  stats.forEach(([name, value, note], i) => {
    const x = PAD + i * (statW + 24);
    text(g, name.toUpperCase(), x, 122, 18, DIM, { spacing: 2 });
    text(g, value, x, 196, 64, INK, { weight: 500 });
    text(g, note, x, 228, 18, DIM);
  });
  rule(g, PAD, 252, W - PAD * 2);

  const top = 300;
  const bottom = H - 50;

  /* Trending */
  const tx = PAD;
  const tw = 960;
  label(g, `Trending · ${TRENDING_WIKIS.length === 1 && TRENDING_WIKIS[0] === 'enwiki' ? 'English Wikipedia' : 'Wikipedia'}`, tx, top);
  text(g, `most-edited pages, last ${TRENDING_WINDOW_MINUTES} min`, tx + tw, top, 18, DIM, { align: 'right' });
  if (!d.trending.length) {
    text(g, 'Watching for pages that several people are editing.', tx, top + 70, 26, DIM);
    text(g, 'Busy pages usually appear within a few minutes.', tx, top + 110, 22, DIM);
  }
  const maxEdits = d.trending[0]?.edits ?? 1;
  d.trending.forEach((p, i) => {
    const y = top + 62 + i * 72;
    text(g, String(i + 1).padStart(2, ' '), tx, y, 26, DIM);
    g.font = `500 32px ${MONO}`;
    text(g, fit(g, p.title, tw - 300), tx + 60, y, 32, INK, { weight: 500 });
    text(g, `${p.edits} edits`, tx + tw, y, 28, INK, { align: 'right' });
    text(g, `${p.editors} people`, tx + tw, y + 28, 18, DIM, { align: 'right' });
    // Bar: share of the busiest page's edits.
    g.fillStyle = FAINT;
    g.fillRect(tx + 60, y + 18, tw - 300, 6);
    g.fillStyle = i === 0 ? AMBER : INK;
    g.fillRect(tx + 60, y + 18, ((tw - 300) * p.edits) / maxEdits, 6);
  });

  /* Activity over time */
  const ax = PAD + tw + 60;
  const aw = 560;
  label(g, 'Activity', ax, top);
  text(g, 'edits / min', ax + aw, top, 18, DIM, { align: 'right' });
  const chartTop = top + 40;
  const chartH = 190;
  const rates = d.activity.map((b) => (b.humans + b.bots) * (60 / BUCKET_SECONDS));
  const peak = Math.max(60, ...rates);
  const scale = Math.pow(10, Math.floor(Math.log10(peak)));
  const ceiling = Math.ceil(peak / scale) * scale;
  for (const f of [0, 0.5, 1]) {
    const y = chartTop + chartH - f * chartH;
    rule(g, ax, y, aw);
    if (f > 0) text(g, number(ceiling * f), ax, y - 6, 16, DIM);
  }
  const n = d.activity.length || 1;
  const slot = aw / n;
  d.activity.forEach((b, i) => {
    const x = ax + i * slot + 2;
    const hH = (b.humans * (60 / BUCKET_SECONDS) / ceiling) * chartH;
    const bH = (b.bots * (60 / BUCKET_SECONDS) / ceiling) * chartH;
    const base = chartTop + chartH;
    g.fillStyle = INK;
    g.fillRect(x, base - hH, slot - 4, hH);
    g.fillStyle = AMBER;
    g.fillRect(x, base - hH - bH, slot - 4, bH);
  });
  const watched = Math.round(d.watchedSeconds / 60);
  text(g, d.watchedSeconds >= WINDOW_MINUTES * 60 ? `−${WINDOW_MINUTES} min` : `watching ${watched < 1 ? '<1' : watched} min`, ax, chartTop + chartH + 28, 16, DIM);
  text(g, 'now', ax + aw, chartTop + chartH + 28, 16, DIM, { align: 'right' });
  const legend = ax + aw / 2 - 70;
  g.fillStyle = INK;
  g.fillRect(legend, chartTop + chartH + 17, 12, 12);
  text(g, 'people', legend + 20, chartTop + chartH + 28, 16, DIM);
  g.fillStyle = AMBER;
  g.fillRect(legend + 110, chartTop + chartH + 17, 12, 12);
  text(g, 'bots', legend + 130, chartTop + chartH + 28, 16, DIM);

  /* Largest edits */
  const ly = chartTop + chartH + 88;
  label(g, 'Largest edits', ax, ly);
  text(g, 'bytes', ax + aw, ly, 18, DIM, { align: 'right' });
  d.largest.forEach((e, i) => {
    const y = ly + 44 + i * 44;
    if (y > bottom) return;
    text(g, bytes(e.delta), ax + 170, y, 26, e.delta >= 0 ? INK : AMBER, { align: 'right', weight: 500 });
    const tags = [e.isNew ? 'new page' : '', e.bot ? 'bot' : '', ago(now - e.at)].filter(Boolean).join(' · ');
    g.font = `400 16px ${MONO}`;
    const tagsW = g.measureText(tags).width;
    text(g, tags, ax + aw, y, 16, DIM, { align: 'right' });
    g.font = `400 22px ${MONO}`;
    text(g, fit(g, e.name, aw - 196 - tagsW - 20), ax + 196, y, 22, INK);
  });

  /* By language */
  const bx = ax + aw + 60;
  const bw = W - PAD - bx;
  label(g, 'By language', bx, top);
  text(g, 'Wikipedia', bx + bw, top, 18, DIM, { align: 'right' });
  const maxLang = d.languages[0]?.edits ?? 1;
  d.languages.forEach((l, i) => {
    const y = top + 56 + i * 60;
    g.font = `400 24px ${MONO}`;
    text(g, fit(g, l.language, bw - 90), bx, y, 24, INK);
    text(g, number(l.edits), bx + bw, y, 22, DIM, { align: 'right' });
    g.fillStyle = FAINT;
    g.fillRect(bx, y + 14, bw, 6);
    g.fillStyle = i === 0 ? AMBER : INK;
    g.fillRect(bx, y + 14, (bw * l.edits) / maxLang, 6);
  });

  /* Footer */
  rule(g, PAD, H - 40, W - PAD * 2);
  text(
    g,
    `Titles appear once ${'at least two people'} have edited a page, and pass a language filter. Bot edits don't count toward trending.`,
    PAD,
    H - 14,
    16,
    DIM,
  );

  // Scanlines, faint enough to keep text crisp.
  g.fillStyle = 'rgba(0,0,0,.16)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
}
