// node tests/manual-inputs.mjs — 위임 OFF 후 수동 입력 3경로(키보드/터치드래그/마우스드래그) 분리 시험
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8183;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const tag = String(Date.now());
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9294', `--user-data-dir=/tmp/manin-${tag}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=1`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9294/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
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
for (let i = 0; i < 60; i++) { const s = await ev('window.__hu && window.__hu.state'); if (s === 'play') break; await sleep(500); }
// 위임 ON → OFF (수동 복귀 상태 만들기)
let tgl = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'') === '자동'); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
await tDownUp(tgl[0], tgl[1]); await sleep(1500);
tgl = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'') === '수동'); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
await tDownUp(tgl[0], tgl[1]); await sleep(500);
out.dgOff = JSON.parse(await ev(HU)).dg === 0;

// 공/선수를 조용한 위치로 고정(입력만 분리해 보기 위함)
await ev(`(() => { const m = window.__m; const H = m.players[m.humanId]; H.x = 18; H.z = 30; H.vx = 0; H.vz = 0; const o = m.players.find(p => p.team === 1); m.ball.x = 4; m.ball.z = 55; m.ball.vx = 0; m.ball.vz = 0; m.ball.owner = o; o.x = 4; o.z = 55; return 1; })()`);

const move = async (label, act) => {
    const m0 = JSON.parse(await ev(HU));
    await act();
    const m1 = JSON.parse(await ev(HU));
    return { label, dx: Math.round((m1.x - m0.x) * 100) / 100, dz: Math.round((m1.z - m0.z) * 100) / 100, moved: Math.hypot(m1.x - m0.x, m1.z - m0.z) > 0.5, errs: (window_errs => window_errs)(0) };
};

// 1) 키보드 화살표 위
out.keyboard = await move('keyboard', async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 });
    await sleep(2500);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 });
});
// 2) 터치 드래그
out.touch = await move('touch', async () => {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 400, y: 500, id: 5 }] });
    for (let i = 0; i < 6; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 400, y: 500 - 25 * (i + 1), id: 5 }] }); await sleep(350); }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
});
// 3) 마우스 드래그
out.mouse = await move('mouse', async () => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 400, y: 500, button: 'left', clickCount: 1 });
    for (let i = 0; i < 6; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 400, y: 500 - 25 * (i + 1), button: 'left' }); await sleep(350); }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 400, y: 350, button: 'left', clickCount: 1 });
});
out.errors = await ev('JSON.stringify((window.__errors || []).slice(0, 5))');
out.ok = out.dgOff && (out.keyboard.moved || out.touch.moved || out.mouse.moved);
console.log(JSON.stringify(out));
chrome.kill(); server.close();
