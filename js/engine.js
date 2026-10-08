// The rules of English Quest, with no screen code, so they can be tested in Node.
// Content level: a NATIVE English speaker in US 6th grade (Common Core ELA). Level 1 = grade 5, 3 = grade 6, 5 = grades 7-8.
// Six tracks, each with its own level (1-5) that moves with the child's last answers.
import { WORDS } from './content/words.js';
import { GRAMMAR } from './content/grammar.js';
import { ERRORS } from './content/errors.js';
import { POWER } from './content/power.js';
import { SPELLING } from './content/spelling.js';
import { READING } from './content/reading.js';

export const TRACKS = {
  words: { name: 'Words', icon: '🔤' },
  grammar: { name: 'Grammar & Usage', icon: '🧩' },
  error: { name: 'Spot the Error', icon: '🔎' },
  power: { name: 'Word Power', icon: '💥', kinds: { root: 'Roots and word parts', idiom: 'What does the idiom mean?', figurative: 'Figurative language', analogy: 'Complete the analogy', connotation: 'Shades of meaning', synonym: 'Find the synonym', antonym: 'Find the antonym', context: 'Use the context clues' } },
  spell: { name: 'Spelling', icon: '🐝' },
  read: { name: 'Reading', icon: '📖' },
};
// What each level means in US school grades. The goal: Grade 6 (level 3) or higher in every part.
export const GRADES = { 1: 'Grade 5', 2: 'Grade 5-6', 3: 'Grade 6', 4: 'Grade 7', 5: 'Grade 8' };
export const GOAL_LEVEL = 3;
export const RANKS = [
  { xp: 0, name: 'Rookie', icon: '🥚' }, { xp: 500, name: 'Explorer', icon: '🧭' }, { xp: 1200, name: 'Adventurer', icon: '🗡️' },
  { xp: 2500, name: 'Hero', icon: '🛡️' }, { xp: 4500, name: 'Champion', icon: '🏆' }, { xp: 7000, name: 'Master', icon: '🧙' },
  { xp: 10000, name: 'Legend', icon: '🐉' }, { xp: 15000, name: 'Mythic', icon: '🌌' },
];
// Eight quests per world.
export const WORLDS = [
  { name: 'Jungle', icon: '🌴' }, { name: 'Desert', icon: '🏜️' }, { name: 'Ocean', icon: '🌊' }, { name: 'Ice Land', icon: '🧊' },
  { name: 'Volcano', icon: '🌋' }, { name: 'Sky City', icon: '☁️' }, { name: 'Space', icon: '🚀' }, { name: 'Dragon Castle', icon: '🏰' },
];
export const QUESTS_PER_WORLD = 8;
export const BADGES = [
  { id: 'first', icon: '🎒', name: 'First Quest', desc: 'finish your first quest' },
  { id: 'perfect', icon: '💎', name: 'Perfect', desc: 'a quest with zero mistakes' },
  { id: 'combo8', icon: '🔥', name: 'On Fire', desc: '8 right answers in a row' },
  { id: 'boss', icon: '👹', name: 'Boss Slayer', desc: 'beat 5 bosses' },
  { id: 'revenge', icon: '😈', name: 'Revenge', desc: 'win 10 Revenge Questions' },
  { id: 'speller', icon: '🐝', name: 'Spelling Bee', desc: 'spell 15 words right' },
  { id: 'flash20', icon: '⚡', name: 'Lightning', desc: '20 points in a Lightning Round' },
  { id: 'streak5', icon: '📅', name: '5 Days', desc: 'play 5 days in a row' },
  { id: 'level5', icon: '👑', name: 'Top Level', desc: 'reach level 5 in any part' },
  { id: 'world', icon: '🗺️', name: 'World Clear', desc: 'clear a whole world' },
];

const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const norm = (s) => String(s).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function newProgress() {
  return { v: 1, xp: 0, missionsDone: 0, levels: { words: 2, grammar: 2, error: 2, power: 2, spell: 2, read: 2 }, recent: {}, seen: {}, review: [],
    days: [], bestCombo: 0, lightningBest: 0, bosses: 0, revenges: 0, spelled: 0, badges: [], medals: [] };
}
export function fixProgress(p) {
  const base = newProgress();
  if (!p) return base;
  const levels = Object.fromEntries(Object.keys(base.levels).map((t) => [t, (p.levels || {})[t] || base.levels[t]]));
  return { ...base, ...p, levels };
}

export const rankOf = (xp) => { let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++; return { ...RANKS[i], i, next: RANKS[i + 1] || null }; };
export const worldOf = (missionsDone) => ({ ...WORLDS[Math.floor(missionsDone / QUESTS_PER_WORLD) % WORLDS.length], stop: missionsDone % QUESTS_PER_WORLD, lap: Math.floor(missionsDone / (QUESTS_PER_WORLD * WORLDS.length)) });

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
export function streakOf(p) {
  const set = new Set(p.days); let d = new Date(today() + 'T12:00:00'), n = 0;
  if (!set.has(today())) d.setDate(d.getDate() - 1); // yesterday still counts until today ends
  while (set.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- picking items: the child's level first, the least-seen first ----------
function choose(pool, lv, seen, keyOf, avoid) {
  for (const d of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
    const at = pool.filter((x) => x.lv === lv + d && !avoid.has(keyOf(x)));
    if (!at.length) continue;
    const least = Math.min(...at.map((x) => seen[keyOf(x)] || 0));
    return pick(at.filter((x) => (seen[keyOf(x)] || 0) === least));
  }
  return pick(pool);
}

function distractors(w, n, field) {
  const same = (x) => x !== w && x[field] !== w[field] && x.en !== w.en && x.def !== w.def;
  let pool = WORDS.filter((x) => same(x) && x.pos === w.pos && Math.abs(x.lv - w.lv) <= 1);
  if (pool.length < n) pool = WORDS.filter((x) => same(x) && x.pos === w.pos);
  if (pool.length < n) pool = WORDS.filter(same);
  const out = [];
  for (const x of shuffle(pool)) { if (!out.some((o) => o[field] === x[field])) out.push(x); if (out.length === n) break; }
  return out;
}

export const builders = {
  // dir 'def': the word is shown, pick its meaning. dir 'word': the meaning is shown, pick the word.
  words(w, dir = pick(['def', 'word'])) {
    const field = dir === 'def' ? 'def' : 'en';
    const wrong = distractors(w, 3, field);
    return { id: 'w:' + w.en, track: 'words', lv: w.lv, dir, word: w, options: shuffle([w[field], ...wrong.map((x) => x[field])]), answer: w[field],
      why: `${w.en}: ${w.def}. Example: ${w.ex}` };
  },
  spell(w) { return { id: 'sp:' + w.en, track: 'spell', lv: w.lv, word: w, answer: w.en, why: `${w.en}: ${w.def}` }; },
  grammar(g) { return { id: g.id, track: 'grammar', lv: g.lv, item: g, options: shuffle([g.a, ...g.wrong]), answer: g.a, why: g.why }; },
  power(g) { return { id: g.id, track: 'power', lv: g.lv, item: g, options: shuffle([g.a, ...g.wrong]), answer: g.a, why: g.why }; },
  // Spot the Error: options stay in order A-D plus "No error", like a test sheet.
  error(e) {
    const options = ['A', 'B', 'C', 'D', 'No error'];
    const fixed = e.bad < 4 ? e.parts.map((x, i) => (i === e.bad ? e.fix : x)).join(' ') : e.parts.join(' ');
    return { id: e.id, track: 'error', lv: e.lv, item: e, options, answer: options[e.bad], fixed, why: e.why };
  },
  read(r, i) { const q = r.qs[i]; return { id: r.id + ':' + i, track: 'read', lv: r.lv, text: r, qi: i, item: q, options: shuffle([q.a, ...q.wrong]), answer: q.a, why: q.why }; },
};

export function questionFor(track, lv, p, avoid = new Set(), opts = {}) {
  const seen = p.seen;
  if (track === 'words') return builders.words(choose(WORDS, lv, seen, (w) => 'w:' + w.en, avoid));
  if (track === 'spell') return builders.spell(choose(SPELLING, lv, seen, (w) => 'sp:' + w.en, avoid));
  if (track === 'grammar') return builders.grammar(choose(GRAMMAR, lv, seen, (g) => g.id, avoid));
  if (track === 'error') return builders.error(choose(ERRORS, lv, seen, (e) => e.id, avoid));
  if (track === 'power') return builders.power(choose(POWER, lv, seen, (g) => g.id, avoid));
  if (track === 'read') { const r = choose(READING, lv, seen, (x) => x.id + ':0', avoid); return [0, 1, 2].map((i) => builders.read(r, i)); }
  throw new Error('unknown track ' + track);
}

// Rebuild a question from its id (used for "revenge" questions the child once got wrong).
export function questionById(id) {
  if (id.startsWith('w:')) { const w = WORDS.find((x) => 'w:' + x.en === id); return w && builders.words(w); }
  if (id.startsWith('sp:')) { const w = SPELLING.find((x) => 'sp:' + x.en === id); return w && builders.spell(w); }
  for (const [bank, make] of [[GRAMMAR, builders.grammar], [ERRORS, builders.error], [POWER, builders.power]]) { const x = bank.find((y) => y.id === id); if (x) return make(x); }
  return null;
}

// A quest: 7 mixed questions, a short reading text with 3 questions, then the boss.
// Up to two "revenge" questions (once answered wrong, now due again) replace mixed ones.
export function makeMission(p, { speech = true } = {}) {
  const avoid = new Set();
  const mixed = ['words', 'grammar', 'error', 'power', 'words', pick(['grammar', 'error']), speech ? 'spell' : 'power'];
  const qs = shuffle(mixed).map((t) => { const q = questionFor(t, p.levels[t], p, avoid); avoid.add(q.id); return q; });
  const due = p.review.filter((r) => r.due <= p.missionsDone && (speech || !r.id.startsWith('sp:')));
  shuffle(due).slice(0, 2).forEach((r, i) => { const q = questionById(r.id); if (q && !avoid.has(q.id)) { q.revenge = true; qs[i * 3 + 1] = q; avoid.add(q.id); } });
  const reading = questionFor('read', p.levels.read, p, avoid);
  const bossTrack = pick(['words', 'grammar', 'error', 'power']);
  const boss = questionFor(bossTrack, Math.min(5, p.levels[bossTrack] + 1), p, avoid);
  boss.boss = true;
  return [...qs, ...reading, boss];
}

export function check(q, given) {
  if (q.track === 'spell') return norm(given) === norm(q.answer);
  return given === q.answer;
}

// After each answer: level window, seen counts, review box. Returns what changed, for the screen.
export function applyAnswer(p, q, correct) {
  const out = {};
  if (!q.boss && !q.revenge) {
    const r = (p.recent[q.track] = [...(p.recent[q.track] || []), correct].slice(-6));
    const lv = p.levels[q.track];
    if (r.length >= 5 && r.filter(Boolean).length >= r.length - 1 && lv < 5) { p.levels[q.track] = lv + 1; p.recent[q.track] = []; out.levelUp = q.track; }
    else if (r.length >= 5 && r.filter(Boolean).length <= 2 && lv > 1) { p.levels[q.track] = lv - 1; p.recent[q.track] = []; out.levelDown = q.track; }
  }
  const key = q.track === 'read' ? q.id.replace(/:\d$/, ':0') : q.id;
  if (q.track !== 'read' || q.qi === 0) p.seen[key] = (p.seen[key] || 0) + 1;
  const inBox = p.review.find((r) => r.id === q.id);
  if (q.track !== 'read') {
    if (!correct) { if (inBox) inBox.due = p.missionsDone + 3; else p.review.push({ id: q.id, due: p.missionsDone + 2 }); }
    else if (inBox && q.revenge) { p.review = p.review.filter((r) => r !== inBox); p.revenges++; out.revenge = true; }
  }
  if (correct && q.boss) p.bosses++;
  if (correct && q.track === 'spell') p.spelled++;
  return out;
}

export const xpFor = (q, correct, combo, hinted) => (!correct ? 0 : q.boss ? 50 : q.revenge ? 25 : hinted ? 5 : 10 * (combo >= 6 ? 3 : combo >= 3 ? 2 : 1));
export const medalFor = (mistakes) => (mistakes <= 1 ? 'gold' : mistakes <= 3 ? 'silver' : 'bronze');

export function finishMission(p, mistakes, gained) {
  const before = rankOf(p.xp);
  const bonus = 30 + (mistakes === 0 ? 50 : 0);
  p.xp += gained + bonus; p.missionsDone++;
  if (!p.days.includes(today())) p.days.push(today());
  p.medals = [...p.medals, medalFor(mistakes)].slice(-200);
  const after = rankOf(p.xp);
  return { bonus, rankUp: after.i > before.i ? after : null, worldDone: p.missionsDone % QUESTS_PER_WORLD === 0, newBadges: awardBadges(p, { perfect: mistakes === 0 }) };
}

export function awardBadges(p, ctx = {}) {
  const has = new Set(p.badges), got = [];
  const test = {
    first: p.missionsDone >= 1, perfect: ctx.perfect, combo8: p.bestCombo >= 8, boss: p.bosses >= 5, revenge: p.revenges >= 10,
    speller: p.spelled >= 15, flash20: p.lightningBest >= 20, streak5: streakOf(p) >= 5, level5: Object.values(p.levels).some((l) => l >= 5),
    world: p.missionsDone >= QUESTS_PER_WORLD,
  };
  for (const b of BADGES) if (test[b.id] && !has.has(b.id)) { p.badges.push(b.id); got.push(b); }
  return got;
}

// Lightning round: fast word meanings, around the child's word level.
export function lightningQuestion(p, last) {
  const lv = Math.max(1, Math.min(5, p.levels.words - 1 + Math.floor(Math.random() * 3)));
  let q; do { q = builders.words(choose(WORDS, lv, {}, (w) => w.en, new Set()), 'def'); } while (last && q.id === last);
  return q;
}
