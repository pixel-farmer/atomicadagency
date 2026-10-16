import { createStore } from '@/components/assists/the-room/server/serverStore';
import { isTitleSafe } from '@/components/assists/the-room/server/titleFilter';
import {
  feedListeners,
  wikiName,
  wikipediaLanguage,
  type EditEvent,
} from '@/components/assists/the-room/server/wikiFeed';

/**
 * The operations board's numbers: a rolling 10-minute picture of the feed, refreshed every second.
 * To show a client's data instead, produce the same `Insights` shape from their source.
 */

/** Rolling window for everything on the board. */
export const WINDOW_MINUTES = 10;
/** Width of one bar in the activity chart. */
export const BUCKET_SECONDS = 20;

/** Trending only lists pages from these wikis, so titles are in a language the filter covers. */
export const TRENDING_WIKIS = ['enwiki'];
/** Trending looks further back than the other panels, so it has enough to rank. */
export const TRENDING_WINDOW_MINUTES = 30;
/**
 * On start, trending is filled in from Wikipedia's API with the last TRENDING_WINDOW_MINUTES of
 * English Wikipedia article edits, so it doesn't start empty. Requests are capped at this many pages
 * of 500 edits each.
 */
const BACKFILL_URL = 'https://en.wikipedia.org/w/api.php';
const BACKFILL_MAX_REQUESTS = 6;
/** A page needs this many edits by people (not bots) in the window to trend... */
const TRENDING_MIN_EDITS = 3;
/** ...from at least this many different people. One person can't put a page on the board. */
const TRENDING_MIN_EDITORS = 2;
const TRENDING_ROWS = 7;
const LARGEST_ROWS = 5;
const LANGUAGE_ROWS = 8;

export type TrendingPage = { title: string; wiki: string; edits: number; editors: number; bytes: number };
export type LargeEdit = { wiki: string; name: string; delta: number; bot: boolean; isNew: boolean; at: number };
export type ActivityBucket = { humans: number; bots: number };

export type Insights = {
  /** Edits per second over the last minute. */
  perSecond: number;
  /** Brand-new articles (not talk or user pages) in the window. */
  newArticles: number;
  botShare: number;
  activeWikis: number;
  editsInWindow: number;
  trending: TrendingPage[];
  /** Oldest first; the last bucket is still filling. */
  activity: ActivityBucket[];
  largest: LargeEdit[];
  languages: { language: string; edits: number }[];
  /** How long the board has been watching, in seconds, up to the window length. */
  watchedSeconds: number;
  updatedAt: number;
};

const EMPTY: Insights = {
  perSecond: 0,
  newArticles: 0,
  botShare: 0,
  activeWikis: 0,
  editsInWindow: 0,
  trending: [],
  activity: [],
  largest: [],
  languages: [],
  watchedSeconds: 0,
  updatedAt: 0,
};

export const insightsStore = createStore<Insights>(EMPTY);

type Seen = { at: number; ev: EditEvent };
type PageTrack = { title: string; wiki: string; edits: number[]; editors: Map<string, number>; bytes: number };

const WINDOW_MS = WINDOW_MINUTES * 60_000;
const TRENDING_WINDOW_MS = TRENDING_WINDOW_MINUTES * 60_000;
const BUCKETS = (WINDOW_MINUTES * 60) / BUCKET_SECONDS;

let users = 0;
let stop: (() => void) | null = null;

/** Starts collecting (shared by every caller) and returns a function that stops it. */
export function startInsights() {
  users++;
  if (users === 1) stop = collect();
  return () => {
    users--;
    if (users === 0) {
      stop?.();
      stop = null;
    }
  };
}

function collect() {
  const started = Date.now();
  const seen: Seen[] = [];
  const pages = new Map<string, PageTrack>();
  /** Titles that failed the filter stay hidden for the rest of the visit. */
  const hidden = new Set<string>();

  /** Adds one edit to the trending tally. Returns the page if it was counted. */
  const track = (wiki: string, title: string, user: string, delta: number, at: number) => {
    const key = `${wiki}|${title}`;
    if (hidden.has(key)) return null;
    if (!isTitleSafe(title)) {
      hidden.add(key);
      pages.delete(key);
      return null;
    }
    let page = pages.get(key);
    if (!page) {
      page = { title, wiki, edits: [], editors: new Map(), bytes: 0 };
      pages.set(key, page);
    }
    page.edits.push(at);
    page.editors.set(user || 'anonymous', Math.max(at, page.editors.get(user || 'anonymous') ?? 0));
    page.bytes += delta;
    return page;
  };

  const onEdit = (ev: EditEvent) => {
    // Local arrival time keeps the windows honest even if the visitor's clock is off.
    const at = Date.now();
    seen.push({ at, ev });
    if (ev.bot || ev.namespace !== 0 || !ev.title || !TRENDING_WIKIS.includes(ev.wiki)) return;
    track(ev.wiki, ev.title, ev.user, ev.delta, at);
  };
  feedListeners.add(onEdit);

  let cancelled = false;
  const backfill = async () => {
    const since = new Date(started - TRENDING_WINDOW_MS).toISOString();
    const touched = new Set<PageTrack>();
    let next: string | undefined;
    for (let i = 0; i < BACKFILL_MAX_REQUESTS && !cancelled; i++) {
      const params = new URLSearchParams({
        action: 'query',
        list: 'recentchanges',
        rcnamespace: '0',
        rcshow: '!bot',
        rctype: 'edit|new',
        rcprop: 'title|user|timestamp|sizes',
        rcend: since,
        rclimit: '500',
        format: 'json',
        formatversion: '2',
        origin: '*',
      });
      if (next) params.set('rccontinue', next);
      const res = await fetch(`${BACKFILL_URL}?${params}`);
      if (!res.ok) return;
      const body = (await res.json()) as {
        query?: { recentchanges?: { title?: string; user?: string; timestamp?: string; oldlen?: number; newlen?: number }[] };
        continue?: { rccontinue?: string };
      };
      for (const rc of body.query?.recentchanges ?? []) {
        const at = rc.timestamp ? Date.parse(rc.timestamp) : NaN;
        // Skip anything the live stream has already counted.
        if (!rc.title || Number.isNaN(at) || at >= started) continue;
        const page = track(TRENDING_WIKIS[0], rc.title, rc.user ?? 'hidden', (rc.newlen ?? 0) - (rc.oldlen ?? 0), at);
        if (page) touched.add(page);
      }
      next = body.continue?.rccontinue;
      if (!next) break;
    }
    // Older edits arrived after live ones; keep each page's list in time order.
    touched.forEach((page) => page.edits.sort((a, b) => a - b));
    if (!cancelled) tick();
  };
  if (TRENDING_WIKIS.includes('enwiki')) void backfill().catch(() => {});

  function tick() {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const trendCutoff = now - TRENDING_WINDOW_MS;
    while (seen.length && seen[0].at < cutoff) seen.shift();

    const activity: ActivityBucket[] = Array.from({ length: BUCKETS }, () => ({ humans: 0, bots: 0 }));
    const wikis = new Set<string>();
    const languages = new Map<string, number>();
    let bots = 0;
    let newArticles = 0;
    let lastMinute = 0;
    const big: Seen[] = [];

    for (const s of seen) {
      const { ev } = s;
      const age = now - s.at;
      const bucket = BUCKETS - 1 - Math.floor(age / (BUCKET_SECONDS * 1000));
      if (bucket >= 0) activity[bucket][ev.bot ? 'bots' : 'humans']++;
      if (age < 60_000) lastMinute++;
      if (ev.bot) bots++;
      if (ev.isNew && ev.namespace === 0) newArticles++;
      wikis.add(ev.wiki);
      const language = wikipediaLanguage(ev.wiki);
      if (language) languages.set(language, (languages.get(language) ?? 0) + 1);
      big.push(s);
    }
    big.sort((a, b) => Math.abs(b.ev.delta) - Math.abs(a.ev.delta));

    const trending: TrendingPage[] = [];
    for (const [key, page] of pages) {
      while (page.edits.length && page.edits[0] < trendCutoff) page.edits.shift();
      for (const [user, last] of page.editors) if (last < trendCutoff) page.editors.delete(user);
      if (!page.edits.length) {
        pages.delete(key);
        continue;
      }
      if (page.edits.length >= TRENDING_MIN_EDITS && page.editors.size >= TRENDING_MIN_EDITORS) {
        trending.push({ title: page.title, wiki: page.wiki, edits: page.edits.length, editors: page.editors.size, bytes: page.bytes });
      }
    }
    trending.sort((a, b) => b.edits - a.edits || b.editors - a.editors);

    insightsStore.set({
      perSecond: lastMinute / Math.min(60, Math.max(1, (now - started) / 1000)),
      newArticles,
      botShare: seen.length ? bots / seen.length : 0,
      activeWikis: wikis.size,
      editsInWindow: seen.length,
      trending: trending.slice(0, TRENDING_ROWS),
      activity,
      largest: big.slice(0, LARGEST_ROWS).map(({ at, ev }) => ({
        wiki: ev.wiki,
        name: wikiName(ev.wiki),
        delta: ev.delta,
        bot: ev.bot,
        isNew: ev.isNew,
        at,
      })),
      languages: [...languages.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, LANGUAGE_ROWS)
        .map(([language, edits]) => ({ language, edits })),
      watchedSeconds: Math.min(WINDOW_MINUTES * 60, (now - started) / 1000),
      updatedAt: now,
    });
  }

  const timer = window.setInterval(tick, 1000);
  tick();
  return () => {
    cancelled = true;
    feedListeners.delete(onEdit);
    window.clearInterval(timer);
    insightsStore.set(EMPTY);
  };
}
