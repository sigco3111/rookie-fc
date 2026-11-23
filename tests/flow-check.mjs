// node tests/flow-check.mjs — 현재 빌드(제품 동일 코드, verify) 화면 흐름 전이 검증.
// 시드는 localStorage 주입(시험 편의, 사람 플레이 아님), 버튼은 실제 UI 클릭(React onClick 경로).
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
await new Promise(r => server.listen(8150, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9235', `--user-data-dir=/tmp/flowchk-${Date.now()}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=500,760', 'about:blank'], { stdio: ['ignore','ignore','ignore'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500);
    try { const l = await (await fetch('http://127.0.0.1:9235/json/list')).json(); const t = l.find(x => x.type === 'page'); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
const ws = new WebSocket(wsUrl); await new Promise(r => ws.onopen = r);
let mid = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
await send('Page.enable');
const SK = 'rookie-soccer.v1';
const BASE = { v: 1, phase: 'result', name: '시험선수', pos: 'FW', stats: { shoot: 58, pass: 50, dribble: 54, defense: 42, speed: 52 }, season: 1, game: 1, trust: 30, ratings: [4, 4], trained: true, last: { score: [0, 1], rating: 4.1, goals: 0, assists: 0, passOk: 1, passAtt: 4, shots: 0, tackles: 0, trustD: -12, grew: '슛', gb: true }, evalRes: null, attempts: 1, legacy: 0, league: null };
let seedScriptId = null;
async function runCase(name, seed, steps) {
    if (seedScriptId) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedScriptId });
    const src = `localStorage.setItem(${JSON.stringify(SK)}, ${JSON.stringify(JSON.stringify(seed))});`;
    const r = await send('Page.addScriptToEvaluateOnNewDocument', { source: src });
    seedScriptId = r.result.identifier;
    await send('Page.navigate', { url: 'http://127.0.0.1:8150/verify.html?case=flow&fast=6' });
    await sleep(2500);
    const out = { name, steps: [] };
    for (const st of steps) {
        if (st.click) {
            const clicked = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes(${JSON.stringify(st.click)})); if (b) { b.click(); return true } return false })()`);
            await sleep(700);
            out.steps.push({ click: st.click, clicked });
            if (!clicked) { out.fail = 'button not found: ' + st.click; break; }
        }
        if (st.reload) { await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedScriptId }); seedScriptId = null; await send('Page.navigate', { url: 'http://127.0.0.1:8150/verify.html?case=flow&fast=6' }); await sleep(2500); out.steps.push({ reload: true }); }
        if (st.expect) {
            const sv = JSON.parse(await ev(`localStorage.getItem(${JSON.stringify(SK)})`) || 'null');
            const body = await ev('document.body.textContent||""');
            const checks = {};
            for (const k in st.expect.sv) { const got = k.split('.').reduce((a, c) => a?.[c], sv); checks[k] = { want: st.expect.sv[k], got, ok: got === st.expect.sv[k] }; }
            let bodyOk = true;
            if (st.expect.body) { bodyOk = st.expect.body.every(t => body.includes(t)); }
            out.steps.push({ expect: checks, bodyOk, bodyMiss: bodyOk ? [] : st.expect.body.filter(t => !body.includes(t)) });
            const bad = Object.entries(checks).filter(([, v]) => !v.ok);
            if (bad.length || !bodyOk) { out.fail = 'expect mismatch'; }
        }
    }
    return out;
}
const results = [];
// F1: 다음 경기 준비 (game 0→1)
results.push(await runCase('F1 다음경기준비', { ...BASE, game: 0, ratings: [6.0] }, [
    { click: '다음 경기 준비' },
    { expect: { sv: { phase: 'home', game: 1, trained: false }, body: ['유스 1시즌 2/2경기'] } },
]));
// F2: 미달→다음 시즌
results.push(await runCase('F2 미달 다음시즌', BASE, [
    { click: '시즌 말 승격 평가' },
    { expect: { sv: { phase: 'eval', 'evalRes.ok': false, 'evalRes.early': true }, body: ['미달'] } },
    { click: '다음 시즌' },
    { expect: { sv: { phase: 'home', season: 2, game: 0 }, body: ['유스 2시즌 1/2경기'] } },
]));
// F3: 최종 시즌 미달→재도전 계승
results.push(await runCase('F3 재도전계승', { ...BASE, season: 3 }, [
    { click: '시즌 말 승격 평가' },
    { expect: { sv: { phase: 'eval', 'evalRes.ok': false, 'evalRes.early': false } } },
    { click: '재도전' },
    { expect: { sv: { phase: 'home', season: 1, attempts: 2, trust: 40, legacy: 3, 'stats.shoot': 61, 'stats.defense': 45 }, body: ['유스 1시즌 1/2경기'] } },
]));
// F4: 조기 승격(1시즌)
results.push(await runCase('F4 조기승격', { ...BASE, season: 1, ratings: [9, 9], trust: 100, stats: { shoot: 90, pass: 80, dribble: 90, defense: 60, speed: 90 } }, [
    { click: '시즌 말 승격 평가' },
    { expect: { sv: { phase: 'eval', 'evalRes.ok': true, 'evalRes.early': true, 'evalRes.total': 100 }, body: ['조기 승격', '통과'] } },
    { click: '1군 승격' },
    { expect: { sv: { phase: 'pro' }, body: ['팀 전체를 조작'] } },
    { click: '1군 리그 시작' },
    { expect: { sv: { phase: 'league', 'league.round': 0 }, body: ['1군 1시즌 리그 1/14라운드'] } },
]));
// F5: 3시즌 기본 승격 + 저장 지속(재시드 없이 리로드)
results.push(await runCase('F5 기본승격+지속', { ...BASE, season: 3, ratings: [8, 8], trust: 60, stats: { shoot: 75, pass: 65, dribble: 70, defense: 55, speed: 65 } }, [
    { click: '시즌 말 승격 평가' },
    { expect: { sv: { phase: 'eval', 'evalRes.ok': true, 'evalRes.early': false }, body: ['기본 승격', '통과'] } },
    { click: '1군 승격' },
    { click: '1군 리그 시작' },
    { expect: { sv: { phase: 'league', 'league.round': 0 }, body: ['1군 1시즌 리그 1/14라운드'] } },
    { reload: true },
    { expect: { sv: { phase: 'league', 'league.round': 0 }, body: ['1군 1시즌 리그 1/14라운드'] } },
]));
for (const r of results) console.log(JSON.stringify(r));
chrome.kill(); server.close(); process.exit(0);
