// node tests/gk-lab.mjs <durationSec> — verify.html?dbg=1 에서 GK 선방 동작(표시 전용) 시각 확인.
// 사람 플레이 아님. 골대 방향: 우리 팀(team 0)은 z=0을 공격.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
const DUR = Number(process.argv[2] || 100);
const OUT = process.argv[3] || '/tmp/gk-lab.jsonl';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8133;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const tag = String(Date.now());
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9229', `--user-data-dir=/tmp/gklab-${tag}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,760', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=1`], { stdio: ['ignore', 'ignore', 'ignore'] });
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
const touches = new Map();
const touch = async (type) => { const pts = [...touches.entries()].map(([id, p]) => ({ x: p[0], y: p[1], id })); await send('Input.dispatchTouchEvent', { type, touchPoints: pts }); };
const tDown = async (id, x, y) => { touches.set(id, [x, y]); await touch('touchStart'); };
const tMove = async (id, x, y) => { touches.set(id, [x, y]); await touch('touchMove'); };
const tUp = async (id) => { const p = touches.get(id); touches.delete(id); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: p ? [{ x: p[0], y: p[1], id }] : [] }); };
const click = async (x, y) => { await tDown(2, x, y); await sleep(60); await tUp(2); };
const log = async (rec) => { await appendFile(OUT, JSON.stringify(rec) + '\n'); };

let started = false;
for (let i = 0; i < 60 && !started; i++) {
    const c = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('훈련 없이 경기 시작')); if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
    if (c) { await click(c[0], c[1]); await sleep(800); started = !!(await ev('JSON.stringify(window.__hu || null)')); } else await sleep(500);
}
if (!started) { console.log('no-start'); chrome.kill(); server.close(); process.exit(1); }
let gkId = -2;
for (let i = 0; i < 30 && gkId < 0; i++) { gkId = (await ev(`(() => { try { const g = window.__m && window.__m.players.find(p => p.role === 'GK' && p.team === 1); return g ? g.id : -1 } catch (e) { return -1 } })()`)) ?? -1; if (gkId < 0) await sleep(500); }
await log({ type: 'start', gkId });
let prevT = -1;

const stickO = await ev(`(() => { const cs = [...document.querySelectorAll('canvas')]; const c = cs[cs.length-1]; const r = c.getBoundingClientRect(); return [r.x + r.width*0.3, r.y + r.height*0.55]; })()`);
await tDown(1, stickO[0], stickO[1]);
let holdingShoot = false, shootPressAt = 0, shots = 0, saves = 0;
// 강제조건(주입): 내 선수에게 공을 주고 골대(z=0) 앞 12m에 배치. 포즈 시각 확인 전용, 판정은 실제 엔진 진행.
const stage = () => ev(`(() => { const m = window.__m; const H = m.players[m.humanId]; m.state = 'play';
    H.x = 15 + Math.random() * 6; H.z = 12; H.vx = H.vz = 0; H.stun = 0; H.noPick = 0; H.lunge = 0; H.lungeCd = 0;
    m.ball.owner = H; m.ball.x = H.x; m.ball.z = H.z; m.ball.vx = m.ball.vz = m.ball.vy = 0; m.ball.y = 0;
    for (const p of m.players) if (p !== H && p.role !== 'GK') { p.x = 4 + Math.random() * 28; p.z = 48; p.stun = 2; }
    return 1 })()`);
const t0 = Date.now();
let nulls = 0;
while (Date.now() - t0 < DUR * 1000 && saves < 3) {
    const raw = await ev('JSON.stringify(window.__hu || null)');
    if (!raw || raw === 'null') { nulls++; if (nulls === 1 || nulls % 50 === 0) { const diag = await ev(`JSON.stringify({ errs: (window.__errors||[]).slice(0,3), body: (document.body.innerText||'').slice(0,120) })`); console.log('hu-null diag x' + nulls + ':', diag); } if (nulls > 600) { console.log('hu-null-stuck'); break; } await sleep(200); continue; }
    nulls = 0;
    const hu = JSON.parse(raw); const now = Date.now();
    if (prevT >= 0 && hu.t < prevT - 0.5) { await log({ type: 't-reset', from: prevT, to: hu.t }); console.log('t-reset', prevT, '->', hu.t); }
    prevT = hu.t;
    if (hu.state === 'end') break;
    if (!holdingShoot) {
        if (hu.owner !== hu.hid || Math.hypot(hu.x - 18, hu.z - 12) > 6) { await stage(); await sleep(400); continue; }
        if (hu.state === 'play') {
            const c = await ev(`(() => { const b = document.querySelector('button[aria-label^="슛"]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
            if (c) { await tDown(2, c[0], c[1]); holdingShoot = true; shootPressAt = now; }
        }
    } else if (now - shootPressAt > 500) {
        const c = await ev(`(() => { const b = document.querySelector('button[aria-label^="슛"]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
        if (c) await tUp(2);
        holdingShoot = false; shots++;
        await log({ type: 'shoot-release', wt: now, t: hu.t, dGoal: Math.round(Math.hypot(18 - hu.x, hu.z) * 10) / 10 });
        // 슛 후 2.5초간 GK 캐치/튕겨냄 감시 → 감지 시 250ms 뒤 캡처
        const w0 = Date.now();
        while (Date.now() - w0 < 2500) {
            const g = await ev(`JSON.stringify((() => { if (!window.__m) return null; const gk = window.__m.players.find(p => p.id === ${gkId}); return { ow: window.__m.ball.owner ? window.__m.ball.owner.id : -1, np: gk.noPick, bx: window.__m.ball.x, bz: window.__m.ball.z }; })())`);
            if (!g) { await sleep(120); continue; }
            const st = JSON.parse(g);
            if (st.ow === gkId || st.np > 0.05) {
                saves++; await sleep(250);
                const shot = await send('Page.captureScreenshot', { format: 'png' });
                await writeFile(`/tmp/gksave-${saves}.png`, Buffer.from(shot.result.data, 'base64'));
                await log({ type: 'save-captured', n: saves, ow: st.ow, np: st.np });
                break;
            }
            await sleep(60);
        }
    }
    await sleep(30);
}
await tUp(1).catch(() => {});
await log({ type: 'done', shots, saves });
console.log('done', OUT, 'shots', shots, 'saves', saves);
chrome.kill(); server.close(); process.exit(0);
