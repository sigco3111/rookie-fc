// node tests/play-lab.mjs <durationSec> <outJsonl> — verify.html?dbg=1&case=home0 에서 실제 CDP 마우스 입력으로
// 슛·태클을 시도하며 __hu 계측을 기록한다. 게임 코드는 제품과 동일(훅은 상태 노출만).
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
const DUR = Number(process.argv[2] || 300);
const OUT = process.argv[3] || '/tmp/play-log.jsonl';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const PORT = 8132;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const tag = String(Date.now());
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9228', `--user-data-dir=/tmp/playlab-${tag}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,760', `http://127.0.0.1:${PORT}/verify.html?dbg=1&case=home0&fast=${process.argv[5]||'6'}`], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9228/json/list')).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log('no-target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
// RNG 고정(강제조건 — A/B 비교용, 실사용 조건 아님): seed를 argv[4]로

let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
// 멀티터치: 스틱(id 1)과 버튼(id 2)을 별도 터치 포인터로 구동(실제 폰 두 손가락 경로)
const touches = new Map();
const touch = async (type) => { const pts = [...touches.entries()].map(([id, p]) => ({ x: p[0], y: p[1], id })); await send('Input.dispatchTouchEvent', { type, touchPoints: pts }); };
const tDown = async (id, x, y) => { touches.set(id, [x, y]); await touch('touchStart'); };
const tMove = async (id, x, y) => { touches.set(id, [x, y]); await touch('touchMove'); };
const tUp = async (id) => { const p = touches.get(id); touches.delete(id); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: p ? [{ x: p[0], y: p[1], id }] : [] }); };
const click = async (x, y) => { await tDown(2, x, y); await sleep(60); await tUp(2); };
const btnRect = (label) => ev(`(() => { const b = document.querySelector('button[aria-label="${label}"]') || [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('${label}')); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
const log = async (rec) => { await appendFile(OUT, JSON.stringify(rec) + '\n'); };

// 경기 시작
const SEED = process.argv[4] ? parseInt(process.argv[4], 10) : 0;
if (SEED) { await ev(`(() => { let s = ${SEED}; Math.random = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; return 1 })()`); }
let started = false;
for (let i = 0; i < 60 && !started; i++) {
    const c = await btnRect('훈련 없이 경기 시작');
    if (c) { await click(c[0], c[1]); await sleep(800); started = !!(await ev('JSON.stringify(window.__hu || null)')); } else await sleep(500);
}
if (!started) { console.log('no-start-button'); chrome.kill(); server.close(); process.exit(1); }
await log({ type: 'match-start-clicked', wt: Date.now() });
const plist = await ev('JSON.stringify((window.__m?.players||[]).map(p => ({ id: p.id, team: p.team, role: p.role, st: p.st })))');
await log({ type: 'players', wt: Date.now(), players: plist ? JSON.parse(plist) : null });

// 스틱 원점
const stickO = await ev(`(() => { const cs = [...document.querySelectorAll('canvas')]; const c = cs[cs.length-1]; if (!c) return null; const r = c.getBoundingClientRect(); return [r.x + r.width*0.3, r.y + r.height*0.55]; })()`);
if (!stickO) { console.log('no-canvas'); chrome.kill(); server.close(); process.exit(1); }
let stickHeld = false, lastMove = 0, lastTacklePress = 0, tackle = null, shoot = null, holdingShoot = false, shootPressAt = 0;
const t0 = Date.now(); let iter = 0;
await tDown(1, stickO[0], stickO[1]); stickHeld = true;
let lastOwner = -99, passOut = null, lastFlash = null, lastAtts = null;
while (Date.now() - t0 < DUR * 1000) {
    const huRaw = await ev('JSON.stringify(window.__hu || null)');
    const hu = huRaw ? JSON.parse(huRaw) : null;
    const now = Date.now();
    if (!hu) { await sleep(200); continue; }
    if (++iter % 20 === 0) { const sc = await ev('JSON.stringify(window.__m ? window.__m.score : null)'); if (sc) await log({ type: 'score', wt: now, score: JSON.parse(sc) }); }
    await log({ type: 's', wt: now, ...hu });
    const attsNow = await ev('JSON.stringify(window.__atts || [])');
    if (attsNow !== lastAtts) { lastAtts = attsNow; await log({ type: 'atts', wt: now, v: JSON.parse(attsNow) }); }
    const flNow = await ev('window.__flash || null');
    if (flNow !== lastFlash) { lastFlash = flNow; if (flNow) { await log({ type: 'flash', wt: now, text: flNow }); if (/태클|패스|루즈볼/.test(flNow)) { try { await sleep(300); const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile('/tmp/flashshot-' + flNow.replace(/[^가-힣a-zA-Z0-9]/g, '') + '.png', Buffer.from(shot.result.data, 'base64')); } catch (e) { await log({ type: 'shot-error', wt: now, err: String(e) }); } } } }
    if (hu.state === 'end') { await log({ type: 'match-end', wt: now }); break; }
    // 패스아웃 감지: 상대 소유자가 바뀜
    if (lastOwner !== -99 && hu.owner !== lastOwner && lastOwner !== -1 && hu.owner !== -1 && lastOwner !== hu.hid && hu.owner !== hu.hid) {
        passOut = { type: 'ai-owner-switch', wt: now, from: lastOwner, to: hu.owner, d: Math.round(Math.hypot(hu.x - hu.bx, hu.z - hu.bz) * 100) / 100, t: hu.t };
        await log(passOut);
    }
    lastOwner = hu.owner;
    const dBall = Math.hypot(hu.x - hu.bx, hu.z - hu.bz);
    // 스틱 방향 갱신
    if (stickHeld && now - lastMove > 120 && !holdingShoot) {
        let tx = hu.bx, tz = hu.bz;
        if (hu.owner === hu.hid) { tx = 18; tz = 60; } // 내가 소유: 상대 골대로
        let dx = tx - hu.x, dz = tz - hu.z; const n = Math.hypot(dx, dz);
        if (n > 0.5) { dx /= n; dz /= n; } else { dx = 0; dz = 0; }
        await tMove(1, stickO[0] + dx * 38, stickO[1] + dz * 38);
        lastMove = now;
    }
    // 태클 시도: 상대 소유 + 근접
    if (!holdingShoot && hu.owner !== hu.hid && hu.owner !== -1 && dBall < 2.3 && now - lastTacklePress > 1500 && hu.state === 'play') {
        const c = await btnRect('패스 또는 태클');
        if (c) {
            await click(c[0], c[1]);
            lastTacklePress = now;
            tackle = { type: 'tackle-press', wt: now, t: hu.t, d: Math.round(dBall * 100) / 100, owner: hu.owner, accepted: false, outcome: 'pending' };
            // 런지·플래시 빠른 프로브(200ms 폴링이 50ms 런지를 놓치는 문제 보완)
            const probe = [];
            for (let pi = 0; pi < 14; pi++) { await sleep(40); const pr = await ev('JSON.stringify({lng: window.__hu ? window.__hu.lng : null, fl: window.__flash || null, at: window.__atts || []})'); probe.push(JSON.parse(pr)); }
            await log({ type: 'tackle-probe', wt: Date.now(), probe });
            await log(tackle);
        }
    }
    // 태클 결과 추적
    if (tackle && tackle.outcome === 'pending') {
        if (hu.lng > 0 && !tackle.accepted) { tackle.accepted = true; tackle.lngSeenAt = now; await log({ ...tackle, type: 'tackle-accepted' }); }
        if (hu.tk > 0) { tackle.outcome = 'success'; await log({ ...tackle, type: 'tackle-success', wt: now }); tackle = null; }
        else if (tackle.accepted && hu.lng <= 0) {
            if (hu.owner !== tackle.owner && hu.owner !== hu.hid) { tackle.outcome = 'owner-changed'; }
            else if (hu.owner === hu.hid) { tackle.outcome = 'loose-picked'; }
            else tackle.outcome = 'whiff';
            const fl = await ev('window.__flash || null'); await log({ ...tackle, type: 'tackle-' + tackle.outcome, wt: now, newOwner: hu.owner, flash: fl }); tackle = null;
        } else if (hu.owner !== tackle.owner) { tackle.outcome = 'pass-out-before'; await log({ ...tackle, type: 'tackle-pass-out', wt: now, newOwner: hu.owner }); tackle = null; }
        else if (now - tackle.wt > 4000) { tackle.outcome = 'timeout'; await log({ ...tackle, type: 'tackle-timeout', wt: now }); tackle = null; }
    }
    // 슛 시도: 내 소유 + 골대 근처
    const dGoal = Math.hypot(18 - hu.x, 60 - hu.z);
    if (!holdingShoot && !shoot && hu.owner === hu.hid && dGoal < 30 && hu.state === 'play') {
        const c = await ev(`(() => { const b = document.querySelector('button[aria-label^="슛"]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
        if (c) {
            await tDown(2, c[0], c[1]);
            holdingShoot = true; shootPressAt = now;
            shoot = { type: 'shoot-press', wt: now, t: hu.t, dGoal: Math.round(dGoal * 100) / 100, sh0: hu.sh, sdn0: hu.sdn, sdw0: hu.sdw, sdr0: hu.sdr };
            await log(shoot);
        }
    }
    if (holdingShoot && now - shootPressAt > 600) {
        const c = await ev(`(() => { const b = document.querySelector('button[aria-label^="슛"]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
        if (c) await tUp(2);
        holdingShoot = false;
        shoot.holdMs = now - shootPressAt; shoot.chgAtRelease = hu.chg;
        await log({ ...shoot, type: 'shoot-release', wt: now });
    }
    if (shoot && shoot.holdMs && !shoot.resolved) {
        if (hu.sh > shoot.sh0) { shoot.resolved = true; await log({ ...shoot, type: 'shoot-fired', wt: now, t: hu.t }); shoot = null; }
        else if (hu.sdn > shoot.sdn0 || hu.sdw > shoot.sdw0 || hu.sdr > shoot.sdr0) { shoot.resolved = true; await log({ ...shoot, type: 'shoot-sdg', wt: now, sdn: hu.sdn, sdw: hu.sdw, sdr: hu.sdr }); shoot = null; }
        else if (now - shoot.wt > 5000) { shoot.resolved = true; await log({ ...shoot, type: 'shoot-unresolved', wt: now, sh: hu.sh, sdn: hu.sdn, sdw: hu.sdw, sdr: hu.sdr, owner: hu.owner }); shoot = null; }
    }
    await sleep(90);
}
try { const pts = [...touches.entries()].map(([id, p]) => ({ x: p[0], y: p[1], id })); touches.clear(); if (pts.length) await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: pts }); } catch {}
const errs = await ev('JSON.stringify(window.__errors || [])');
await log({ type: 'driver-done', wt: Date.now(), errors: errs });
console.log('done', OUT);
chrome.kill(); server.close(); process.exit(0);
