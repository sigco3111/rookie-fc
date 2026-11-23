// node tests/clock-lab.mjs — headless 게임 시계 지연 원인 측정(관측 전용, 제품·저장 무변경).
// 측정: A) 단순 페이지 rAF 기준율 B) 홈 화면 rAF율 C) 경기 중 rAF 간격 분포 + 게임시간/벽시계 비율.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8147;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        if (p === '/blank.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>b</title><p>blank</p>'); return; }
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9245', `--user-data-dir=/tmp/clocklab-${Date.now()}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,760', `http://127.0.0.1:${PORT}/blank.html`], { stdio: ['ignore', 'ignore', 'ignore'] });
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9245/json/list')).json(); const t = l.find(x => x.type === 'page'); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const touches = new Map();
const touch = async (type) => { const pts = [...touches.entries()].map(([id, p]) => ({ x: p[0], y: p[1], id })); await send('Input.dispatchTouchEvent', { type, touchPoints: pts }); };
const click = async (x, y) => { touches.set(2, [x, y]); await touch('touchStart'); await sleep(60); touches.delete(2); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };

// rAF 간격 표본 수집기: durMs 동안 프레임 간격(ms) 배열을 돌려준다
const RAF_SAMPLE = `new Promise(res => { const ds = []; let last = 0; const t0 = performance.now();
    const cb = (t) => { if (last) ds.push(t - last); last = t; if (t - t0 < %d) requestAnimationFrame(cb); else res(ds); };
    requestAnimationFrame(cb); })`;
const stats = (ds) => { if (!ds || !ds.length) return null; const n = ds.length; const over100 = ds.filter(d => d > 100).length;
    const mean = ds.reduce((a, c) => a + c, 0) / n; const mx = Math.max(...ds);
    return { frames: n, fps: +(1000 / mean).toFixed(1), meanMs: +mean.toFixed(1), maxMs: +mx.toFixed(0), over100pct: +(over100 / n * 100).toFixed(1) }; };

// A) 단순 페이지(3D 없음) rAF 기준율
await ev('1'); await sleep(500);
const a = stats(await ev(RAF_SAMPLE.replace('%d', '5000')));
console.log('A blank-page rAF:', JSON.stringify(a));

// B) 게임 홈 화면(소형 3D 초상) rAF율
await send('Page.enable');
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=1` });
await sleep(7000);
const b = stats(await ev(RAF_SAMPLE.replace('%d', '5000')));
console.log('B home rAF:', JSON.stringify(b));

// C) 경기 시작 후 rAF율 + 게임시간/벽시계 비율
let c = null;
for (let i = 0; i < 60 && !c; i++) { c = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('훈련 없이 경기 시작')); if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`); if (!c) await sleep(500); }
await click(c[0], c[1]);
await sleep(6000); // 로딩+킥오프 안정화
const w0 = await ev('performance.now()'); const g0 = await ev('window.__hu && window.__hu.t');
const statePoll = (async () => { const st = {}; const t0 = Date.now(); while (Date.now() - t0 < 8200) { const s = await ev('window.__hu && window.__hu.state'); st[s] = (st[s] || 0) + 1; await sleep(100); } return st; })();
const ds = await ev(RAF_SAMPLE.replace('%d', '8000'));
const st = await statePoll;
const w1 = await ev('performance.now()'); const g1 = await ev('window.__hu && window.__hu.t');
const cst = stats(ds);
// 엔진 dt 캡(0.05s) 기준 예측: 모든 프레임이 play라면 Σ min(d,50)/Σ d
const sumAll = ds ? ds.reduce((a, c) => a + c, 0) : 1;
const sumMin50 = ds ? ds.reduce((a, c) => a + Math.min(c, 50), 0) : 0;
console.log('C match rAF:', JSON.stringify(cst));
console.log('C states(polls):', JSON.stringify(st));
console.log('C dilation:', JSON.stringify({ wallSec: +((w1 - w0) / 1000).toFixed(2), gameSec: +(g1 - g0).toFixed(2), ratio: +((g1 - g0) / ((w1 - w0) / 1000)).toFixed(3), predictedByEngineCap: +(sumMin50 / sumAll).toFixed(3) }));
chrome.kill(); server.close(); process.exit(0);
