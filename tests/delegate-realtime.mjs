// node tests/delegate-realtime.mjs — 실속도(fast=1) 위임 동작 검증: 추적·소유·슛/패스·수동 복귀. 강제조건 시험, 사람 재미 판단 아님.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8179;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const tag = String(Date.now());
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9290', `--user-data-dir=/tmp/delrt-${tag}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=1`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9290/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
const tDownUp = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 2 }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const HU = 'JSON.stringify(window.__hu || null)';
const out = { samples: [] };

let started = false;
for (let i = 0; i < 60 && !started; i++) {
    const c = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('훈련 없이 경기 시작')); if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
    if (c) { await tDownUp(c[0], c[1]); await sleep(800); started = !!(await ev(HU)); } else await sleep(500);
}
if (!started) { console.log('no-start'); chrome.kill(); server.close(); process.exit(1); }
for (let i = 0; i < 60; i++) { const s = await ev('window.__hu && window.__hu.state'); if (s === 'play') break; await sleep(500); }

// 위임 ON
const tgl = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'') === '자동'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
await tDownUp(tgl[0], tgl[1]); await sleep(500);
const g0 = JSON.parse(await ev(HU));
out.dgOn = g0.dg === 1;

// 70초 실속도 관측: 추적(공까지 거리), 소유(owner===hid), 슛/패스 누적
let owned = 0, minD = 1e9, trackToward = 0, prevD = null;
for (let i = 0; i < 35; i++) {
    await sleep(2000);
    const h = JSON.parse(await ev(HU));
    if (!h || h.state !== 'play') continue;
    const d = Math.round(Math.hypot(h.x - h.bx, h.z - h.bz) * 100) / 100;
    if (h.owner === h.hid) owned++;
    if (d < minD) minD = d;
    if (prevD !== null && d < prevD - 0.05) trackToward++;
    prevD = d;
    if (i % 5 === 0) out.samples.push({ t: Math.round(h.t * 10) / 10, d, owner: h.owner, hid: h.hid, sh: h.sh, pa: h.pa, po: h.po, gl: h.gl });
}
const g1 = JSON.parse(await ev(HU));
out.delegation = { t0: Math.round(g0.t * 10) / 10, t1: Math.round(g1.t * 10) / 10, clockAdvanced: g1.t > g0.t + 20, ownedSamples: owned, minDistToBall: minD, approachSamples: trackToward, shots: g1.sh, passAtt: g1.pa, passOk: g1.po, goals: g1.gl, dgStillOn: g1.dg === 1 };

// 위임 OFF → 수동 복귀: 터치 드래그로 이동 확인
const tgl2 = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'') === '수동'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
out.offBtn = !!tgl2;
if (tgl2) {
    await tDownUp(tgl2[0], tgl2[1]); await sleep(500);
    const m0 = JSON.parse(await ev(HU));
    // 왼쪽 영역 드래그(이동 입력): 좌하단에서 위로 드래그 유지
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 600, id: 3 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 420, id: 3 }] });
    await sleep(2500);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const m1 = JSON.parse(await ev(HU));
    out.manual = { dgOff: m1.dg === 0, dx: Math.round((m1.x - m0.x) * 100) / 100, dz: Math.round((m1.z - m0.z) * 100) / 100, moved: Math.hypot(m1.x - m0.x, m1.z - m0.z) > 0.5 };
}
out.ok = !!(out.dgOn && out.delegation.clockAdvanced && (out.delegation.shots > 0 || out.delegation.passAtt > 0) && out.delegation.ownedSamples > 0 && out.manual && out.manual.dgOff && out.manual.moved);
console.log(JSON.stringify(out));
chrome.kill(); server.close();
