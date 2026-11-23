// node tests/look-lab.mjs <armslimQuery> <outPng> — look-lab.html 렌더 후 캡처
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const Q = process.argv[2] || ''; const OUT = process.argv[3] || '/tmp/look.png';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8131;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/look-lab.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const tag = Q.replace(/[^a-z0-9]/gi, '') || 'base';
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9227', `--user-data-dir=/tmp/looklab-${tag}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,700', `http://127.0.0.1:${PORT}/look-lab.html${Q ? '?' + Q : ''}`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9227/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('look-lab.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
await sleep(Number(process.argv[4] || 9000)); // 모델 로드 + 아이들 애니메이션 안정화 대기
const shot = await send('Page.captureScreenshot', { format: 'png' });
if (shot.result?.data) { await writeFile(OUT, Buffer.from(shot.result.data, 'base64')); console.log('saved', OUT); } else console.log('shot-failed');
chrome.kill(); server.close(); process.exit(0);
