import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname; // 저장소 루트 기준 상대경로
const PORT = 8348;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff' };
const server = http.createServer(async (req, res) => { try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html'; const d = await readFile(path.join(ROOT, p)); res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); } catch { res.writeHead(404); res.end('nf'); } });
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9448', `--user-data-dir=/tmp/vt3i2-prof-${process.pid}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=800,900', `http://127.0.0.1:${PORT}/verify.html?dbg=1&fast=1&noauto=1&case=pro`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500); try { const l = await (await fetch('http://127.0.0.1:9448/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
const key = (type, k) => ev(`window.dispatchEvent(new KeyboardEvent('${type}', { key: '${k}', bubbles: true }))`);
const hu = async () => { const s = await ev('window.__hu ? JSON.stringify(window.__hu) : null'); return s ? JSON.parse(s) : null; };
const shot = async (f) => { const r = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(f, Buffer.from(r.result.data, 'base64')); };
const out = { inMatch: false };
for (let i = 0; i < 25 && !out.inMatch; i++) { await ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent.includes('직접 뛰기')); if (b) { b.click(); return 1; } return 0; })()`); await sleep(1200); out.inMatch = !!(await hu()); }
// vt3i: 결정적 전환 시나리오 (case=pro). A런지→캐리어를 B 옆으로 텔레포트→L전환→A헛태클1 확인→B런지 스틸→성공1
const cntT2 = async (text, ms) => { let n = 0, was = false; const t0 = Date.now(); while (Date.now() - t0 < ms) { const b = await ev('document.body.textContent'); const has = b.includes(text); if (has && !was) n++; was = has; await sleep(80); } return n; };
{
  let h = null; const t0 = Date.now();
  while (Date.now() - t0 < 45000) { h = await hu(); if (h && h.state === 'play' && h.owner >= 7) break; await sleep(200); h = null; }
  if (!h) out.skip = true;
  else {
    const hidA = h.hid;
    // 캐리어를 A에서 2.5m, 다른 아군 B에서 0.6m가 되게 배치
    const setup = await ev(`(() => { const m = window.__m; const A = m.players[m.humanId];
      const B = m.players.find(p => p.team === 0 && p.id !== m.humanId && p.role !== 'GK');
      const opp = m.players.find(p => p.team === 1 && p.role !== 'GK');
      B.x = A.x + 1.9; B.z = A.z; B.vx = 0; B.vz = 0;
      opp.x = B.x + 0.6; opp.z = B.z; opp.vx = 0; opp.vz = 0; opp.stun = 0; opp.lunge = 0; opp.kick = null; opp.think = 9; for (let i = 0; i < m.players.length; i++) { const q = m.players[i]; if (q.team === 0 && q !== A && q !== B && q.role !== 'GK') { q.x = opp.x + 14; q.z = opp.z + ((i % 5) - 2) * 3; q.vx = 0; q.vz = 0; q.think = 9; } }
      m.switchCd = 0; m.ball.owner = opp; m.ball.x = opp.x; m.ball.z = opp.z; m.ball.y = 0; m.ball.vx = 0; m.ball.vz = 0; m.ball.vy = 0;
      const pins = [A, opp, ...m.players.filter(q => q.team === 0 && q !== A && q !== B && q.role !== 'GK')].map(q => ({ q, x: q.x, z: q.z }));
      window.__pin = setInterval(() => { const mm = window.__m; if (!mm) return; for (const r of pins) { r.q.x = r.x; r.q.z = r.z; r.q.vx = 0; r.q.vz = 0; } if (mm.ball.owner === opp) { mm.ball.x = opp.x; mm.ball.z = opp.z; mm.ball.vx = 0; mm.ball.vz = 0; } }, 150);
      Math.random = () => 0.99; return { A: m.humanId, B: B.id, opp: opp.id, dAOpp: Math.hypot(opp.x - A.x, opp.z - A.z) }; })()`);
    out.setup = setup;
    await key('keydown', 'j');
    let aLunged = false;
    for (let i = 0; i < 40; i++) { const g = await hu(); if (g && g.hid === hidA && g.lng > 0.02) { aLunged = true; break; } await sleep(60); }
    await key('keyup', 'j');
    await key('keydown', 'l'); await sleep(70); await key('keyup', 'l');
    let hid1 = null;
    for (let i = 0; i < 30; i++) { const g = await hu(); if (g && g.hid !== hidA) { hid1 = g.hid; break; } await sleep(120); }
    if (hid1 === null) hid1 = (await hu())?.hid;
    // A 런지 활성 동안 조기 표시 감시
    let premature = 0;
    for (let i = 0; i < 25; i++) { const g = await hu(); if (!g) break; const b = await ev('document.body.textContent'); if (b.includes('태클이 빗나갔다')) { const aL = await ev('window.__m.players[' + hidA + '].lunge'); if (aL > 0.02) premature++; else break; } await sleep(60); }
    // A 종료 후 헛태클 정확히 1
    const w = await cntT2('태클이 빗나갔다', 4000);
    // B로 전환됐으면 B 런지 → 스틸
    let c3 = null; let c3trace = null;
    if (hid1 !== hidA) {
      await ev('Math.random = () => 0.01; 0');
      const tk0 = (await hu())?.tk ?? 0;
      await key('keydown', 'j');
      let bLunged = false; const trace = [];
      for (let i = 0; i < 40; i++) { const g = await hu(); if (i % 5 === 0) trace.push(g ? [g.state, g.hid, Math.round(g.lng * 100) / 100, g.owner] : null); if (g && g.hid === hid1 && g.lng > 0.02) { bLunged = true; break; } await sleep(60); }
      await key('keyup', 'j');
      c3trace = trace;
      const sN = await cntT2('빼앗았다', 5000);
      const g3 = await hu();
      c3 = { hid1, bLunged, steal: sN, tkBefore: tk0, tkAfter: g3 ? g3.tk : null, trace: c3trace };
    }
    out.C2 = { aLunged, hidA, hid1, premature, whiff: w };
    out.C3 = c3;
  }
}
try { clearInterval(window.__pin); } catch {}
console.log(JSON.stringify(out));
ws.close(); chrome.kill(); server.close(); process.exit(0);
