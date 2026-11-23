import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname; // 저장소 루트 기준 상대경로
const PORT = 8349;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff' };
const server = http.createServer(async (req, res) => { try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html'; const d = await readFile(path.join(ROOT, p)); res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); } catch { res.writeHead(404); res.end('nf'); } });
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9449', `--user-data-dir=/tmp/vt3g2-prof-${process.pid}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=800,900', `http://127.0.0.1:${PORT}/verify.html?dbg=1&fast=1&noauto=1`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500); try { const l = await (await fetch('http://127.0.0.1:9449/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
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
// 강제조건 통합시험(시험 전용): 제어된 근접/소유 + 실제 J입력 → 엔진 스틸 → 화면 표시
const cntAndShoot = async (text, file, ms) => { let n = 0, was = false; const t0 = Date.now(); while (Date.now() - t0 < ms) { const b = await ev('document.body.textContent'); const has = b.includes(text); if (has && !was) { n++; await shot(file); } was = has; await sleep(80); } return n; };
// 1) 헛태클 플래시 가시 시점 캡처(자연 입력, RNG 0.99)
{
  let h = null; const t0 = Date.now();
  while (Date.now() - t0 < 45000) { h = await hu(); if (h && h.state === 'play' && h.owner >= 7) break; await sleep(200); h = null; }
  if (h) {
    await ev('Math.random = () => 0.99; 0');
    await key('keydown', 'j');
    for (let i = 0; i < 40; i++) { const g = await hu(); if (g && g.lng > 0.02) break; await sleep(60); }
    await key('keyup', 'j');
    out.P2_flashes = await cntAndShoot('태클이 빗나갔다', '/tmp/vt3g-whiff.png', 6000);
  } else out.P2 = 'skip';
}
await sleep(1500);
// 2) 강제 근접/소유 + J → 스틸 → 성공 플래시
{
  const setup = await ev(`(() => { const m = window.__m; if (!m) return 'no __m'; const hu = m.players[m.humanId];
    const opp = m.players.find(p => p.team === 1 && p.role !== 'GK');
    opp.x = hu.x + 0.8; opp.z = hu.z; opp.vx = 0; opp.vz = 0; opp.stun = 0; opp.lunge = 0; opp.kick = null; opp.think = 9;
    m.ball.owner = opp; m.ball.x = opp.x; m.ball.z = opp.z; m.ball.y = 0; m.ball.vx = 0; m.ball.vz = 0; m.ball.vy = 0;
    Math.random = () => 0.01;
    return opp.id; })()`);
  out.S_setup = setup;
  if (typeof setup === 'number') {
    const tk0 = (await hu())?.tk ?? 0;
    await key('keydown', 'j');
    let lunged = false;
    for (let i = 0; i < 40; i++) { const g = await hu(); if (g && g.lng > 0.02) { lunged = true; break; } await sleep(60); }
    await key('keyup', 'j');
    const n = await cntAndShoot('빼앗았다', '/tmp/vt3g-steal.png', 6000);
    const g2 = await hu();
    out.S = { lunged, flashes: n, tkBefore: tk0, tkAfter: g2 ? g2.tk : null };
  }
}
console.log(JSON.stringify(out));
ws.close(); chrome.kill(); server.close(); process.exit(0);
