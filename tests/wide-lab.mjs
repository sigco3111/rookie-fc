// node tests/wide-lab.mjs — 뷰포트별 화면 크기 분기 확인: 와이드(1280x800)는 16:9, 모바일(390x760)은 기존 390x590 세로.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
const PORT = 8188; await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function probe(name, wpx, hpx, port) {
    const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/widelab-${name}-${Date.now()}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--window-size=${wpx},${hpx}`, `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0`], { stdio: ['ignore', 'ignore', 'ignore'] });
    let wsUrl = null;
    for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
        try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
    if (!wsUrl) { chrome.kill(); return { name, error: 'no-target' }; }
    const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let mid = 0; const pend = new Map();
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
    const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
    // 경기 시작까지
    let started = false;
    for (let i = 0; i < 60 && !started; i++) {
        const c = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('훈련 없이 경기 시작')); if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
        if (c) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c[0], y: c[1], id: 2 }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(800); started = !!(await ev('JSON.stringify(window.__hu || null)')); } else await sleep(500);
    }
    let r = { name, started };
    if (started) {
        await sleep(2500); await ev('scrollTo(0,0)'); await sleep(300);
        r.view = JSON.parse(await ev(`(() => { const c = document.querySelector('canvas'); const w = document.querySelector('.rs-wrap'); return JSON.stringify({ vw: innerWidth, vh: innerHeight, cw: c.width, ch: c.height, aspect: Math.round(c.width / c.height * 100) / 100, wrapW: w ? Math.round(w.getBoundingClientRect().width) : 0 }) })()`));
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`/tmp/wide-${name}.png`, Buffer.from(shot.result.data, 'base64'));
    }
    chrome.kill(); return r;
}
const wide = await probe('pc', 1280, 800, 9289);
const mobile = await probe('mobile', 390, 760, 9290);
console.log(JSON.stringify({ wide, mobile, wideOk: wide.view && wide.view.aspect >= 1.7 && wide.view.ch + 190 <= wide.view.vh + 24, mobileOk: mobile.view && mobile.view.cw === 390 && mobile.view.ch === 590 }));
server.close(); process.exit(0);
