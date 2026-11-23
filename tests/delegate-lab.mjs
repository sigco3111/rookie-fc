// node tests/delegate-lab.mjs — 경기 중 위임(자동 플레이) 시험. 강제조건 회귀 신호(사람 플레이 아님).
// 검증: 토글 ON → __hu.dg=1·정책이 이동/슛 입력, 토글 OFF → dg=0·수동 복귀. 와이드(16:9) 뷰포트에서 캔버스 비율·크기.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8177;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const tag = String(Date.now());
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9288', `--user-data-dir=/tmp/dellab-${tag}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=1`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9288/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
const tDownUp = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 2 }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const out = {};

let started = false;
for (let i = 0; i < 60 && !started; i++) {
    const c = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('훈련 없이 경기 시작')); if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
    if (c) { await tDownUp(c[0], c[1]); await sleep(800); started = !!(await ev('JSON.stringify(window.__hu || null)')); } else await sleep(500);
}
if (!started) { console.log('no-start'); chrome.kill(); server.close(); process.exit(1); }
for (let i = 0; i < 60; i++) { const s = await ev('window.__hu && window.__hu.state'); if (s === 'play') break; await sleep(500); }
await sleep(1500);
out.wide = JSON.parse(await ev(`(() => { const c = document.querySelector('canvas'); return JSON.stringify({ vw: innerWidth, vh: innerHeight, cw: c ? c.width : 0, ch: c ? c.height : 0, aspect: c ? Math.round(c.width / c.height * 100) / 100 : 0 }) })()`));

// 위임 ON
const tgl = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'') === '자동'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
if (!tgl) { out.toggleFound = false; console.log(JSON.stringify(out)); chrome.kill(); server.close(); process.exit(1); }
await tDownUp(tgl[0], tgl[1]);
await sleep(600);
const p0 = JSON.parse(await ev('JSON.stringify({x: window.__hu.x, z: window.__hu.z, dg: window.__hu.dg, sh: window.__hu.sh})'));
await sleep(6000);
const p1 = JSON.parse(await ev('JSON.stringify({x: window.__hu.x, z: window.__hu.z, dg: window.__hu.dg, sh: window.__hu.sh, mx: window.__hu.mx, mz: window.__hu.mz, bx: window.__hu.bx, bz: window.__hu.bz})'));
await sleep(9000);
let p2 = JSON.parse(await ev('JSON.stringify({x: window.__hu.x, z: window.__hu.z, dg: window.__hu.dg, sh: window.__hu.sh})'));
for (let i = 0; i < 8 && p2.sh <= p0.sh; i++) { await sleep(5000); p2 = JSON.parse(await ev('JSON.stringify({x: window.__hu.x, z: window.__hu.z, dg: window.__hu.dg, sh: window.__hu.sh})')); }
out.delegation = { p0, p1, p2, dgOn: p1.dg === 1, moved: Math.hypot(p2.x - p0.x, p2.z - p0.z) > 2 || Math.hypot(p1.x - p0.x, p1.z - p0.z) > 2, shotAttempted: p2.sh > p0.sh };
const shot1 = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('/tmp/delegate-on.png', Buffer.from(shot1.result.data, 'base64'));

// 위임 OFF(수동 복귀)
const tgl2 = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'') === '수동'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
out.offFound = !!tgl2;
if (tgl2) { await tDownUp(tgl2[0], tgl2[1]); await sleep(500); }
const q0 = JSON.parse(await ev('JSON.stringify({x: window.__hu.x, z: window.__hu.z, dg: window.__hu.dg})'));
await sleep(2500);
const q1 = JSON.parse(await ev('JSON.stringify({x: window.__hu.x, z: window.__hu.z, dg: window.__hu.dg})'));
out.manualReturn = { q0, q1, dgOff: q1.dg === 0, moved: Math.hypot(q1.x - q0.x, q1.z - q0.z) > 2 };
out.ok = out.delegation.dgOn && out.delegation.moved && out.manualReturn.dgOff;
console.log(JSON.stringify(out));
chrome.kill(); server.close(); process.exit(0);
