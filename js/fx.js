// Sound effects (synthesised, no files), English speech (the browser's own voices) and confetti.

let ctx = null, muted = false;
try { muted = localStorage.getItem('eq.muted') === '1'; } catch { /* private window */ }
export const isMuted = () => muted;
export function toggleMute() { muted = !muted; try { localStorage.setItem('eq.muted', muted ? '1' : '0'); } catch { /* ignore */ } return muted; }

function tone(freq, start, dur, type = 'sine', vol = 0.18, slide = 0) {
  const t = ctx.currentTime + start, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
export function sfx(name, combo = 0) {
  if (muted) return;
  try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  const up = Math.min(combo, 10) * 40;
  if (name === 'good') { tone(520 + up, 0, 0.12, 'triangle'); tone(780 + up, 0.08, 0.18, 'triangle'); }
  if (name === 'bad') { tone(220, 0, 0.25, 'sawtooth', 0.08, 0.6); }
  if (name === 'tap') tone(660, 0, 0.05, 'square', 0.05);
  if (name === 'boss') { [196, 185, 175, 165].forEach((f, i) => tone(f, i * 0.18, 0.2, 'sawtooth', 0.09)); }
  if (name === 'win') { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.16)); }
  if (name === 'level') { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.2, 'square', 0.07)); }
  if (name === 'tick') tone(1200, 0, 0.03, 'square', 0.04);
}

// ---------- speech ----------
let voice = null;
function findVoice() {
  if (!('speechSynthesis' in window)) return null;
  const all = speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
  const rank = (v) => (/google us english/i.test(v.name) ? 0 : /(aria|jenny|guy|natural)/i.test(v.name) ? 1 : /en[-_]us/i.test(v.lang) ? 2 : /en[-_]gb/i.test(v.lang) ? 3 : 4);
  return all.sort((a, b) => rank(a) - rank(b))[0] || null;
}
export function speechReady() {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve(false);
    voice = findVoice(); if (voice) return resolve(true);
    const done = () => { voice = findVoice(); resolve(!!voice); };
    speechSynthesis.addEventListener?.('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}
export function say(text, slow = false) {
  if (!voice) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice; u.lang = voice.lang; u.rate = slow ? 0.62 : 0.92;
  speechSynthesis.speak(u);
}

// ---------- confetti ----------
export function confetti(amount = 120) {
  const c = document.createElement('canvas'); c.className = 'confetti';
  c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  const g = c.getContext('2d'), colors = ['#f4a261', '#2a9d8f', '#e76f51', '#7b5cff', '#ffd23f', '#3ec1d3'];
  const bits = Array.from({ length: amount }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 16 - 4, r: Math.random() * 6.28, s: 6 + Math.random() * 7, c: colors[Math.floor(Math.random() * colors.length)] }));
  let f = 0;
  (function frame() {
    g.clearRect(0, 0, c.width, c.height);
    for (const b of bits) { b.vy += 0.45; b.x += b.vx; b.y += b.vy; b.r += 0.2; g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.fillStyle = b.c; g.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); g.restore(); }
    if (f++ < 150) requestAnimationFrame(frame); else c.remove();
  })();
}
