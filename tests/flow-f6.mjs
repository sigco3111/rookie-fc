// node tests/flow-f6.mjs — 리그 13라운드 주입(시험 편의) → 자동 진행 → 시즌 종료 → 다음 시즌 전이 검증
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff': 'font/woff', '.json': 'application/json' }[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(8151, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9236', `--user-data-dir=/tmp/flowf6-${Date.now()}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,760', 'about:blank'], { stdio: ['ignore','ignore','ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9236/json/list')).json(); const t = l.find(x => x.type === 'page'); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
const ws = new WebSocket(wsUrl); await new Promise(r => ws.onopen = r);
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
await send('Page.enable');
const SK = 'rookie-soccer.v1';
const TEAM_NAMES = ['우리 구단', '한강 FC', '파도 FC', '북악 FC', '남해 FC', '새벽 FC', '청룡 FC', '은하 FC'];
function schedule() { const ids = [0,1,2,3,4,5,6,7]; const rounds = [];
    for (let r = 0; r < 7; r++) { const pairs = []; for (let i = 0; i < 4; i++) pairs.push(r % 2 ? [ids[7-i], ids[i]] : [ids[i], ids[7-i]]); rounds.push(pairs); ids.splice(1, 0, ids.pop()); }
    return [...rounds, ...rounds.map(r => r.map(p => [p[1], p[0]]))]; }
const strs = [64, 52, 56, 60, 64, 68, 72, 58];
const teams = TEAM_NAMES.map((n, i) => ({ id: i, n, str: strs[i], p: 13, w: i === 0 ? 5 : 4, d: 3, l: i === 0 ? 5 : 6, gf: 15 + i, ga: 10 + i }));
const log13 = Array.from({ length: 13 }, (_, i) => ({ rating: 0, goals: 0, assists: 0, played: false, sc: [1, (i % 3)], vs: TEAM_NAMES[(i % 7) + 1] }));
const seed = { v: 1, phase: 'league', name: '시험선수', pos: 'FW', stats: { shoot: 70, pass: 62, dribble: 66, defense: 50, speed: 64 }, season: 3, game: 1, trust: 70, ratings: [], trained: false, last: null, evalRes: null, attempts: 1, legacy: 0, proSeason: 1, hist: [],
    league: { round: 13, teams, fixtures: schedule(), log: log13, lastMsg: '우리 구단 1 : 1 은하 FC' } };
await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem(${JSON.stringify(SK)}, ${JSON.stringify(JSON.stringify(seed))});` });
await send('Page.navigate', { url: 'http://127.0.0.1:8151/verify.html?case=flow&fast=6' });
await sleep(2500);
const out = { name: 'F6 리그종료→다음시즌', steps: [] };
const snap = async (label) => { const sv = JSON.parse(await ev(`localStorage.getItem(${JSON.stringify(SK)})`) || 'null'); const body = await ev('document.body.textContent||""'); return { label, phase: sv?.phase, round: sv?.league?.round, proSeason: sv?.proSeason, histLen: (sv?.hist || []).length, grow: sv?.grow ? { n: sv.grow.n, rk: sv.grow.rk } : null, growToEqStats: sv?.grow ? JSON.stringify(sv.grow.to) === JSON.stringify(sv.stats) : null, bodyHas: { seasonEnd: body.includes('시즌 종료'), corrupt: body.includes('손상되어'), next2: body.includes('1군 2시즌 리그 1/14라운드') } }; };
out.steps.push(await snap('seeded'));
let clicked = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('자동 진행')); if (b) { b.click(); return true } return false })()`);
out.steps.push({ click: '자동 진행', clicked });
await sleep(700);
out.steps.push(await snap('afterAuto'));
clicked = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('시즌 시작 (성장 적용)')); if (b) { b.click(); return true } return false })()`);
out.steps.push({ click: '시즌 시작 (성장 적용)', clicked });
await sleep(700);
out.steps.push(await snap('afterNext'));
console.log(JSON.stringify(out, null, 1));
chrome.kill(); server.close(); process.exit(0);
