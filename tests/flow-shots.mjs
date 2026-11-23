// node tests/flow-shots.mjs — 전이 검증 결정적 화면 캡처(시드 주입 시험 편의, 실제 UI 클릭)
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname;
const server = http.createServer(async (req, res) => {
    try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html';
        const data = await readFile(path.join(ROOT, p));
        res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff': 'font/woff', '.json': 'application/json' }[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(8152, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9237', `--user-data-dir=/tmp/flowshot-${Date.now()}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,760', 'about:blank'], { stdio: ['ignore','ignore','ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9237/json/list')).json(); const t = l.find(x => x.type === 'page'); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
const ws = new WebSocket(wsUrl); await new Promise(r => ws.onopen = r);
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
await send('Page.enable');
const SK = 'rookie-soccer.v1';
const shot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(file, Buffer.from(r.result.data, 'base64')); };
const click = async (txt) => { const c = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes(${JSON.stringify(txt)})); if (b) { b.click(); return true } return false })()`); await sleep(700); return c; };
let sid = null;
async function seedAndGo(seed) {
    if (sid) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: sid });
    const r = await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem(${JSON.stringify(SK)}, ${JSON.stringify(JSON.stringify(seed))});` });
    sid = r.result.identifier;
    await send('Page.navigate', { url: 'http://127.0.0.1:8152/verify.html?case=flow&fast=6' });
    await sleep(2500);
}
const BASE = { v: 1, phase: 'result', name: '시험선수', pos: 'FW', stats: { shoot: 58, pass: 50, dribble: 54, defense: 42, speed: 52 }, season: 1, game: 1, trust: 30, ratings: [4, 4], trained: true, last: { score: [0, 1], rating: 4.1, goals: 0, assists: 0, passOk: 1, passAtt: 4, shots: 0, tackles: 0, trustD: -12, grew: '슛', gb: true }, evalRes: null, attempts: 1, legacy: 0, league: null };
// F3: 최종 시즌 미달 → 재도전
await seedAndGo({ ...BASE, season: 3 });
console.log('F3 평가:', await click('시즌 말 승격 평가')); await shot('/tmp/shot-f3-eval.png');
console.log('F3 재도전:', await click('재도전')); await shot('/tmp/shot-f3-home.png');
// F4: 조기 승격
await seedAndGo({ ...BASE, season: 1, ratings: [9, 9], trust: 100, stats: { shoot: 90, pass: 80, dribble: 90, defense: 60, speed: 90 } });
console.log('F4 평가:', await click('시즌 말 승격 평가')); await shot('/tmp/shot-f4-eval.png');
console.log('F4 승격:', await click('1군 승격')); await shot('/tmp/shot-f4-pro.png');
// F6: 리그 종료 → 다음 시즌
const TEAM_NAMES = ['우리 구단', '한강 FC', '파도 FC', '북악 FC', '남해 FC', '새벽 FC', '청룡 FC', '은하 FC'];
const schedule = () => { const ids = [0,1,2,3,4,5,6,7]; const rounds = [];
    for (let r = 0; r < 7; r++) { const pairs = []; for (let i = 0; i < 4; i++) pairs.push(r % 2 ? [ids[7-i], ids[i]] : [ids[i], ids[7-i]]); rounds.push(pairs); ids.splice(1, 0, ids.pop()); }
    return [...rounds, ...rounds.map(r => r.map(p => [p[1], p[0]]))]; };
const strs = [64, 52, 56, 60, 64, 68, 72, 58];
const teams = TEAM_NAMES.map((n, i) => ({ id: i, n, str: strs[i], p: 13, w: i === 0 ? 5 : 4, d: 3, l: i === 0 ? 5 : 6, gf: 15 + i, ga: 10 + i }));
const log13 = Array.from({ length: 13 }, (_, i) => ({ rating: 0, goals: 0, assists: 0, played: false, sc: [1, (i % 3)], vs: TEAM_NAMES[(i % 7) + 1] }));
await seedAndGo({ v: 1, phase: 'league', name: '시험선수', pos: 'FW', stats: { shoot: 70, pass: 62, dribble: 66, defense: 50, speed: 64 }, season: 3, game: 1, trust: 70, ratings: [], trained: false, last: null, evalRes: null, attempts: 1, legacy: 0, proSeason: 1, hist: [], league: { round: 13, teams, fixtures: schedule(), log: log13, lastMsg: '우리 구단 1 : 1 은하 FC' } });
console.log('F6 자동:', await click('자동 진행')); await shot('/tmp/shot-f6-end.png');
console.log('F6 다음시즌:', await click('시즌 시작 (성장 적용)')); await shot('/tmp/shot-f6-next.png');
chrome.kill(); server.close(); process.exit(0);
