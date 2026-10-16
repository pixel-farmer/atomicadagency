/**
 * Safeguard for page titles on the operations board. A title must pass every check here before
 * it can appear, on top of the "several editors" rule in wikiInsights.ts. It errs on the side of
 * hiding: a few legitimate articles get filtered too, which is fine for a client-facing demo.
 *
 * Add words to BLOCKED_WORDS (whole word) or BLOCKED_STEMS (matches any word that starts with it).
 */
const BLOCKED_STEMS = [
  'fuck', 'shit', 'cunt', 'bitch', 'bastard', 'asshole', 'dickhead', 'wank', 'twat', 'bollock',
  'whore', 'slut', 'porn', 'pornograph', 'masturbat', 'orgasm', 'erotic', 'fetish', 'hentai',
  'nigg', 'faggot', 'retard', 'tranny', 'kike', 'wetback', 'raghead', 'towelhead', 'chink',
  'rapist', 'pedophil', 'paedophil', 'incest', 'bestiality', 'nazi', 'hitler', 'swastika',
  'suicid', 'beheading', 'genital', 'vagin', 'penis', 'testic', 'nude', 'naked',
];
const BLOCKED_WORDS = [
  'ass', 'arse', 'dick', 'cock', 'pussy', 'tits', 'boobs', 'cum', 'sex', 'sexy', 'rape', 'raped',
  'anal', 'fag', 'spic', 'gook', 'coon', 'dyke', 'poop', 'pee', 'butt', 'stupid', 'sucks',
  'idiot', 'dumb', 'loser', 'hate', 'kill', 'die', 'dead', 'death', 'murder', 'shooting',
  'massacre', 'terror', 'terrorist', 'xxx', 'lol', 'lmao', 'wtf', 'omg',
];

const MAX_LENGTH = 90;
/** Leetspeak and look-alike characters, mapped back to letters before checking. */
const LOOKALIKES: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

const words = new Set(BLOCKED_WORDS);

function normalize(title: string) {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LOOKALIKES[c] ?? c);
}

/** True when a title is safe to show. */
export function isTitleSafe(title: string) {
  const t = title.trim();
  if (!t || t.length > MAX_LENGTH) return false;
  // Control characters, links and keyboard mashing.
  if (/[\u0000-\u001f\u007f]/.test(t)) return false;
  if (/https?:|www\.|\.com\b/i.test(t)) return false;
  if (/(.)\1{3,}/.test(t)) return false;
  // Shouting: mostly capitals across a long title.
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 10 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6) return false;

  const tokens = normalize(t).split(/[^a-z]+/).filter(Boolean);
  // Words spelled out letter by letter ("f u c k", "f.u.c.k") are joined back up and checked too.
  const spelled = t.length < 40 && tokens.filter((x) => x.length === 1).length >= 3 ? [tokens.join('')] : [];
  for (const token of [...tokens, ...spelled]) {
    if (words.has(token)) return false;
    if (BLOCKED_STEMS.some((stem) => token.startsWith(stem))) return false;
  }
  return true;
}
