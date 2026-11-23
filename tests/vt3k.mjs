import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname; // 저장소 루트 기준 상대경로
const PORT = 8351;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff' };
const server = http.createServer(async (req, res) => { try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html'; const d = await readFile(path.join(ROOT, p)); res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); } catch { res.writeHead(404); res.end('nf'); } });
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9451', `--user-data-dir=/tmp/vt3k-prof-${process.pid}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=800,900', `http://127.0.0.1:${PORT}/verify.html?dbg=1&fast=1&noauto=1&case=pro`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500); try { const l = await (await fetch('http://127.0.0.1:9451/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
const key = (type, k) => ev(`window.dispatchEvent(new KeyboardEvent('${type}', { key: '${k}', bubbles: true }))`);
const hu = async () => { const s = await ev('window.__hu ? JSON.stringify(window.__hu) : null'); return s ? JSON.parse(s) : null; };
const out = { inMatch: false };
for (let i = 0; i < 25 && !out.inMatch; i++) { await ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent.includes('직접 뛰기')); if (b) { b.click(); return 1; } return 0; })()`); await sleep(1200); out.inMatch = !!(await hu()); }
// vt3k: 겹친 경로 — A 런지 "중" L 전환 → B 즉시 J (A 런지 활성 상태에서 B 시도 시작)
{
  let h = null; const t0 = Date.now();
  while (Date.now() - t0 < 45000) { h = await hu(); if (h && h.state === 'play' && h.owner >= 7) break; await sleep(200); h = null; }
  if (!h) out.skip = true;
  else {
    const hidA = h.hid;
    const setup = await ev(`(() => { const m = window.__m; const A = m.players[m.humanId];
      const B = m.players.find(p => p.team === 0 && p.id !== m.humanId && p.role !== 'GK');
      const opp = m.players.find(p => p.team === 1 && p.role !== 'GK');
      B.x = A.x + 1.9; B.z = A.z; B.vx = 0; B.vz = 0;
      opp.x = B.x + 0.6; opp.z = B.z; opp.vx = 0; opp.vz = 0; opp.stun = 0; opp.lunge = 0; opp.kick = null; opp.think = 9;
      for (let i = 0; i < m.players.length; i++) { const q = m.players[i]; if (q.team === 0 && q !== A && q !== B && q.role !== 'GK') { q.x = opp.x + 14; q.z = opp.z + ((i % 5) - 2) * 3; q.vx = 0; q.vz = 0; q.think = 9; } }
      m.switchCd = 0; m.ball.owner = opp; m.ball.x = opp.x; m.ball.z = opp.z; m.ball.y = 0; m.ball.vx = 0; m.ball.vz = 0; m.ball.vy = 0;
      const pins = [A, opp, ...m.players.filter(q => q.team === 0 && q !== A && q !== B && q.role !== 'GK')].map(q => ({ q, x: q.x, z: q.z }));
      window.__pin = setInterval(() => { const mm = window.__m; if (!mm) return; for (const r of pins) { r.q.x = r.x; r.q.z = r.z; r.q.vx = 0; r.q.vz = 0; } if (mm.ball.owner === opp) { mm.ball.x = opp.x; mm.ball.z = opp.z; mm.ball.vx = 0; mm.ball.vz = 0; } }, 150);
      Math.random = () => 0.99; return { A: m.humanId, B: B.id, opp: opp.id }; })()`);
    out.setup = setup;
    await key('keydown', 'j');
    let aLunged = false;
    for (let i = 0; i < 40; i++) { const g = await hu(); if (g && g.hid === hidA && g.lng > 0.02) { aLunged = true; break; } await sleep(60); }
    await key('keyup', 'j');
    if (aLunged) await ev('window.__m.players[' + hidA + '].lunge = 1.0; 0'); // 하네스: 겹침 창 확보용 A 런지 연장
    await key('keydown', 'l'); await sleep(70); await key('keyup', 'l');
    let hid1 = null;
    for (let i = 0; i < 25; i++) { const g = await hu(); if (g && g.hid !== hidA) { hid1 = g.hid; break; } await sleep(100); }
    // B 즉시 J — 이 순간 A 런지가 살아있어야 겹침 성립
    const atPress = await ev('JSON.stringify({hid: window.__m.humanId, aLng: Math.round(window.__m.players[' + hidA + '].lunge*100)/100})');
    await key('keydown', 'j');
    let bLunged = false;
    for (let i = 0; i < 40; i++) { const g = await hu(); if (g && hid1 !== null && g.hid === hid1 && g.lng > 0.02) { bLunged = true; break; } await sleep(60); }
    await key('keyup', 'j');
    if (bLunged) await ev('Math.random = () => 0.01; 0');
    // 종료 관측: 두 토스트를 같은 창에서 병렬 계수
    let whiff = 0, steal = 0, wWas = false, sWas = false; const t1 = Date.now();
    while (Date.now() - t1 < 7000) { const b = await ev('document.body.textContent'); const w = b.includes('태클이 빗나갔다'); const s = b.includes('빼앗았다'); if (w && !wWas) whiff++; if (s && !sWas) steal++; wWas = w; sWas = s; await sleep(80); }
    const g3 = await hu();
    out.O = { aLunged, hidA, hid1, atPress: JSON.parse(atPress || '{}'), bLunged, whiff, steal, tk: g3 ? g3.tk : null };
  }
}
try { await ev('clearInterval(window.__pin); 0'); } catch {}
console.log(JSON.stringify(out));
ws.close(); chrome.kill(); server.close(); process.exit(0);
