// 주입 통제시험(자연 발생 아님): __m으로 상황을 강제해 태클 피드백 문구 분기를 확인한다.
// node tests/inject-flash.mjs — verify.html?dbg=1 필요
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8137;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9237', `--user-data-dir=/tmp/injlab-${Date.now()}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,760', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9237/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
const shot = async (name) => { await sleep(350); const s = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(`/tmp/inj-${name}.png`, Buffer.from(s.result.data, 'base64')); };

// 경기 시작 대기(홈 화면 → 경기 시작 버튼 클릭은 play-lab과 동일 절차)
for (let i = 0; i < 60; i++) { await sleep(500); const ready = await ev(`!!document.querySelector('canvas')`); if (ready) break; }
const startBtn = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('경기 시작') || (x.textContent||'').includes('훈련 없이 경기 시작')); if (b) { b.click(); return true; } return false })()`);
if (!startBtn) { console.log('no-start'); }
for (let i = 0; i < 60; i++) { await sleep(500); const st = await ev(`window.__hu ? window.__hu.state : null`); if (st === 'play') break; }
console.log('state:', await ev(`window.__hu ? window.__hu.state : null`));

const setup = async () => ev(`(() => {
    const m = window.__m; const H = m.players[m.humanId];
    const o = m.players.find(p => p.team !== H.team && p.role !== 'GK');
    // 상황 강제(주입): 상대 캐리어를 인간 옆에 두고 드리블을 극단적으로 올려 태클 판정이 반드시 실패하게 한다
    m.ball.owner = o; m.ball.x = H.x + 1.2; m.ball.z = H.z; m.ball.vx = 0; m.ball.vz = 0; m.ball.vy = 0;
    o.x = H.x + 1.2; o.z = H.z; o.st.dribble = 999; o.think = 99; o.stun = 0; o.lunge = 0; o.noPick = 0;
    H.lunge = 0; H.lungeCd = 0; H.stun = 0; H.kick = null;
    m.pendingPass = null; if (m.state !== 'play') m.state = 'play';
    window.__flash = null;
    return o.id;
})()`);

// 1) 빗나감 분기: 캐리어가 소유를 유지
let opp = await setup();
await ev(`(() => { const m = window.__m; const H = m.players[m.humanId]; H.lunge = 0.3; H.lungeCd = 0.9; return 1 })()`);
for (let i = 0; i < 30; i++) { await sleep(150); const f = await ev('window.__flash || null'); if (f) break; }
console.log('whiff flash:', await ev('window.__flash || null'));
await shot('whiff');

// 2) 루즈볼 분기: 런지 중 공이 느린 무소유가 됨
opp = await setup();
await ev(`(() => { const m = window.__m; const H = m.players[m.humanId]; H.lunge = 0.3; H.lungeCd = 0.9; return 1 })()`);
await sleep(150);
await ev(`(() => { const m = window.__m; m.ball.owner = null; m.ball.vx = 0; m.ball.vz = 0; const o = m.players.find(p => p.team !== m.players[m.humanId].team && p.role !== 'GK'); o.x += 3; return 1 })()`);
for (let i = 0; i < 30; i++) { await sleep(150); const f = await ev('window.__flash || null'); if (f) break; }
console.log('loose flash:', await ev('window.__flash || null'));
await shot('loose');

chrome.kill(); server.close(); process.exit(0);
