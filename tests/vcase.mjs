// node vcase.mjs <caseUrlSuffix> [waitSec] — verify-dist 케이스 실행 후 __log/__errors 출력
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const SUFFIX = process.argv[2] || 'corruptsave'; const WAIT = Number(process.argv[3] || 25);
const ROOT = process.env.VROOT || new URL('../verify-dist/', import.meta.url).pathname; // 저장소 루트 기준 상대경로(VROOT로 오버라이드)
const PORT = 8127;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9226', `--user-data-dir=/tmp/vcase-${SUFFIX.replace(/[^a-z0-9]/gi,'')}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=390,844', `http://127.0.0.1:${PORT}/verify.html?${SUFFIX}&dbg=1&fast=6`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9226/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const t0 = Date.now(); let done = false;
while ((Date.now() - t0) / 1000 < WAIT && !done) { await sleep(1500);
    const r = await send('Runtime.evaluate', { expression: '!!window.__done', returnByValue: true }); done = !!r.result?.result?.value; }
const r2 = await send('Runtime.evaluate', { expression: 'JSON.stringify({done: !!window.__done, title: document.title, log: window.__log, errors: window.__errors})', returnByValue: true });
console.log(r2.result?.result?.value || 'eval-failed');
ws.close(); chrome.kill(); server.close(); process.exit(0);
