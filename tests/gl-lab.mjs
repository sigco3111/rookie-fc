// node tests/gl-lab.mjs — 모델 로딩 창 안에서의 WebGL 컨텍스트 손실 처리 시험(강제조건: zip 응답 지연 + WEBGL_lose_context 주입).
// 사람 플레이 아님. 확인 항목: 손실 시 안내 배너·일시정지 여부, 복구 후 사용자 재개 동작.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8137;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        if (p.endsWith('.zip')) await sleep(1500); // 강제조건: 모델 로딩 창을 인위적으로 넓힌다
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const tag = String(Date.now());
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9231', `--user-data-dir=/tmp/gllab-${tag}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,760', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=1`], { stdio: ['ignore', 'ignore', 'ignore'] });
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9231/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.result?.exceptionDetails) return 'EVAL-ERR'; return r.result?.result?.value; };
const shot = async (name) => { await ev('scrollTo(0,0)'); await sleep(150); const r = await send('Page.captureScreenshot', { format: 'png' }); const { writeFile } = await import('node:fs/promises'); await writeFile(name, Buffer.from(r.result.data, 'base64')); };
const touches = new Map();
const touch = async (type) => { const pts = [...touches.entries()].map(([id, p]) => ({ x: p[0], y: p[1], id })); await send('Input.dispatchTouchEvent', { type, touchPoints: pts }); };
const click = async (x, y) => { touches.set(2, [x, y]); await touch('touchStart'); await sleep(60); touches.delete(2); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const state = async () => JSON.parse(await ev(`JSON.stringify({
    banner: !!document.body.innerText.includes('그래픽 연결이 끊겨'),
    waitResume: !!document.body.innerText.includes('복구 대기 중'),
    canResume: !!document.body.innerText.includes('계속하기'),
    pausedOverlay: !!document.body.innerText.includes('일시정지'),
    msg: (document.body.innerText.match(/3D [^\\n]*/) || [''])[0],
    fatal: !!document.body.innerText.includes('화면 표시에 문제가 생겼습니다'),
    huType: typeof window.__hu,
    t: (window.__hu && window.__hu.t) || null })`) || '{}');

// 경기 시작
let started = false;
for (let i = 0; i < 60 && !started; i++) {
    const c = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('훈련 없이 경기 시작')); if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
    if (c) { await click(c[0], c[1]); started = true; } else await sleep(500);
}
if (!started) { console.log('no-start'); chrome.kill(); server.close(); process.exit(1); }
// 로딩 창 안(zip 지연 1.5s)에서 즉시 컨텍스트 손실 주입
await sleep(250);
const lost = await ev(`(() => { const c = document.querySelectorAll('canvas')[0]; if (!c) return 'no-canvas';
    const ctx = c.getContext('webgl2') || c.getContext('webgl'); if (!ctx) return 'no-ctx';
    const ext = ctx.getExtension('WEBGL_lose_context'); if (!ext) return 'no-ext'; window.__glExt = ext; ext.loseContext(); return 'lost' })()`);
console.log('inject:', lost);
await sleep(2600); // 로딩 완료 + 배너 반영 대기
const s1 = await state();
const t1 = s1.t; await sleep(1200); const s2 = await state();
console.log('after-loss:', JSON.stringify({ ...s2, clockAdvanced: s2.t !== null && t1 !== null ? s2.t > t1 : null }));
await shot('/tmp/gl-loss.png');
// 복구 시도
const restored = await ev(`(() => { const ext = window.__glExt; if (!ext) return 'no-ext'; ext.restoreContext(); return 'restored' })()`);
console.log('restore:', restored);
await sleep(1500);
const s3 = await state();
console.log('after-restore:', JSON.stringify(s3));
await shot('/tmp/gl-restore.png');
// 사용자 재개(계속하기 버튼이 있으면 클릭)
const rc = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('계속하기')); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
if (rc) { await click(rc[0], rc[1]); await sleep(1200); }
await sleep(6000);
const s5 = await state();
const clock = await ev(`window.__hu ? JSON.stringify({t: window.__hu.t, state: window.__hu.state}) : 'no-hu'`);
console.log('after-resume-click:', JSON.stringify(s5), 'clock:', clock);
await shot('/tmp/gl-resumed.png');
chrome.kill(); server.close(); process.exit(0);
