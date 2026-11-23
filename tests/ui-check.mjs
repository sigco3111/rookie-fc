// node tests/ui-check.mjs — 슛 버튼 무소유 흐림 + 충전 화살표 시각 검증(verify 빌드, CDP)
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8141;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9229', `--user-data-dir=/tmp/uicheck-${Date.now()}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,760', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=1`], { stdio: ['ignore','ignore','ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9229/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
const shot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(file, Buffer.from(r.result.data, 'base64')); };
await send('Page.enable');
const touches = new Map();
const touch = async (type) => { const pts = [...touches.entries()].map(([id, p]) => ({ x: p[0], y: p[1], id })); await send('Input.dispatchTouchEvent', { type, touchPoints: pts }); };
const tDown = async (id, x, y) => { touches.set(id, [x, y]); await touch('touchStart'); };
const tUp = async (id) => { const p = touches.get(id); touches.delete(id); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: p ? [{ x: p[0], y: p[1], id }] : [] }); };
const btnRect = (lbl) => ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').startsWith('${lbl}')); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
const shootOp = () => ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').startsWith('슛')); return b ? getComputedStyle(b).opacity : 'none'; })()`);

// 경기 시작
let started = false;
for (let i = 0; i < 60 && !started; i++) {
    const c = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('훈련 없이 경기 시작')); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
    if (c) { await tDown(2, c[0], c[1]); await sleep(80); await tUp(2); await sleep(1200); const r = await ev('JSON.stringify(window.__hu || null)'); started = !!(r && r !== 'null'); } else await sleep(500);
}
if (!started) { console.log('no-start'); chrome.kill(); server.close(); process.exit(1); }

// 소유 상태별 버튼 투명도 관측(최대 60초)
let opOwn = null, opNotOwn = null, snapNotOwn = false;
const t0 = Date.now();
while (Date.now() - t0 < 60000 && (opOwn === null || opNotOwn === null)) {
    const hu = JSON.parse(await ev('JSON.stringify(window.__hu||null)') || 'null');
    if (!hu) { await sleep(200); continue; }
    if (hu.owner === hu.hid && opOwn === null) { opOwn = await shootOp(); }
    if (hu.owner !== hu.hid && opNotOwn === null) { opNotOwn = await shootOp(); await shot('/tmp/ui-dim.png'); snapNotOwn = true; }
    await sleep(150);
}
console.log(JSON.stringify({ opOwn, opNotOwn, snapNotOwn }));

// 사람이 소유할 때까지 스틱으로 공쪽 이동 후 슛 홀드 → 충전 화살표 캡처
let charged = null;
const stick = await ev(`(() => { const cs = [...document.querySelectorAll('canvas')]; const c = cs[cs.length-1]; if (!c) return null; const r = c.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`);
const sb = await btnRect('슛');
const t1 = Date.now(); let stickOn = false;
while (Date.now() - t1 < 90000) {
    const hu = JSON.parse(await ev('JSON.stringify(window.__hu||null)') || 'null');
    if (!hu) { await sleep(200); continue; }
    if (hu.owner === hu.hid) {
        if (stickOn) { await tUp(1); stickOn = false; }
        const sb2 = await btnRect('슛');
        await tDown(2, sb2[0], sb2[1]);
        await sleep(200);
        console.log('sd@200ms=', await ev('window.__hu ? window.__hu.sd : null'), 'chg=', await ev('window.__hu ? window.__hu.chg : null'));
        await sleep(400);
        const hu2 = JSON.parse(await ev('JSON.stringify(window.__hu||null)') || 'null');
        await shot('/tmp/ui-charge.png');
        await tUp(2);
        charged = hu2 ? hu2.chg : null;
        break;
    } else {
        // 공쪽으로 스틱
        const dx = hu.bx - hu.x, dz = hu.bz - hu.z;
        const mag = Math.hypot(dx, dz) || 1;
        const px = stick[0] + stick[2] * (0.5 + 0.3 * dx / mag), py = stick[1] + stick[3] * (0.55 + 0.3 * dz / mag);
        if (!stickOn) { await tDown(1, px, py); stickOn = true; } else { touches.set(1, [px, py]); await touch('touchMove'); }
        await sleep(120);
    }
}
if (stickOn) await tUp(1);
console.log(JSON.stringify({ charged }));
chrome.kill(); server.close(); process.exit(0);
