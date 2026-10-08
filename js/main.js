import { listUsers, createUser, openStore } from './storage.js';
import { TRACKS, GRADES, GOAL_LEVEL, BADGES, WORLDS, QUESTS_PER_WORLD, rankOf, worldOf, streakOf, fixProgress, makeMission, check, applyAnswer, xpFor, medalFor, finishMission, awardBadges, lightningQuestion } from './engine.js';
import { sfx, say, speechReady, confetti, isMuted, toggleMute } from './fx.js';
import { renderBoard } from './board.js';

// Everything on screen is in English (Ariel, 2026-10-08: "the entire site needs to be in english").
const app = document.getElementById('app');
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CHEERS = ['Nice!', 'Boom!', 'Nailed it!', 'Awesome!', 'Yes!', 'Great job!', 'Perfect!', 'Brilliant!', 'Too easy!', 'Legend!'];
const BOSS_CHEERS = ['BOSS DEFEATED!', 'K.O.!', 'The boss is down!'];
const ALMOST = ['Almost!', 'Not this time!', 'So close!', 'Oops!'];
const any = (a) => a[Math.floor(Math.random() * a.length)];
let store = null, p = null, hasVoice = false, keyHandler = null;
const onKey = (fn) => { keyHandler = fn; };
document.addEventListener('keydown', (e) => { if (keyHandler && !e.repeat) keyHandler(e); });
const save = () => store.saveProgress(p);
const log = (rec) => store.log({ kind: 'attempt', ts: Date.now(), ...rec });
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

function toast(html) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}

// ---------- who is playing ----------
async function chooser() {
  onKey(null);
  app.innerHTML = '<section class="screen center"><h1 class="logo">English <b>Quest</b></h1><p class="sub">Loading...</p></section>';
  const { users, offline } = await listUsers();
  let preset = null; try { preset = sessionStorage.getItem('eq.user'); } catch { /* ignore */ }
  const pre = users.find((u) => u.id === preset);
  if (pre) return start(pre);
  app.innerHTML = `<section class="screen center chooser">
    <h1 class="logo">English <b>Quest</b></h1>
    <p class="sub">Vocabulary, grammar, spelling, word power and reading. 6th grade level and beyond. Can you reach Legend?</p>
    ${users.length ? `<h2>Who's playing?</h2><div class="users">${users.map((u) => `<button class="user" data-id="${esc(u.id)}">${esc(u.name)}</button>`).join('')}</div>` : ''}
    <form class="new-user"><input name="n" maxlength="30" placeholder="${users.length ? 'New player name' : "What's your name?"}" autocomplete="off"><button class="primary">${users.length ? 'Add' : "Let's go!"}</button></form>
    <p class="online-note">${offline ? 'No internet right now. Keep playing, your progress will be saved when it comes back.' : 'Progress is saved by name: the same name continues on any device.'}</p>
    <a class="corner" href="#board">Progress board</a>
  </section>`;
  app.querySelectorAll('.user').forEach((b) => b.addEventListener('click', () => start(users.find((u) => u.id === b.dataset.id))));
  app.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.n.value.trim(); if (!name) return;
    try { start(await createUser(name)); } catch { alert("Couldn't save the name. Check the internet and try again."); }
  });
}

async function start(user) {
  app.innerHTML = '<section class="screen center"><p class="sub">Loading...</p></section>';
  try { store = await openStore(user); } catch { app.innerHTML = '<section class="screen center"><p class="sub">Couldn\'t load. Check the internet and try again.</p><button class="primary" onclick="location.reload()">Try again</button></section>'; return; }
  try { sessionStorage.setItem('eq.user', user.id); } catch { /* ignore */ }
  p = fixProgress(store.progress);
  home();
}

// ---------- home ----------
function home() {
  onKey((e) => { if (e.key === 'Enter') mission(); });
  const r = rankOf(p.xp), w = worldOf(p.missionsDone), streak = streakOf(p);
  const pct = r.next ? Math.round(((p.xp - r.xp) / (r.next.xp - r.xp)) * 100) : 100;
  const nodes = Array.from({ length: QUESTS_PER_WORLD }, (_, i) => `<span class="node ${i < w.stop ? 'done' : i === w.stop ? 'here' : ''}">${i < w.stop ? '★' : i === QUESTS_PER_WORLD - 1 ? '👑' : ''}</span>`).join('<span class="path"></span>');
  const worldNo = Math.floor(p.missionsDone / QUESTS_PER_WORLD) % WORLDS.length + 1;
  app.innerHTML = `<section class="screen home">
    <div class="topline">
      <button class="ghost who">${esc(store.user.name)} ⇄</button>
      <div class="chips"><span class="chip" title="Days in a row">🔥 ${streak}</span><button class="chip mute" title="Sound">${isMuted() ? '🔇' : '🔊'}</button><a class="chip" href="#board" title="Progress board">📊</a></div>
    </div>
    <div class="rank">
      <div class="rank-icon">${r.icon}</div>
      <div class="rank-body"><div class="rank-name">${r.name} <small>${p.xp} XP</small></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <small>${r.next ? `${r.next.xp - p.xp} XP to ${r.next.name} ${r.next.icon}` : 'You reached the top rank!'}</small></div>
    </div>
    <div class="world">
      <div class="world-name">${w.icon} World ${worldNo}: ${w.name} <small>quest ${w.stop + 1} of ${QUESTS_PER_WORLD}</small></div>
      <div class="map">${nodes}</div>
    </div>
    <button class="primary big go">Start Quest ⚔️</button>
    <button class="secondary flash">⚡ Lightning Round <small>best: ${p.lightningBest}</small></button>
    ${gradeBox()}
    <div class="badges">${BADGES.map((b) => `<span class="badge ${p.badges.includes(b.id) ? 'got' : ''}" title="${esc(b.name + ': ' + b.desc)}">${b.icon}</span>`).join('')}</div>
    ${hasVoice ? '' : '<p class="online-note">This browser has no English voice, so Spelling is off. Chrome or Edge have one.</p>'}
  </section>`;
  app.querySelector('.go').addEventListener('click', mission);
  app.querySelector('.flash').addEventListener('click', lightning);
  app.querySelector('.mute').addEventListener('click', (e) => { e.target.textContent = toggleMute() ? '🔇' : '🔊'; });
  app.querySelector('.who').addEventListener('click', () => { try { sessionStorage.removeItem('eq.user'); } catch { /* ignore */ } chooser(); });
}

// Where he stands against US grade level, part by part.
function gradeBox() {
  const parts = Object.entries(TRACKS).filter(([t]) => hasVoice || t !== 'spell');
  const there = parts.filter(([t]) => p.levels[t] >= GOAL_LEVEL).length;
  return `<div class="grades"><div class="grades-head">US grade level <small>${there === parts.length ? '🎉 6th grade level or higher in every part!' : `goal: Grade 6 in every part (${there} of ${parts.length} there)`}</small></div>
    <div class="levels">${parts.map(([t, x]) => `<div class="lvl ${p.levels[t] >= GOAL_LEVEL ? 'at-goal' : ''}"><span>${x.icon} ${x.name}</span><span class="grade">${GRADES[p.levels[t]]}${p.levels[t] >= GOAL_LEVEL ? ' ✓' : ''}</span></div>`).join('')}</div></div>`;
}

// ---------- a quest ----------
function mission() {
  const qs = makeMission(p, { speech: hasVoice });
  question({ qs, i: 0, combo: 0, mistakes: 0, gained: 0, correct: 0 });
}

function header(run) {
  return `<div class="qtop">
    <div class="pips">${run.qs.map((q, i) => `<span class="pip ${i < run.i ? 'done' : i === run.i ? 'now' : ''} ${q.boss ? 'boss' : ''}">${q.boss ? '👹' : ''}</span>`).join('')}</div>
    <div class="chips"><span class="chip combo ${run.combo >= 3 ? 'hot' : ''}" title="Combo: 3 in a row = double XP, 6 in a row = triple XP">🔥 x${run.combo >= 6 ? 3 : run.combo >= 3 ? 2 : 1} <small>(${run.combo})</small></span><span class="chip">${run.gained} XP</span><button class="chip quit" title="Quit">✕</button></div>
  </div>`;
}

const optionsHtml = (q) => `<div class="options ${q.options.some((o) => o.length > 22) ? 'long' : ''}">${q.options.map((o, i) =>
  `<button class="option" data-i="${i}"><span class="key">${i + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
const speakBtns = (text) => `<div class="speak"><button class="sound" data-say="${esc(text)}" title="Listen">🔊</button><button class="sound slow" data-say="${esc(text)}" data-slow="1" title="Slowly">🐢</button></div>`;

function body(q) {
  const tag = q.boss ? '<div class="tag boss">👹 BOSS <small>extra hard, worth 50 XP</small></div>'
    : q.revenge ? '<div class="tag revenge">😈 Revenge Question <small>you missed this one before. Beat it now!</small></div>'
    : `<div class="tag">${TRACKS[q.track].icon} ${TRACKS[q.track].name} <span class="lv">${GRADES[q.lv]}</span></div>`;
  if (q.track === 'words' && q.dir === 'def') return `${tag}<p class="prompt">What does this word mean?</p><div class="stem"><div class="word">${esc(q.word.en)}</div>${hasVoice ? speakBtns(q.word.en) : ''}</div>${optionsHtml(q)}`;
  if (q.track === 'words') return `${tag}<p class="prompt">Which word means...</p><div class="stem"><div class="sentence">${esc(q.word.def)}</div></div>${optionsHtml(q)}`;
  if (q.track === 'grammar') return `${tag}<p class="prompt">Complete the sentence</p><div class="stem"><div class="sentence">${esc(q.item.q).replace('___', '<span class="blank"></span>')}</div></div>${optionsHtml(q)}`;
  if (q.track === 'power') return `${tag}<p class="prompt">${esc(TRACKS.power.kinds[q.item.kind] || 'Choose the best answer')}</p><div class="stem"><div class="sentence">${esc(q.item.q).replace('___', '<span class="blank"></span>')}</div></div>${optionsHtml(q)}`;
  if (q.track === 'error') return `${tag}<p class="prompt">Which part has a mistake? (Or is it correct?)</p><div class="stem"><div class="sentence error-sentence">${q.item.parts.map((x, i) => `<span class="part"><u>${esc(x)}</u><b>${'ABCD'[i]}</b></span>`).join(' ')}</div></div>
    <div class="options letters">${q.options.map((o, i) => `<button class="option" data-i="${i}"><span class="key">${i + 1}</span><span>${o}</span></button>`).join('')}</div>`;
  if (q.track === 'spell') return `${tag}<p class="prompt">Listen and type the word</p>
    <div class="stem">${speakBtns(q.word.en)}<div class="meaning">It means: <b>${esc(q.word.def)}</b></div>
    <div class="slots">${[...q.word.en].map(() => '<i></i>').join('')}</div>
    <input class="spell-in" lang="en" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="${q.word.en.length + 4}"></div>
    <div class="nav-row"><button class="ghost hint">Hint 💡</button><button class="primary check">Check</button></div>`;
  if (q.track === 'read') return `${tag}<div class="reading"><article class="text"><h3>${esc(q.text.title)}</h3>${q.text.text.split(/\n\n+/).map((x) => `<p>${esc(x)}</p>`).join('')}</article>
    <div class="rq"><p class="prompt">Question ${q.qi + 1} of 3</p><div class="stem"><div class="sentence small">${esc(q.item.q)}</div></div>${optionsHtml(q)}</div></div>`;
  return '';
}

function question(run) {
  const q = run.qs[run.i];
  if (!q) return finish(run);
  const t0 = Date.now();
  let hinted = false, answered = false;
  scrollTo(0, 0);
  app.innerHTML = `<section class="screen quest ${q.boss ? 'is-boss' : ''}">${header(run)}${body(q)}<div class="below"></div></section>`;
  if (q.boss) sfx('boss');
  app.querySelector('.quit').addEventListener('click', () => { if (confirm('Quit this quest? It will not count.')) home(); });
  app.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => say(b.dataset.say, !!b.dataset.slow)));
  if (q.track === 'spell') setTimeout(() => say(q.word.en), 350);

  const done = (given) => {
    if (answered) return; answered = true;
    const correct = check(q, given);
    run.combo = correct ? run.combo + 1 : 0;
    p.bestCombo = Math.max(p.bestCombo, run.combo);
    const xp = xpFor(q, correct, run.combo, hinted);
    run.gained += xp; if (correct) run.correct++; else run.mistakes++;
    const changed = applyAnswer(p, q, correct);
    log({ questionId: q.id, track: q.track, lv: q.lv, correct, given: String(given).slice(0, 200), ms: Date.now() - t0, boss: !!q.boss, revenge: !!q.revenge, hinted });
    save();
    sfx(correct ? 'good' : 'bad', run.combo);
    if (changed.levelUp) { sfx('level'); toast(`⬆️ Level up! ${TRACKS[changed.levelUp].name}: now ${GRADES[p.levels[changed.levelUp]]}`); }
    if (correct && q.boss) confetti(80);
    feedback(run, q, correct, xp);
  };

  if (q.options) {
    const btns = [...app.querySelectorAll('.option')];
    const pickAt = (i) => {
      if (answered) return;
      const given = q.options[i];
      btns.forEach((b, j) => { b.disabled = true; if (q.options[j] === q.answer) b.classList.add('is-correct'); });
      if (given !== q.answer) btns[i].classList.add('is-wrong');
      done(given);
    };
    btns.forEach((b) => b.addEventListener('click', () => pickAt(+b.dataset.i)));
    onKey((e) => { const n = +e.key; if (n >= 1 && n <= q.options.length) pickAt(n - 1); });
  }
  if (q.track === 'spell') {
    const inp = app.querySelector('.spell-in'), slots = [...app.querySelectorAll('.slots i')];
    const paint = () => slots.forEach((s, i) => { s.textContent = inp.value[i] || ''; s.classList.toggle('full', !!inp.value[i]); });
    inp.addEventListener('input', paint); inp.focus();
    app.querySelector('.hint').addEventListener('click', (e) => { hinted = true; e.target.disabled = true; if (!inp.value.startsWith(q.word.en[0])) inp.value = q.word.en[0]; paint(); inp.focus(); });
    const go = () => { if (!inp.value.trim()) return; inp.disabled = true; app.querySelector('.check').disabled = true; done(inp.value); };
    app.querySelector('.check').addEventListener('click', go);
    onKey((e) => { if (e.key === 'Enter') go(); });
  }
}

function feedback(run, q, correct, xp) {
  const below = app.querySelector('.below');
  const shown = q.track === 'grammar' ? q.item.q.replace('___', q.answer)
    : q.track === 'error' ? (q.item.bad === 4 ? 'No error. The sentence is correct.' : `${q.answer}: "${q.item.parts[q.item.bad]}" should be "${q.item.fix}"`)
    : q.answer;
  const why = q.why && q.track !== 'spell' ? `<p class="why">${esc(q.why)}</p>` : '';
  below.innerHTML = correct
    ? `<div class="feedback good"><div class="burst">${q.boss ? any(BOSS_CHEERS) : any(CHEERS)} <b>+${xp} XP</b></div>${q.track === 'grammar' ? `<p class="big">${esc(shown)}</p>` : ''}${q.track === 'error' || q.track === 'power' ? why : ''}</div>`
    : `<div class="feedback learn"><div class="burst small">${any(ALMOST)} ${q.boss ? 'The boss wins this time 👹' : ''}</div><p>The right answer: <span class="big">${esc(shown)}</span></p>${why}
       ${q.track !== 'read' ? '<p class="later">😈 This question will come back as a Revenge Question</p>' : ''}</div>`;
  below.insertAdjacentHTML('beforeend', `<button class="primary next">${run.i + 1 < run.qs.length ? 'Next →' : 'Finish →'}</button>`);
  if (hasVoice && q.track === 'spell') say(shown);
  const next = () => { run.i++; question(run); };
  below.querySelector('.next').addEventListener('click', next);
  below.querySelector('.next').focus({ preventScroll: true });
  setTimeout(() => onKey((e) => { if (e.key === 'Enter') next(); }), 250);
  below.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function finish(run) {
  const res = finishMission(p, run.mistakes, run.gained);
  save();
  log({ kind: 'mission', questionId: 'mission', track: 'mission', correct: run.mistakes === 0, given: `${run.correct}/${run.qs.length}`, xp: run.gained + res.bonus });
  const medal = medalFor(run.mistakes), m = { gold: '🥇', silver: '🥈', bronze: '🥉' }[medal];
  sfx('win'); confetti(medal === 'gold' ? 200 : 100);
  const next = worldOf(p.missionsDone);
  app.innerHTML = `<section class="screen center done">
    <div class="medal">${m}</div>
    <h1>${run.mistakes === 0 ? 'PERFECT QUEST!' : 'Quest complete!'}</h1>
    <p class="sub">${run.correct} of ${run.qs.length} correct</p>
    <div class="xp-total">+${run.gained + res.bonus} XP <small>${run.gained} from answers + ${res.bonus} finish bonus${run.mistakes === 0 ? ' (with 50 for a perfect quest)' : ''}</small></div>
    ${res.rankUp ? `<div class="rankup">${res.rankUp.icon} New rank: <b>${res.rankUp.name}</b></div>` : ''}
    ${res.worldDone ? `<div class="rankup">🗺️ World cleared! Next: ${next.icon} ${next.name}</div>` : ''}
    ${res.newBadges.map((b) => `<div class="newbadge">${b.icon} New badge: ${b.name} <small>${esc(b.desc)}</small></div>`).join('')}
    <div class="nav-row"><button class="primary again">Next Quest ⚔️</button><button class="secondary flash">⚡ Lightning Round</button><button class="ghost home-btn">Home</button></div>
  </section>`;
  app.querySelector('.again').addEventListener('click', mission);
  app.querySelector('.flash').addEventListener('click', lightning);
  app.querySelector('.home-btn').addEventListener('click', home);
  onKey((e) => { if (e.key === 'Enter') home(); });
}

// ---------- lightning round: 60 seconds of word meanings ----------
function lightning() {
  let score = 0, streak = 0, q = null, end = 0, timer = null, locked = false;
  app.innerHTML = `<section class="screen center flashround"><h1>⚡ Lightning Round</h1>
    <p class="sub">60 seconds. How many words can you get? A mistake costs 3 seconds. 5 in a row = double points.</p><p class="sub">Your best: <b>${p.lightningBest}</b></p>
    <button class="primary big">Go!</button></section>`;
  app.querySelector('.primary').addEventListener('click', run);
  onKey((e) => { if (e.key === 'Enter') run(); });
  function run() {
    end = Date.now() + 60000;
    app.innerHTML = `<section class="screen flashround"><div class="qtop"><div class="timer"><i></i></div><span class="chip score">0</span></div>
      <div class="stem"><div class="word"></div></div><div class="options long"></div></section>`;
    timer = setInterval(tick, 100); next();
  }
  function tick() {
    const left = end - Date.now();
    const bar = app.querySelector('.timer i'); if (!bar) return clearInterval(timer);
    bar.style.width = Math.max(0, left / 600) + '%'; bar.classList.toggle('low', left < 10000);
    if (left <= 0) { clearInterval(timer); over(); }
  }
  function next() {
    q = lightningQuestion(p, q && q.id); locked = false;
    app.querySelector('.word').textContent = q.word.en;
    const box = app.querySelector('.options');
    box.innerHTML = q.options.map((o, i) => `<button class="option" data-i="${i}"><span class="key">${i + 1}</span><span>${esc(o)}</span></button>`).join('');
    box.querySelectorAll('.option').forEach((b) => b.addEventListener('click', () => answer(+b.dataset.i)));
    onKey((e) => { const n = +e.key; if (n >= 1 && n <= 4) answer(n - 1); });
  }
  function answer(i) {
    if (locked || Date.now() > end) return; locked = true;
    const btns = app.querySelectorAll('.option'), ok = q.options[i] === q.answer;
    btns.forEach((b, j) => { if (q.options[j] === q.answer) b.classList.add('is-correct'); });
    log({ questionId: q.id, track: 'words', lv: q.lv, correct: ok, given: q.options[i], lightning: true });
    if (ok) { streak++; score += streak >= 5 ? 2 : 1; sfx('good', streak); }
    else { streak = 0; btns[i].classList.add('is-wrong'); end -= 3000; sfx('bad'); const s = app.querySelector('.flashround'); s.classList.add('shake'); setTimeout(() => s.classList.remove('shake'), 300); }
    app.querySelector('.score').innerHTML = `${score}${streak >= 5 ? ' <small>🔥x2</small>' : ''}`;
    setTimeout(next, ok ? 250 : 1100);
  }
  function over() {
    const record = score > p.lightningBest;
    if (record) p.lightningBest = score;
    p.xp += score * 3;
    if (!p.days.includes(today())) p.days.push(today());
    const badges = awardBadges(p); save();
    sfx('win'); if (record) confetti(160);
    app.innerHTML = `<section class="screen center done"><div class="medal">⚡</div><h1>${score} points</h1>
      <p class="sub">${record ? '🏆 New record!' : `Your best: ${p.lightningBest}`}</p><div class="xp-total">+${score * 3} XP</div>
      ${badges.map((b) => `<div class="newbadge">${b.icon} New badge: ${b.name} <small>${esc(b.desc)}</small></div>`).join('')}
      <div class="nav-row"><button class="primary again">Play again ⚡</button><button class="ghost home-btn">Home</button></div></section>`;
    app.querySelector('.again').addEventListener('click', lightning);
    app.querySelector('.home-btn').addEventListener('click', home);
    onKey(null);
  }
}

// ---------- routing ----------
async function route() {
  if (location.hash === '#board') { onKey(null); return renderBoard(app); }
  if (store) return home();
  return chooser();
}
window.addEventListener('hashchange', route);
speechReady().then((ok) => { hasVoice = ok; });
hasVoice = await Promise.race([speechReady(), new Promise((r) => setTimeout(() => r(false), 1600))]);
route();
