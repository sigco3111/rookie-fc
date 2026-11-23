// node tests/perf-lab.mjs — 경기 프레임 비용 분해 측정(verify 전용 계측, 관측 전용).
// 구성별(기준/norigs/noshadow/nohud) 같은 환경·같은 절차로 step/리그/렌더/HUD 구간 시간을 나눈다.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8149;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9247', `--user-data-dir=/tmp/perflab-${Date.now()}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,760', 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore'] });
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9247/json/list')).json(); const t = l.find(x => x.type === 'page'); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
const touches = new Map();
const touch = async (type) => { const pts = [...touches.entries()].map(([id, p]) => ({ x: p[0], y: p[1], id })); await send('Input.dispatchTouchEvent', { type, touchPoints: pts }); };
const click = async (x, y) => { touches.set(2, [x, y]); await touch('touchStart'); await sleep(60); touches.delete(2); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
await send('Page.enable');

const run = async (label, query) => {
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=1${query}` });
    await sleep(7000);
    let c = null;
    for (let i = 0; i < 60 && !c; i++) { c = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('훈련 없이 경기 시작')); if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`); if (!c) await sleep(500); }
    if (!c) { console.log(label, ': no-start'); return; }
    await click(c[0], c[1]);
    await sleep(7000); // 로딩+킥오프
    const p0 = await ev('JSON.stringify(window.__perf || null)');
    await sleep(8000);
    const p1 = await ev('JSON.stringify(window.__perf || null)');
    if (!p0 || !p1) { console.log(label, ': no-perf'); return; }
    const a = JSON.parse(p0), b = JSON.parse(p1);
    const dn = b.n - a.n, d = (k) => +(((b[k] - a[k]) / Math.max(1, dn))).toFixed(2);
    console.log(label, JSON.stringify({ frames: dn, fps: +(dn / 8).toFixed(1), stepMs: d('step'), rigsMs: d('rigs'), renderMs: d('render'), hudMs: d('hud') }));
};
await run('baseline', '');
await run('norigs', '&diag=norigs');
await run('noshadow', '&diag=noshadow');
await run('nohud', '&diag=nohud');
chrome.kill(); server.close(); process.exit(0);
