// node tests/records-lab.mjs — 기록실 화면: 저장 주입 → 기록실 버튼 → 표/합계 확인 + 캡처
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8147, OUT = '/downloads/records-lab.png';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff2', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9253', '--user-data-dir=/tmp/reclab', '--no-first-run', '--no-sandbox', `http://127.0.0.1:${PORT}/verify.html?case=flow`], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9253/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log(JSON.stringify({ ok: false, err: 'no-target' })); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evl = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable');
await sleep(2500);
const save = { v: 1, phase: 'home', name: '기록실시험', pos: 'FW', stats: { shoot: 74, pass: 53, dribble: 72, defense: 47, speed: 73 }, season: 2, game: 0, trust: 66, ratings: [], trained: false, last: null, evalRes: null, attempts: 2, legacy: 3, league: null, sg: 1, sa: 0, sgn: 1,
    yhist: [{ n: 1, avg: 6.85, ok: false, g: 3, a: 1 }, { n: 2, avg: 6.1, ok: false }],
    hist: [{ n: 1, rk: 4, pts: 21, g: 9, a: 5 }, { n: 2, rk: 1, pts: 31, g: 14, a: 7 }] };
await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('rookie-soccer.v1', JSON.stringify(${JSON.stringify(save)}))` });
await send('Page.navigate', { url: 'http://127.0.0.1:${PORT}/verify.html?case=flow'.replace('${PORT}', String(PORT)) }); await sleep(4000);
const clicked = await evl(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent === '기록실'); if (b) { b.click(); return true; } return false; })()`);
await sleep(800);
const res = await evl(`(() => { const t = document.body.innerText; return {
    hasTitle: t.includes('기록실'), hasTotal: t.includes('통산 골'), total: (t.match(/통산 골/)||[]).length,
    youthRow: t.includes('1시즌') && t.includes('6.8'), proRows: (t.match(/시즌/g)||[]).length,
    hasRank1: t.includes('1위'), hasPts31: t.includes('31'), caveat: t.includes('기록이 남은 경기 기준'), dashRow: t.includes('-'),
    tiles: [...document.querySelectorAll('.rs-tile b')].map(x => x.textContent) }; })()`);
const shot = await send('Page.captureScreenshot', { format: 'png' });
if (shot.result?.data) await writeFile(OUT, Buffer.from(shot.result.data, 'base64'));
console.log(JSON.stringify({ ok: !!(clicked && res && res.hasTitle && res.hasTotal && res.hasRank1 && res.hasPts31 && res.caveat), clicked, ...res }));
chrome.kill(); server.close(); process.exit(0);
