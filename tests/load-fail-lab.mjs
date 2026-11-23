// node tests/load-fail-lab.mjs — 모델 로딩 실패(첫 zip 요청 404) 시 탈출 경로 시험(강제조건: 첫 .zip 요청만 404).
// 확인: 실패 문구 + '경기 나가기' 표시 → 나가기(confirm 승인) → 홈 복귀 → 재시작 시 정상 로딩.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8141;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let zipBlocked = true;
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        if (p.endsWith('.zip') && zipBlocked) { res.writeHead(404); res.end('blocked'); return; }
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9235', `--user-data-dir=/tmp/lflab-${Date.now()}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,760', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=1`], { stdio: ['ignore', 'ignore', 'ignore'] });
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9235/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    else if (m.method === 'Page.javascriptDialogOpening') { send('Page.handleJavaScriptDialog', { accept: true }); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
const shot = async (name) => { await ev('scrollTo(0,0)'); await sleep(150); const r = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(name, Buffer.from(r.result.data, 'base64')); };
const touches = new Map();
const touch = async (type) => { const pts = [...touches.entries()].map(([id, p]) => ({ x: p[0], y: p[1], id })); await send('Input.dispatchTouchEvent', { type, touchPoints: pts }); };
const click = async (x, y) => { touches.set(2, [x, y]); await touch('touchStart'); await sleep(60); touches.delete(2); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const btnPos = async (label) => ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('${label}')); if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
await send('Page.enable');

let c = null;
for (let i = 0; i < 60 && !c; i++) { c = await btnPos('훈련 없이 경기 시작'); if (!c) await sleep(500); }
await click(c[0], c[1]);
await sleep(2500); // zip 404 → 실패 문구 반영 대기
const s1 = JSON.parse(await ev(`JSON.stringify({
    failMsg: (document.body.innerText.match(/3D 표시 실패[^\\n]*/) || [''])[0].slice(0, 60),
    quitBtn: !!document.body.innerText.includes('경기 나가기'),
    loading: !!document.body.innerText.includes('3D 모델 불러오는 중') })`) || '{}');
console.log('after-fail:', JSON.stringify(s1));
await shot('/tmp/load-fail.png');
// 나가기(confirm 자동 승인) → 홈 복귀
const q = await btnPos('경기 나가기');
if (q) { await click(q[0], q[1]); await sleep(1200); }
const s2 = JSON.parse(await ev(`JSON.stringify({ home: !!document.body.innerText.includes('훈련 없이 경기 시작') })`) || '{}');
console.log('after-quit:', JSON.stringify(s2));
await shot('/tmp/load-quit.png');
// zip 차단 해제 후 재시작 → 정상 로딩
zipBlocked = false;
c = await btnPos('훈련 없이 경기 시작');
if (c) { await click(c[0], c[1]); }
await sleep(8000);
console.log('after-retry:', await ev(`JSON.stringify({ hu: typeof window.__hu, t: window.__hu && window.__hu.t, state: window.__hu && window.__hu.state, failMsg: !!document.body.innerText.includes('3D 표시 실패') })`));
await shot('/tmp/load-retry.png');
chrome.kill(); server.close(); process.exit(0);
