// The only place that knows where data lives (same design as the riddles app, ariel1w.github.io/hidot):
//   cloud    progress is saved online BY NAME (no logins), so the same name continues on any device. The database role
//            the site uses can only call the functions in db/setup.sql. A copy stays in this browser, so a dropped
//            connection loses nothing.
//   browser  only if the online save was never reachable on this device: everything stays in this browser.
// A record that could not be saved is never dropped: it waits in a queue kept in browser storage and is retried
// on the next save, every 20 seconds, and the next time the profile opens.
import { CLOUD } from './cloud-config.js';

const readLocal = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const writeLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

let mode = 'cloud';
const uKey = (id, part) => `eq.u.${id}.${part}`;
const cKey = (id, part) => `eq.c.${id}.${part}`;

export async function cloud(fn, ...args) {
  const params = args.map((a) => (a !== null && typeof a === 'object' ? JSON.stringify(a) : a));
  const list = params.map((p, i) => `$${i + 1}` + (args[i] !== null && typeof args[i] === 'object' ? '::jsonb' : '')).join(', ');
  const r = await fetch(`https://${CLOUD.host}/sql`, {
    method: 'POST', headers: { 'Neon-Connection-String': CLOUD.conn }, // no Content-Type: the database's CORS rules do not list it
    body: JSON.stringify({ query: `select eng.${fn}(${list}) as v`, params }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.message || 'online save answered ' + r.status);
  return out.rows[0].v;
}

export async function listUsers() {
  try {
    mode = 'cloud';
    const users = await cloud('players');
    writeLocal('eq.c.players', users);
    return { users, cloud: true };
  } catch {
    const cached = readLocal('eq.c.players', null);
    if (cached) return { users: cached, cloud: true, offline: true };
    mode = 'browser'; return { users: readLocal('eq.users', []) };
  }
}
export async function createUser(name) {
  if (mode === 'cloud') return cloud('join', name); // an existing name simply opens that player's progress
  const user = { id: 'u' + Date.now().toString(36), name: String(name).trim().slice(0, 30), createdAt: new Date().toISOString() };
  if (!writeLocal('eq.users', [...readLocal('eq.users', []), user])) throw new Error('browser storage is blocked');
  return user;
}
export const loadBoard = () => cloud('board');
export const loadBoardDetail = (id) => cloud('board_detail', id);

export function makeQueue(backend, initial, persist) {
  const q = {
    unsent: initial.slice(), lastError: null, lastSaved: null, onChange: null, running: null, again: false,
    push(job) {
      if (job.kind === 'progress') q.unsent = q.unsent.filter((j) => j.kind !== 'progress' || j === q.inFlight); // only the newest progress matters
      q.unsent.push(job); persist(q.unsent);
      return q.flush();
    },
    flush() {
      if (q.running) { q.again = true; return q.running; }
      q.running = (async () => {
        do {
          q.again = false;
          while (q.unsent.length) {
            const job = q.unsent[0];
            q.inFlight = job;
            try {
              const out = job.kind === 'progress' ? await backend.saveProgress(job.payload) : await backend.log(job.payload);
              q.lastSaved = out.lastSaved; q.lastError = null;
              q.unsent = q.unsent.filter((j) => j !== job); persist(q.unsent);
            } catch (e) { q.lastError = String(e.message || e); q.again = false; break; } finally { q.inFlight = null; }
          }
        } while (q.again);
      })().finally(() => { q.running = null; if (q.onChange) q.onChange(); });
      return q.running;
    },
  };
  return q;
}

export async function openStore(user) {
  const queueKey = cKey(user.id, 'unsent');
  const backend = mode === 'cloud' ? {
    async load() {
      try {
        const state = await cloud('load', user.id);
        if (!state) throw new Error('no such player online');
        writeLocal(cKey(user.id, 'progress'), state.progress);
        return state;
      } catch (e) {
        const progress = readLocal(cKey(user.id, 'progress'), undefined);
        if (progress === undefined) throw e;
        return { progress };
      }
    },
    log: async (record) => ({ lastSaved: await cloud('log', user.id, record) }),
    saveProgress: async (progress) => { writeLocal(cKey(user.id, 'progress'), progress); return { lastSaved: await cloud('save_progress', user.id, progress) }; },
  } : {
    async load() { return { progress: readLocal(uKey(user.id, 'progress'), null) }; },
    async log(record) {
      const all = readLocal(uKey(user.id, 'records'), []); all.push(record);
      if (!writeLocal(uKey(user.id, 'records'), all.slice(-3000))) throw new Error('browser storage is full or blocked');
      return { lastSaved: new Date().toISOString() };
    },
    async saveProgress(progress) {
      if (!writeLocal(uKey(user.id, 'progress'), progress)) throw new Error('browser storage is full or blocked');
      return { lastSaved: new Date().toISOString() };
    },
  };

  const state = await backend.load();
  const queue = makeQueue(backend, readLocal(queueKey, []), (jobs) => writeLocal(queueKey, jobs));
  // A progress save that never reached the server is newer than what the server sent back.
  const pending = [...queue.unsent].reverse().find((j) => j.kind === 'progress');
  const store = {
    user, mode, progress: pending ? pending.payload : state.progress,
    get saveFailed() { return queue.unsent.length > 0 && !queue.running; },
    log(record) { return queue.push({ kind: 'log', payload: record }); },
    saveProgress(progress) { this.progress = progress; return queue.push({ kind: 'progress', payload: JSON.parse(JSON.stringify(progress)) }); },
  };
  if (queue.unsent.length) queue.flush();
  setInterval(() => { if (queue.unsent.length) queue.flush(); }, 20000);
  return store;
}
