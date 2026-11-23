// vt5: 후보 v3 적용 검증(강제조건) — 컨텍스트 손실 시 자동 일시정지·배너·복구 후 수동 재개, 수동 일시정지 보존, 치명 frame 오류 전용 오버레이·나가기 경로.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname; const PORT = 8362;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff' };
const server = http.createServer(async (req, res) => { try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html'; const d = await readFile(path.join(ROOT, p)); res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); } catch { res.writeHead(404); res.end('nf'); } });
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = {};

async function launch(tag, port) {
  const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/vt5-${tag}-${process.pid}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=800,900', `http://127.0.0.1:${PORT}/verify.html?dbg=1&fast=1&noauto=1&case=pro`], { stdio: ['ignore', 'ignore', 'ignore'] });
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
  return { chrome, ev, shot, hu, txt };
}
async function enterMatch(ctx) {
  for (let i = 0; i < 25; i++) { await ctx.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent.includes('직접 뛰기')); if (b) { b.click(); return 1; } return 0; })()`); await sleep(1200); if (await ctx.hu()) return true; }
  return false;
}
async function waitPlay(ctx) { const t0 = Date.now(); while (Date.now() - t0 < 45000) { const h = await ctx.hu(); if (h && h.state === 'play') return h; await sleep(200); } return null; }
const BANNER = '그래픽 연결이 끊겨 복구를 시도하고 있습니다';

// 시나리오1: 플레이 중 손실 → 자동 일시정지+배너, 복구 → 배너 해제·수동 재개 대기, 계속하기 → 재개
{
  const ctx = await launch('s1', 9462); const S = {};
  if (!(await enterMatch(ctx)) || !(await waitPlay(ctx))) S.skip = true;
  else {
    await ctx.ev(`(() => { const c = document.querySelectorAll('canvas')[0]; const gl = c.getContext('webgl2') || c.getContext('webgl'); window.__ext = gl.getExtension('WEBGL_lose_context'); return 0; })()`);
    await ctx.ev('window.__ext.loseContext(); 0');
    await sleep(2000);
    const t1 = (await ctx.hu())?.t; await sleep(1000); const t2 = (await ctx.hu())?.t;
    S.simPausedDuringLoss = (t1 !== undefined && t1 === t2);
    const body1 = await ctx.txt();
    S.bannerShown = body1.includes(BANNER);
    S.pauseOverlayShown = body1.includes('계속하기');
    await ctx.shot('/tmp/vt5-s1-lost.png');
    await ctx.ev('window.__ext.restoreContext(); 0');
    await sleep(2500);
    const body2 = await ctx.txt();
    S.bannerClearedAfterRestore = !body2.includes(BANNER);
    S.stillPausedAfterRestore = body2.includes('계속하기');
    const t3 = (await ctx.hu())?.t; await sleep(800); const t4 = (await ctx.hu())?.t;
    S.simStillPausedAfterRestore = (t3 !== undefined && t3 === t4);
    await ctx.shot('/tmp/vt5-s1-restored.png');
    await ctx.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent === '계속하기'); if (b) { b.click(); return 1; } return 0; })()`);
    await sleep(1500);
    const t5 = (await ctx.hu())?.t; await sleep(800); const t6 = (await ctx.hu())?.t;
    S.resumedAfterManualContinue = (t6 !== undefined && t5 !== undefined && t6 > t5);
    await ctx.shot('/tmp/vt5-s1-resumed.png');
  }
  out.S1 = S; ctx.chrome.kill();
}

// 시나리오2: 수동 일시정지 상태에서 손실/복구 → 자동 해제 없이 일시정지 유지
{
  const ctx = await launch('s2', 9463); const S = {};
  if (!(await enterMatch(ctx)) || !(await waitPlay(ctx))) S.skip = true;
  else {
    await ctx.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent === '일시정지'); if (b) { b.click(); return 1; } return 0; })()`);
    await sleep(600);
    await ctx.ev(`(() => { const c = document.querySelectorAll('canvas')[0]; const gl = c.getContext('webgl2') || c.getContext('webgl'); window.__ext = gl.getExtension('WEBGL_lose_context'); return 0; })()`);
    await ctx.ev('window.__ext.loseContext(); 0');
    await sleep(1500);
    S.bannerShownWhileManualPause = (await ctx.txt()).includes(BANNER);
    await ctx.ev('window.__ext.restoreContext(); 0');
    await sleep(2000);
    const body = await ctx.txt();
    S.bannerCleared = !body.includes(BANNER);
    S.manualPausePreserved = body.includes('계속하기');
    const t1 = (await ctx.hu())?.t; await sleep(800); const t2 = (await ctx.hu())?.t;
    S.simStillPaused = (t1 !== undefined && t1 === t2);
  }
  out.S2 = S; ctx.chrome.kill();
}

// 시나리오3: 치명 frame 오류 → 전용 오버레이(계속하기 없음, 경기 나가기 동작)
{
  const ctx = await launch('s3', 9464); const S = {};
  if (!(await enterMatch(ctx)) || !(await waitPlay(ctx))) S.skip = true;
  else {
    await ctx.ev('window.confirm = () => true; 0');
    await ctx.ev('window.__m.players[window.__hu.hid] = null; 0');
    await sleep(1500);
    const body = await ctx.txt();
    S.fatalOverlayShown = body.includes('화면 표시에 문제가 생겼습니다');
    S.noContinueButton = !(await ctx.ev(`!![...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent === '계속하기')`));
    S.quitButtonVisible = await ctx.ev(`!![...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent === '경기 나가기')`);
    await ctx.shot('/tmp/vt5-s3-fatal.png');
    S.quitWorks = await ctx.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent === '경기 나가기'); if (b) { b.click(); return true; } return false; })()`);
    await sleep(1500);
    S.backHome = (await ctx.txt()).includes('직접 뛰기');
    await ctx.shot('/tmp/vt5-s3-home.png');
    S.errors = await ctx.ev('JSON.stringify(window.__errors)');
  }
  out.S3 = S; ctx.chrome.kill();
}
server.close();
console.log(JSON.stringify(out, null, 1));
