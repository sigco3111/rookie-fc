// node tests/touch-baseline.mjs — 터치 드래그 기준선 비교: (A)위임 미사용 수동 상태 vs (B)위임 ON→OFF 후, 동일 드래그의 스틱 입력·이동량 비교
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8187;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9298', `--user-data-dir=/tmp/tbase-${Date.now()}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=1`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9298/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
const tDownUp = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 2 }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const HU = 'JSON.stringify(window.__hu || null)';
let started = false;
for (let i = 0; i < 60 && !started; i++) {
    const c = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('훈련 없이 경기 시작')); if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
    if (c) { await tDownUp(c[0], c[1]); await sleep(800); started = !!(await ev(HU)); } else await sleep(500);
}
for (let i = 0; i < 60; i++) { const s = await ev('window.__hu && window.__hu.state'); if (s === 'play') break; await sleep(500); }
const settle = `(() => { const m = window.__m; const H = m.players[m.humanId]; H.x = 18; H.z = 30; H.vx = 0; H.vz = 0; return 1; })()`;
// 동일 드래그: (400,500)→위로 150px, 2.5초 유지. 스틱 입력(mx/mz)과 이동량 측정.
const drag = async () => {
    console.error('instr:', await ev(`(() => { window.__pev = []; for (const t of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'mousedown', 'click']) window.addEventListener(t, e => { if (window.__pev.length < 60) window.__pev.push(t + '@' + (e.target && e.target.tagName) + ':' + (e.pointerId !== undefined ? e.pointerId : '-')); }, true); return document.querySelectorAll('canvas').length; })()`));
    await ev(settle); await sleep(300);
    const m0 = JSON.parse(await ev(HU));
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 350, y: 320, id: 7 }] });
    let mzSeen = 0;
    for (let i = 0; i < 6; i++) {
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 350, y: 320 - 25 * (i + 1), id: 7 }] });
        await sleep(380);
        const h = JSON.parse(await ev(HU));
        if (h && Math.abs(h.mz) > Math.abs(mzSeen)) mzSeen = h.mz;
    }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const m1 = JSON.parse(await ev(HU));
    const pev = JSON.parse(await ev('JSON.stringify(window.__pev || [])'));
    return { pev, dz: Math.round((m1.z - m0.z) * 100) / 100, dx: Math.round((m1.x - m0.x) * 100) / 100, mzSeen: Math.round(mzSeen * 100) / 100, moved: Math.hypot(m1.x - m0.x, m1.z - m0.z) > 0.5 };
};
const out = {};
out.A_baselineManual = await drag();
// 위임 ON → 2초 → OFF
let tgl = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'') === '자동'); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
await tDownUp(tgl[0], tgl[1]); await sleep(2000);
tgl = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'') === '수동'); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
await tDownUp(tgl[0], tgl[1]); await sleep(500);
out.B_afterDelegate = await drag();
out.conclusion = (out.A_baselineManual.moved === out.B_afterDelegate.moved) ? 'same-behavior' : 'DIFFERENT';
console.log(JSON.stringify(out));
chrome.kill(); server.close();
