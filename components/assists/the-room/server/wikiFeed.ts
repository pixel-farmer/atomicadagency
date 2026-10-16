import { createStore } from '@/components/assists/the-room/server/serverStore';

/**
 * Wikipedia's public recent-changes stream (every edit on every Wikimedia wiki, no key needed).
 * If it can't connect, or goes quiet, a sample feed with a realistic mix stands in until it returns.
 * Edit summaries are never read. Page titles are kept only for the operations board's trending
 * list, which shows a title once several people are editing it and it passes titleFilter.ts.
 * Editor names are used only to count distinct editors and are never shown.
 */
const STREAM_URL = 'https://stream.wikimedia.org/v2/stream/recentchange';
const CONNECT_TIMEOUT_MS = 4000;
/** Switch to the sample feed if the live stream sends nothing for this long. */
const STALL_MS = 10_000;
/** Most edits held for the room to draw. Older ones are dropped during big bursts. */
const MAX_QUEUE = 300;

export type EditEvent = {
  wiki: string;
  bot: boolean;
  isNew: boolean;
  delta: number;
  /** Page title. Never drawn directly; see wikiInsights.ts. */
  title: string;
  /** 0 is articles; other namespaces are talk pages, user pages, files and so on. */
  namespace: number;
  /** Editor name or IP, only for counting distinct editors. */
  user: string;
  /** Milliseconds since 1970, from the stream when it has one. */
  at: number;
};

/** Called with every edit as it arrives, before the room draws it. */
export const feedListeners = new Set<(ev: EditEvent) => void>();
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

/** Sister projects, by the suffix on their wiki code: [full name, short tag for the screens]. */
const PROJECTS: [suffix: string, name: string, tag: string][] = [
  ['wiktionary', 'Wiktionary', 'DICT'],
  ['wikisource', 'Wikisource', 'SRC'],
  ['wikibooks', 'Wikibooks', 'BOOK'],
  ['wikiquote', 'Wikiquote', 'QUOT'],
  ['wikinews', 'Wikinews', 'NEWS'],
  ['wikiversity', 'Wikiversity', 'UNI'],
  ['wikivoyage', 'Wikivoyage', 'VOY'],
  ['wiki', 'Wikipedia', ''],
];

/** Wikis that aren't one language of a project. */
const SPECIAL_WIKIS: Record<string, [name: string, tag: string]> = {
  wikidatawiki: ['Wikidata', 'WIKIDATA'],
  commonswiki: ['Wikimedia Commons', 'COMMONS'],
  metawiki: ['Meta-Wiki', 'META'],
  specieswiki: ['Wikispecies', 'SPECIES'],
  mediawikiwiki: ['MediaWiki.org', 'MEDIAWKI'],
  sourceswiki: ['Multilingual Wikisource', 'SRC'],
  wikifunctionswiki: ['Wikifunctions', 'FUNCTION'],
  incubatorwiki: ['Wikimedia Incubator', 'INCUBATR'],
};

let languageNames: Intl.DisplayNames | null = null;

function languageName(code: string) {
  if (code === 'simple') return 'Simple English';
  const fallback = code.replace(/_/g, '-').toUpperCase();
  try {
    languageNames ??= new Intl.DisplayNames(['en'], { type: 'language' });
    const name = languageNames.of(code.replace(/_/g, '-'));
    return name && name !== code.replace(/_/g, '-') ? name : fallback;
  } catch {
    return fallback;
  }
}

function splitWiki(wiki: string) {
  const special = SPECIAL_WIKIS[wiki];
  if (special) return { lang: '', name: special[0], tag: special[1] };
  for (const [suffix, name, tag] of PROJECTS) {
    if (wiki.endsWith(suffix) && wiki.length > suffix.length) {
      return { lang: wiki.slice(0, -suffix.length), name, tag };
    }
  }
  return { lang: '', name: wiki, tag: wiki.toUpperCase() };
}

/** Short label for the screens, at most 8 characters: enwiki → EN, hewikisource → HE·SRC. */
export function wikiLabel(wiki: string) {
  const { lang, tag } = splitWiki(wiki);
  if (!lang) return tag.slice(0, 8);
  const code = lang.replace(/_/g, '-').toUpperCase();
  return (tag ? `${code.slice(0, 3)}·${tag}` : code).slice(0, 8);
}

/** Readable name for the alert: hewikisource → Hebrew Wikisource. */
export function wikiName(wiki: string) {
  const { lang, name } = splitWiki(wiki);
  return lang ? `${languageName(lang)} ${name}` : name;
}

/** Language of a Wikipedia edition (enwiki → English), or null for any other wiki. */
export function wikipediaLanguage(wiki: string) {
  const { lang, name } = splitWiki(wiki);
  return lang && name === 'Wikipedia' ? languageName(lang) : null;
}

type RecentChange = {
  type?: string;
  wiki?: string;
  bot?: boolean;
  title?: string;
  namespace?: number;
  user?: string;
  timestamp?: number;
  length?: { old?: number; new?: number };
};

function parseRecentChange(raw: string): EditEvent | null {
  try {
    const d = JSON.parse(raw) as RecentChange;
    if (!d.wiki || (d.type !== 'edit' && d.type !== 'new')) return null;
    const delta = (d.length?.new ?? 0) - (d.length?.old ?? 0);
    return {
      wiki: d.wiki,
      bot: Boolean(d.bot),
      isNew: d.type === 'new',
      delta,
      title: typeof d.title === 'string' ? d.title : '',
      namespace: typeof d.namespace === 'number' ? d.namespace : -1,
      user: typeof d.user === 'string' ? d.user : '',
      at: typeof d.timestamp === 'number' ? d.timestamp * 1000 : Date.now(),
    };
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

/** Sample pages for English Wikipedia, busiest first, so a few of them trend. */
const SAMPLE_PAGES = [
  'Solar eclipse', 'Mount Everest', 'Jazz', 'Python (programming language)', 'Ada Lovelace',
  'Great Barrier Reef', 'Photosynthesis', 'Roman Empire', 'Octopus', 'Saturn',
  'Mona Lisa', 'Tea', 'Bicycle', 'Volcano', 'Honey bee', 'Amazon rainforest', 'Chess',
  'Lighthouse', 'Origami', 'Marie Curie', 'Aurora', 'Typewriter', 'Coral reef', 'Glacier',
  'Silk Road', 'Penguin', 'Telescope', 'Mariana Trench', 'Bonsai', 'Northern cardinal',
];

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
  // Skewed pick, so the first few pages get most of the edits and trend.
  const page = Math.floor(SAMPLE_PAGES.length * Math.random() ** 3);
  return {
    wiki,
    bot,
    isNew,
    delta: Math.round(sign * size),
    title: wiki === 'enwiki' ? SAMPLE_PAGES[page] : `Sample page ${Math.floor(Math.random() * 9000)}`,
    namespace: 0,
    user: `Sample editor ${Math.floor(Math.random() * (page < 5 ? 12 : 400))}`,
    at: Date.now(),
  };
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
    feedListeners.forEach((listener) => listener(ev));
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
