// node tests/header-lab.mjs — verify.html?dbg=1 에서 헤더 동작(표시 전용) 시각 확인.
// 사람 플레이 아님. 강제조건(주입): 공중 공을 내 선수에게 떨어뜨림. 포즈 시각 확인 전용, 판정은 실제 엔진 진행.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
const OUT = '/tmp/header-lab.jsonl';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8134;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const tag = String(Date.now());
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9228', `--user-data-dir=/tmp/hdlab-${tag}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,760', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=1`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9228/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
const touches = new Map();
const touch = async (type) => { const pts = [...touches.entries()].map(([id, p]) => ({ x: p[0], y: p[1], id })); await send('Input.dispatchTouchEvent', { type, touchPoints: pts }); };
const click = async (x, y) => { touches.set(2, [x, y]); await touch('touchStart'); await sleep(60); const p = touches.get(2); touches.delete(2); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: p ? [{ x: p[0], y: p[1], id: 2 }] : [] }); };
const log = async (rec) => { await appendFile(OUT, JSON.stringify(rec) + '\n'); };

let started = false;
for (let i = 0; i < 60 && !started; i++) {
    const c = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('훈련 없이 경기 시작')); if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
    if (c) { await click(c[0], c[1]); await sleep(800); started = !!(await ev('JSON.stringify(window.__hu || null)')); } else await sleep(500);
}
if (!started) { console.log('no-start'); chrome.kill(); server.close(); process.exit(1); }

// 1단계: 선수 배치(내 선수는 카메라를 향하게) 후 카메라 정착 대기
const stageA = () => ev(`(() => { const m = window.__m; const H = m.players[m.humanId]; m.state = 'play';
    H.x = 18; H.z = 30; H.vx = H.vz = 0; H.stun = 0; H.noPick = 0; H.lunge = 0; H.kick = null; H.h = Math.PI / 2;
    for (const p of m.players) if (p !== H) { p.x = 4 + Math.random() * 28; p.z = p.role === 'GK' ? p.z : 52; p.stun = 3; }
    m.ball.owner = H; m.ball.x = H.x; m.ball.z = H.z; m.ball.y = 0; m.ball.vx = m.ball.vz = m.ball.vy = 0;
    return 1 })()`);
// 2단계: 공만 무소유로 띄움(고공/지상). 다음 프레임에는 아직 닿지 않는 거리에서 접근 시작
const stageB = (high) => ev(`(() => { const m = window.__m; const H = m.players[m.humanId];
    m.ball.owner = null; m.ball.x = 18; m.ball.z = 31.3; m.ball.vx = 0; m.ball.vz = -1.5;
    ${high ? 'm.ball.y = 0.9; m.ball.vy = -0.2; m.ball.vz = -1.5;' : 'm.ball.y = 0; m.ball.vy = 0; m.ball.vz = -4;'}
    return 1 })()`);
const clip = async () => JSON.parse(await ev(`(() => { const c = document.querySelector('.rs-wrap canvas'); if (!c) return JSON.stringify({x:0,y:0,width:10,height:10}); const r = c.getBoundingClientRect(); return JSON.stringify({ x: Math.max(0, r.x + window.scrollX + r.width / 2 - 90), y: Math.max(0, r.y + window.scrollY + r.height * 0.75 - 120), width: 180, height: 200 }); })()`));
const cap = async (name) => { await ev("window.scrollTo(0,0)"); await sleep(60); const c = await clip(); const shot = await send('Page.captureScreenshot', { format: 'png', clip: { ...c, scale: 3 } }); await writeFile(`/tmp/${name}.png`, Buffer.from(shot.result.data, 'base64')); };

for (const [name, high] of [['header-high', true], ['header-ground', false]]) {
    await stageA(); await sleep(1000);
    await stageB(high);
    let got = false;
    const hid = await ev('window.__m.humanId');
    for (let i = 0; i < 100 && !got; i++) {
        const ow = await ev('window.__m.ball.owner ? window.__m.ball.owner.id : -1');
        if (ow === hid) { got = true; await sleep(240); await cap(name); const pos = await ev(`JSON.stringify((() => { const m = window.__m; const H = m.players[m.humanId]; return { hx: H.x, hz: H.z, hh: H.h, bx: m.ball.x, bz: m.ball.z, by: m.ball.y, st: m.state }; })())`); await log({ type: name + '-captured', pos: JSON.parse(pos) }); const full = await send('Page.captureScreenshot', { format: 'png' }); await writeFile('/tmp/' + name + '-full.png', Buffer.from(full.result.data, 'base64')); }
        else await sleep(25);
    }
    if (!got) await log({ type: name + '-missed' });
}
await log({ type: 'done' });
console.log('done', OUT);
chrome.kill(); server.close(); process.exit(0);
