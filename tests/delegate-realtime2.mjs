// node tests/delegate-realtime2.mjs — 실속도(fast=1) 위임 2차: 강제조건으로 슛/스틸 유발 + 수정 좌표 수동 복귀. 사람 플레이 아님.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8181;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const tag = String(Date.now());
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9292', `--user-data-dir=/tmp/delrt2-${tag}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=1`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9292/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
const tDownUp = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 2 }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const HU = 'JSON.stringify(window.__hu || null)';
const out = {};

let started = false;
for (let i = 0; i < 60 && !started; i++) {
    const c = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('훈련 없이 경기 시작')); if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
    if (c) { await tDownUp(c[0], c[1]); await sleep(800); started = !!(await ev(HU)); } else await sleep(500);
}
if (!started) { console.log('no-start'); chrome.kill(); server.close(); process.exit(1); }
for (let i = 0; i < 60; i++) { const s = await ev('window.__hu && window.__hu.state'); if (s === 'play') break; await sleep(500); }
const tgl = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'') === '자동'); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
await tDownUp(tgl[0], tgl[1]); await sleep(500);
out.dgOn = JSON.parse(await ev(HU)).dg === 1;

// 강제조건 A: 인간에게 공 소유 + 골문(z=0) 앞 10m 배치 → 차지 슛 기대
await ev(`(() => { const m = window.__m; const H = m.players[m.humanId]; H.x = 18; H.z = 10; m.ball.x = 18; m.ball.z = 10; m.ball.y = 0; m.ball.vx = 0; m.ball.vz = 0; m.ball.vy = 0; m.ball.owner = H; return 1; })()`);
let shot = null;
for (let i = 0; i < 20 && !shot; i++) { await sleep(1000); const h = JSON.parse(await ev(HU)); if (h.sh > 0) shot = { afterWallSec: i + 1, sh: h.sh, chgSeen: h.chg }; }
out.forcedShot = shot;

// 강제조건 B: 상대가 공 소유 + 인간 근접(1.2m) → 스틸(패스 버튼 입력) 기대
await ev(`(() => { const m = window.__m; const H = m.players[m.humanId]; const o = m.players.find(p => p.team === 1 && p.role !== 'GK'); H.x = 18; H.z = 30; o.x = 18.6; o.z = 30.6; m.ball.x = o.x; m.ball.z = o.z; m.ball.y = 0; m.ball.vx = 0; m.ball.vz = 0; m.ball.owner = o; return 1; })()`);
let steal = null;
for (let i = 0; i < 15 && !steal; i++) { await sleep(1000); const h = JSON.parse(await ev(HU)); if (h.tk > 0 || h.lng) steal = { afterWallSec: i + 1, tk: h.tk, lunge: h.lng, owner: h.owner, hid: h.hid }; }
out.forcedSteal = steal;

// 수동 복귀: 버튼 영역을 피한 캔버스 중앙좌(400,500)→위로 드래그 유지
const tgl2 = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'') === '수동'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
if (tgl2) {
    await tDownUp(tgl2[0], tgl2[1]); await sleep(500);
    const m0 = JSON.parse(await ev(HU));
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 400, y: 500, id: 3 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 400, y: 330, id: 3 }] });
    await sleep(3000);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const m1 = JSON.parse(await ev(HU));
    out.manual = { state: m1.state, dgOff: m1.dg === 0, dx: Math.round((m1.x - m0.x) * 100) / 100, dz: Math.round((m1.z - m0.z) * 100) / 100, moved: Math.hypot(m1.x - m0.x, m1.z - m0.z) > 0.5 };
}
out.ok = !!(out.dgOn && out.forcedShot && out.forcedSteal && out.manual && out.manual.dgOff && out.manual.moved);
console.log(JSON.stringify(out));
chrome.kill(); server.close();
