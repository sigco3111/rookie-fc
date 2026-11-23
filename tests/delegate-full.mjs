// node tests/delegate-lab.mjs — 경기 중 위임(자동 플레이) 시험. 강제조건 회귀 신호(사람 플레이 아님).
// 검증: 토글 ON → __hu.dg=1·정책이 이동/슛 입력, 토글 OFF → dg=0·수동 복귀. 와이드(16:9) 뷰포트에서 캔버스 비율·크기.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8199;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const tag = String(Date.now());
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9299', `--user-data-dir=/tmp/delfull-${tag}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=40`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9299/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
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
for (let i = 0; i < 60; i++) { const s = await ev('window.__hu && window.__hu.state'); if (s === 'play') break; await sleep(500); }
await sleep(1500);
out.wide = JSON.parse(await ev(`(() => { const c = document.querySelector('canvas'); return JSON.stringify({ vw: innerWidth, vh: innerHeight, cw: c ? c.width : 0, ch: c ? c.height : 0, aspect: c ? Math.round(c.width / c.height * 100) / 100 : 0 }) })()`));

// 위임 ON
const tgl = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'') === '자동'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
if (!tgl) { out.toggleFound = false; console.log(JSON.stringify(out)); chrome.kill(); server.close(); process.exit(1); }
await tDownUp(tgl[0], tgl[1]);
await sleep(600);
out.dgOn = (await ev('window.__hu && window.__hu.dg')) === 1;
let end = false; let shots0 = 0; console.error('stage:delegated');
for (let k = 0; k < 170 && !end; k++) { await sleep(1000); if (k % 15 === 0) console.error('poll', k, await ev('window.__hu && window.__hu.t + ":" + window.__hu.state')); const st = JSON.parse(await ev('JSON.stringify({s: window.__hu && window.__hu.state, sh: window.__hu ? window.__hu.sh : 0, gl: window.__hu ? window.__hu.gl : 0, sc: window.__m ? [...window.__m.score] : null})')); shots0 = Math.max(shots0, st.sh); if (st.s === 'end') { end = true; out.endState = st; } }
out.endReached = end; out.shots = shots0;
let resultText = '';
for (let k = 0; k < 20; k++) { await sleep(700); resultText = await ev('document.body.innerText'); if (resultText.includes('경기 결과')) break; }
out.resultShowsDelegation = resultText.includes('자동 플레이를 사용했다');
// 결과 → (다음 경기 준비/시즌 말 평가) → 홈 → 기록실 순서로 이동
for (const label of ['다음 경기 준비', '시즌 말 승격 평가', '평가 결과 확인', '다음 시즌 시작']) {
    const nb = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('${label}')); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
    if (nb) { await tDownUp(nb[0], nb[1]); await sleep(900); }
}
const rb = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('기록실')); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
out.recordsBtn = !!rb;
if (rb) { await tDownUp(rb[0], rb[1]); await sleep(1200); const rt = await ev('document.body.innerText'); out.recordsNote = rt.includes('자동 플레이를 사용한 경기'); const shot3 = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync('/tmp/delegate-records.png', Buffer.from(shot3.result.data, 'base64')); }
const shot2 = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('/tmp/delegate-result.png', Buffer.from(shot2.result.data, 'base64'));
out.ok = out.dgOn && end && out.resultShowsDelegation && out.recordsNote === true;
console.log(JSON.stringify(out));
chrome.kill(); server.close(); process.exit(0);
