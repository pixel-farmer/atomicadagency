import { createStore } from '@/components/assists/the-room/server/serverStore';

/**
 * Wikipedia's public recent-changes stream (every edit on every Wikimedia wiki, no key needed).
 * If it can't connect, or goes quiet, a sample feed with a realistic mix stands in until it returns.
 * Only the wiki code, bot flag and byte counts are used, never page titles or edit summaries,
 * so nothing user-written ever reaches the screens.
 */
const STREAM_URL = 'https://stream.wikimedia.org/v2/stream/recentchange';
const CONNECT_TIMEOUT_MS = 4000;
/** Switch to the sample feed if the live stream sends nothing for this long. */
const STALL_MS = 10_000;
/** Most edits held for the room to draw. Older ones are dropped during big bursts. */
const MAX_QUEUE = 300;

export type EditEvent = { wiki: string; bot: boolean; isNew: boolean; delta: number };
export type FeedSource = 'connecting' | 'live' | 'sample';
export type FeedStats = {
  source: FeedSource;
  /** Edits in the last 60 seconds. */
  rate: number;
  /** 0..1 */
  botShare: number;
  wikis: number;
  newPages: number;
  total: number;
  /** Busiest wikis in the last 60 seconds, busiest first. */
  top: [string, number][];
};

export const feedStats = createStore<FeedStats>({
  source: 'connecting',
  rate: 0,
  botShare: 0,
  wikis: 0,
  newPages: 0,
  total: 0,
  top: [],
});

/** Edits waiting to be drawn. The room's driver takes a few each frame. */
export const feedQueue: EditEvent[] = [];

/** Short display name for a wiki code, e.g. enwiki → EN. */
export function wikiLabel(wiki: string) {
  if (wiki === 'wikidatawiki') return 'WIKIDATA';
  if (wiki === 'commonswiki') return 'COMMONS';
  return wiki.replace(/wiki$/, '').toUpperCase().slice(0, 8);
}

type RecentChange = {
  type?: string;
  wiki?: string;
  bot?: boolean;
  length?: { old?: number; new?: number };
};

function parseRecentChange(raw: string): EditEvent | null {
  try {
    const d = JSON.parse(raw) as RecentChange;
    if (!d.wiki || (d.type !== 'edit' && d.type !== 'new')) return null;
    const delta = (d.length?.new ?? 0) - (d.length?.old ?? 0);
    return { wiki: d.wiki, bot: Boolean(d.bot), isNew: d.type === 'new', delta };
  } catch {
    return null;
  }
}

/* Sample feed: weights roughly match a typical hour on the real stream. */
const SAMPLE_WEIGHTS: [string, number][] = [
  ['enwiki', 30], ['wikidatawiki', 24], ['commonswiki', 10], ['dewiki', 6], ['frwiki', 6], ['eswiki', 5],
  ['jawiki', 4], ['ruwiki', 4], ['itwiki', 3], ['zhwiki', 3], ['ptwiki', 3], ['plwiki', 2],
];
const SAMPLE_TOTAL = SAMPLE_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);

function sampleEvent(): EditEvent {
  let r = Math.random() * SAMPLE_TOTAL;
  let wiki = 'enwiki';
  for (const [name, w] of SAMPLE_WEIGHTS) {
    if ((r -= w) < 0) {
      wiki = name;
      break;
    }
  }
  const bot = Math.random() < (wiki === 'wikidatawiki' ? 0.6 : 0.17);
  const isNew = Math.random() < 0.03;
  let size = Math.exp(Math.random() * 6.4);
  if (Math.random() < 0.0012) size = 52_000 + Math.random() * 60_000;
  const sign = isNew || Math.random() < 0.63 ? 1 : -1;
  return { wiki, bot, isNew, delta: Math.round(sign * size) };
}

let users = 0;
let stopFeed: (() => void) | null = null;

/** Starts the feed (shared by every caller) and returns a function that releases it. */
export function startWikiFeed() {
  users++;
  if (users === 1) stopFeed = connect();
  return () => {
    users--;
    if (users === 0) {
      stopFeed?.();
      stopFeed = null;
    }
  };
}

function connect() {
  let source: FeedSource = 'connecting';
  let lastLive = 0;
  let total = 0;
  let newPages = 0;
  let sampleTimer: number | undefined;
  const recent: { t: number; wiki: string; bot: boolean }[] = [];
  feedQueue.length = 0;

  const push = (ev: EditEvent) => {
    total++;
    if (ev.isNew) newPages++;
    recent.push({ t: performance.now(), wiki: ev.wiki, bot: ev.bot });
    feedQueue.push(ev);
    if (feedQueue.length > MAX_QUEUE) feedQueue.splice(0, feedQueue.length - MAX_QUEUE);
  };

  const startSample = () => {
    if (sampleTimer !== undefined) return;
    source = 'sample';
    let owed = 0;
    let last = performance.now();
    sampleTimer = window.setInterval(() => {
      const now = performance.now();
      owed += (19 + 8 * Math.sin(now / 9000) + 5 * Math.sin(now / 2100)) * ((now - last) / 1000);
      last = now;
      while (owed >= 1) {
        owed--;
        push(sampleEvent());
      }
    }, 50);
  };
  const stopSample = () => {
    if (sampleTimer === undefined) return;
    window.clearInterval(sampleTimer);
    sampleTimer = undefined;
  };

  let stream: EventSource | null = null;
  try {
    stream = new EventSource(STREAM_URL);
    stream.onmessage = (e: MessageEvent<string>) => {
      lastLive = performance.now();
      if (source !== 'live') {
        stopSample();
        source = 'live';
      }
      const ev = parseRecentChange(e.data);
      if (ev) push(ev);
    };
    // EventSource keeps retrying on its own; the sample feed covers the gap until it gets through.
    stream.onerror = () => {
      if (source === 'connecting') startSample();
    };
  } catch {
    startSample();
  }
  const connectTimeout = window.setTimeout(() => {
    if (source === 'connecting') startSample();
  }, CONNECT_TIMEOUT_MS);

  const aggregate = window.setInterval(() => {
    const now = performance.now();
    if (source === 'live' && now - lastLive > STALL_MS) startSample();
    while (recent.length && now - recent[0].t > 60_000) recent.shift();
    const counts = new Map<string, number>();
    let bots = 0;
    for (const e of recent) {
      counts.set(e.wiki, (counts.get(e.wiki) ?? 0) + 1);
      if (e.bot) bots++;
    }
    feedStats.set({
      source,
      rate: recent.length,
      botShare: recent.length ? bots / recent.length : 0,
      wikis: counts.size,
      newPages,
      total,
      top: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    });
  }, 500);

  return () => {
    stream?.close();
    stopSample();
    window.clearTimeout(connectTimeout);
    window.clearInterval(aggregate);
    feedQueue.length = 0;
  };
}
