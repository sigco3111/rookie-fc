// vt6: 후보 v4 검증(강제조건) — 소실 중 계속하기/P 재개 차단, 복구 후 수동 재개, 나가기→리그 유지(자동 재진입 없음).
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname; const PORT = 8364;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff' };
const server = http.createServer(async (req, res) => { try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html'; const d = await readFile(path.join(ROOT, p)); res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); } catch { res.writeHead(404); res.end('nf'); } });
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = {};
async function launch(tag, port) {
  const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/vt6-${tag}-${process.pid}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=800,900', `http://127.0.0.1:${PORT}/verify.html?dbg=1&fast=1&noauto=1&case=pro`], { stdio: ['ignore', 'ignore', 'ignore'] });
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500); try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
  const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let mid = 0; const pend = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
  const shot = async f => { const r = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(f, Buffer.from(r.result.data, 'base64')); };
  const hu = async () => { const s = await ev('window.__hu ? JSON.stringify(window.__hu) : null'); return s ? JSON.parse(s) : null; };
  const txt = () => ev('document.body.textContent');
  const key = (type, k) => ev(`window.dispatchEvent(new KeyboardEvent('${type}', { key: '${k}', bubbles: true }))`);
  return { chrome, ev, shot, hu, txt, key };
}
async function enterMatch(ctx) {
  for (let i = 0; i < 25; i++) { await ctx.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent.includes('직접 뛰기')); if (b) { b.click(); return 1; } return 0; })()`); await sleep(1200); if (await ctx.hu()) return true; }
  return false;
}
async function waitPlay(ctx) { const t0 = Date.now(); while (Date.now() - t0 < 45000) { const h = await ctx.hu(); if (h && h.state === 'play') return h; await sleep(200); } return null; }
const BANNER = '그래픽 연결이 끊겨 복구를 시도하고 있습니다';

// S1: 손실 중 계속하기/P 차단 → 복구 후 수동 재개
{
  const ctx = await launch('s1', 9466); const S = {};
  if (!(await enterMatch(ctx)) || !(await waitPlay(ctx))) S.skip = true;
  else {
    await ctx.ev(`(() => { const c = document.querySelectorAll('canvas')[0]; const gl = c.getContext('webgl2') || c.getContext('webgl'); window.__ext = gl.getExtension('WEBGL_lose_context'); return 0; })()`);
    await ctx.ev('window.__ext.loseContext(); 0');
    await sleep(1800);
    const t1 = (await ctx.hu())?.t;
    // 소실 중 계속하기 클릭 시도
    S.continueDisabledDuringLoss = await ctx.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent === '복구 대기 중'); return b ? b.disabled === true : null; })()`);
    S.continueClickedDuringLoss = await ctx.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent === '복구 대기 중'); if (b) { b.click(); return true; } return false; })()`);
    await sleep(1200);
    const t2 = (await ctx.hu())?.t; await sleep(800); const t3 = (await ctx.hu())?.t;
    S.simFrozenAfterContinueClick = (t2 !== undefined && t3 !== undefined && t2 === t3);
    // 소실 중 P 키 시도
    await ctx.key('keydown', 'p'); await sleep(300); await ctx.key('keyup', 'p');
    await sleep(1000);
    const t4 = (await ctx.hu())?.t; await sleep(800); const t5 = (await ctx.hu())?.t;
    S.simFrozenAfterPKey = (t4 !== undefined && t4 === t5);
    S.bannerStillShown = (await ctx.txt()).includes(BANNER);
    S.overlayStillShown = (await ctx.txt()).includes('복구 대기 중');
    await ctx.shot('/tmp/vt6-s1-blocked.png');
    S.tFrozen = [t1, t3, t5];
    // 복구 → 수동 재개
    await ctx.ev('window.__ext.restoreContext(); 0');
    await sleep(2000);
    S.bannerClearedAfterRestore = !(await ctx.txt()).includes(BANNER);
    S.stillPausedAfterRestore = (await ctx.txt()).includes('계속하기');
    await ctx.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent === '계속하기'); if (b) { b.click(); return 1; } return 0; })()`);
    await sleep(1500);
    const t6 = (await ctx.hu())?.t; await sleep(800); const t7 = (await ctx.hu())?.t;
    S.resumedAfterRestoreAndClick = (t6 !== undefined && t7 !== undefined && t7 > t6);
  }
  out.S1 = S; ctx.chrome.kill();
}

// S2: 치명 오류 → 나가기 → 리그 화면 유지(자동 재진입 없음)
{
  const ctx = await launch('s2', 9467); const S = {};
  if (!(await enterMatch(ctx)) || !(await waitPlay(ctx))) S.skip = true;
  else {
    await ctx.ev('window.confirm = () => true; 0');
    await ctx.ev('window.__m.players[window.__hu.hid] = null; 0');
    await sleep(1500);
    S.fatalOverlayShown = (await ctx.txt()).includes('화면 표시에 문제가 생겼습니다');
    S.quitClicked = await ctx.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent === '경기 나가기'); if (b) { b.click(); return true; } return false; })()`);
    await sleep(3000);
    const body = await ctx.txt();
    S.leagueShown = body.includes('라운드') || body.includes('리그');
    S.noAutoReentry = !(await ctx.ev(`!![...document.querySelectorAll('button')].find(b => b.offsetParent && (b.textContent || '').trim() === '슛')`));
    await sleep(2500);
    const body2 = await ctx.txt();
    S.stillLeagueAfterWait = (body2.includes('라운드') || body2.includes('리그')) && !(await ctx.ev(`!![...document.querySelectorAll('button')].find(b => b.offsetParent && (b.textContent || '').trim() === '슛')`));
    await ctx.shot('/tmp/vt6-s2-league.png');
  }
  out.S2 = S; ctx.chrome.kill();
}
server.close();
console.log(JSON.stringify(out, null, 1));
