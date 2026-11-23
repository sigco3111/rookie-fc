// node tests/tab-lab.mjs — 경기 중 탭 숨김·복귀 + 숨김 상태 GL 손실/복구 상태전이 시험(강제조건, 회귀 신호).
// 검증: 숨김 → 자동 일시정지·시계 정지, 복귀 → 계속하기로 재개, 전 구간 React 재마운트 없음(__mounts 불변) + 엔진 인스턴스 동일(__m 태그 불변) + 시계 단조.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8166;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const tag = String(Date.now());
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9277', `--user-data-dir=/tmp/tablab-${tag}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,760', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=1`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9277/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
const tDownUp = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 2 }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const out = {};

let started = false;
for (let i = 0; i < 60 && !started; i++) {
    const c = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('훈련 없이 경기 시작')); if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
    if (c) { await tDownUp(c[0], c[1]); await sleep(800); started = !!(await ev('JSON.stringify(window.__hu || null)')); } else await sleep(500);
}
if (!started) { console.log('no-start'); chrome.kill(); server.close(); process.exit(1); }
// 경기 진행 대기
for (let i = 0; i < 60; i++) { const s = await ev('window.__hu && window.__hu.state'); if (s === 'play') break; await sleep(500); }
await sleep(2000);

// 기준값: 마운트 카운터 + 엔진 인스턴스 태그 + 시계
const base = JSON.parse(await ev(`(() => { const w = window; w.__m.__tid = w.__m.__tid || Math.random().toString(36).slice(2); return JSON.stringify({ mounts: w.__mounts || 0, tid: w.__m.__tid, t: w.__hu.t }) })()`));
out.base = base;

// 1) 탭 숨김 시뮬레이션: document.hidden을 오버라이드하고 visibilitychange 디스패치.
// 주의: 이 층은 앱의 visibilitychange 핸들러 동작만 검증한다. 실제 브라우저 탭 전환이 이벤트를 발생시키는지는 시험하지 않는다(브라우저 표준 동작).
await ev(`(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__fakeHidden === true }); document.dispatchEvent ? null : null; window.__fakeHidden = false; return true })()`);
await ev(`(() => { window.__fakeHidden = true; document.dispatchEvent(new Event('visibilitychange')); return document.hidden })()`);
out.hideAck = 'property-override';
await sleep(500);
out.hiddenState = { hidden: await ev('document.hidden'), pausedBtn: await ev(`!![...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('계속하기'))`) };
const h1 = await ev('window.__hu.t'); await sleep(2500); const h2 = await ev('window.__hu.t');
out.hiddenClock = { t1: h1, t2: h2, frozen: h1 === h2 };

// 2) 숨김 상태에서 GL 손실·복구
out.glLose = await ev(`(() => { const c = document.querySelector('canvas'); const ctx = c && (c.getContext('webgl2') || c.getContext('webgl')); if (!ctx) return 'no-ctx'; const ext = ctx.getExtension('WEBGL_lose_context'); if (!ext) return 'no-ext'; window.__glExt = ext; ext.loseContext(); return 'lost' })()`);
await sleep(800);
out.glBannerWhileHidden = await ev(`document.body.innerText.includes('그래픽') || document.body.innerText.includes('복구')`);
out.glRestore = await ev(`(() => { const ext = window.__glExt; if (!ext) return 'no-ext'; ext.restoreContext(); return 'restored' })()`);
await sleep(800);

// 3) 탭 복귀 시뮬레이션
await ev(`(() => { window.__fakeHidden = false; document.dispatchEvent(new Event('visibilitychange')); return document.hidden })()`);
await sleep(700);
out.backState = { hidden: await ev('document.hidden'), pausedBtn: await ev(`!![...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('계속하기'))`) };
// 계속하기 클릭
const rc = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('계속하기')); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
if (rc) await tDownUp(rc[0], rc[1]);
await sleep(1500);

// 4) 사후 검증: 재마운트 없음 + 인스턴스 동일 + 시계 단조 재개
const after = JSON.parse(await ev(`JSON.stringify({ mounts: window.__mounts || 0, tid: window.__m.__tid, t: window.__hu.t, state: window.__hu.state })`));
out.after = after;
const t3 = after.t; await sleep(1500); const t4 = await ev('window.__hu.t');
out.resumedClock = { t3, t4, advancing: t4 > t3, monotonicFromHidden: t3 >= h2 };
out.noRemount = after.mounts === base.mounts;
out.sameEngine = after.tid === base.tid;
out.ok = out.hiddenClock.frozen && out.noRemount && out.sameEngine && out.resumedClock.advancing && out.resumedClock.monotonicFromHidden && after.state === 'play';
console.log(JSON.stringify(out));
chrome.kill(); server.close(); process.exit(0);
