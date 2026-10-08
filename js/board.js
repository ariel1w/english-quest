import { loadBoard, loadBoardDetail } from './storage.js';
import { TRACKS, GRADES, rankOf } from './engine.js';

// The progress board: every name in one table, worked out from the saved answers. Tap a row for the answers per part.
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '-');
function ago(ts) {
  if (!ts) return 'not yet';
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(Number(ts)).setHours(0, 0, 0, 0)) / 86400000);
  const time = new Date(Number(ts)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return days <= 0 ? 'today ' + time : days === 1 ? 'yesterday ' + time : `${days} days ago`;
}

export async function renderBoard(app) {
  app.innerHTML = '<section class="parent board"><div class="p-head"><h1>Progress board</h1><a href="#">Back</a></div><p class="p-note">Loading...</p></section>';
  let rows;
  try { rows = await loadBoard(); }
  catch { app.querySelector('.p-note').textContent = "Couldn't load the board. Check the internet and try again."; return; }
  const body = rows.map((r) => `<tr class="b-row" data-id="${esc(r.id)}">
      <td><b>${esc(r.name)}</b></td><td>${rankOf(r.xp).icon} ${r.xp}</td><td>${r.missions}</td><td>${r.answered}</td><td>${pct(r.correct, r.answered)}</td>
      <td>${r.week ? `${r.week} <small>(${pct(r.week_correct, r.week)})</small>` : '-'}</td><td>${r.days}</td><td>⚡ ${r.lightning}</td><td>${ago(r.last_played)}</td>
      <td class="lv">${r.levels ? Object.entries(r.levels).map(([k, v]) => `${TRACKS[k]?.name || k}: ${GRADES[v] || v}`).join(' · ') : '-'}</td></tr>
    <tr class="b-detail" hidden><td colspan="10"></td></tr>`).join('');
  app.querySelector('.board').innerHTML = `<div class="p-head"><h1>Progress board</h1><a href="#">Back</a></div>
    <p class="p-note">Every player on the site. Click a row for results per part. "This week" = the last 7 days. Grade levels: Grade 5 up to Grade 8. The goal is Grade 6 in every part.</p>
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>XP</th><th>Quests</th><th>Answers</th><th>Correct</th><th>This week</th><th>Days played</th><th>Lightning best</th><th>Last played</th><th>US grade per part</th></tr></thead>
    <tbody>${body || '<tr><td colspan="10">No players yet.</td></tr>'}</tbody></table></div>`;
  app.querySelectorAll('.b-row').forEach((tr) => tr.addEventListener('click', async () => {
    const detail = tr.nextElementSibling;
    detail.hidden = !detail.hidden;
    if (detail.hidden || detail.dataset.loaded) return;
    const cell = detail.firstElementChild;
    cell.textContent = 'Loading...';
    try {
      const parts = (await loadBoardDetail(tr.dataset.id)).filter((x) => TRACKS[x.category]);
      cell.innerHTML = parts.length ? parts.map((x) => `${TRACKS[x.category].icon} ${TRACKS[x.category].name}: ${x.correct}/${x.answered} (${pct(x.correct, x.answered)})`).join(' · ') : 'No answers yet.';
      detail.dataset.loaded = '1';
    } catch { cell.textContent = "Couldn't load."; }
  }));
}
