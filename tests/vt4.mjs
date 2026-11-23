// vt4: 강제조건 재현 — (A) frame() 내 예외 시 화면/루프 동작, (B) WebGL 컨텍스트 손실·복구 시 화면/시뮬 동작. 제품 번들(verify-dist 기존 빌드, 후보 패치 미적용) 기준.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = new URL('../verify-dist/', import.meta.url).pathname; const PORT = 8360;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip', '.woff': 'font/woff' };
const server = http.createServer(async (req, res) => { try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/verify.html'; const d = await readFile(path.join(ROOT, p)); res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); } catch { res.writeHead(404); res.end('nf'); } });
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = {};

async function launch(tag, port) {
  const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/vt4-${tag}-${process.pid}`, '--no-first-run', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=800,900', `http://127.0.0.1:${PORT}/verify.html?dbg=1&fast=1&noauto=1&case=pro`], { stdio: ['ignore', 'ignore', 'ignore'] });
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500); try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const t = l.find(x => x.type === 'page' && x.url.includes('verify.html')); if (t) wsUrl = t.webSocketDebuggerUrl; } catch {} }
  const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let mid = 0; const pend = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
  const shot = async f => { const r = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(f, Buffer.from(r.result.data, 'base64')); };
  const hu = async () => { const s = await ev('window.__hu ? JSON.stringify(window.__hu) : null'); return s ? JSON.parse(s) : null; };
  return { chrome, ev, shot, hu };
}

async function enterMatch(ctx) {
  for (let i = 0; i < 25; i++) { await ctx.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent.includes('직접 뛰기')); if (b) { b.click(); return 1; } return 0; })()`); await sleep(1200); if (await ctx.hu()) return true; }
  return false;
}
async function waitPlay(ctx) { const t0 = Date.now(); while (Date.now() - t0 < 45000) { const h = await ctx.hu(); if (h && h.state === 'play') return h; await sleep(200); } return null; }

// ---- 실험 A: frame() 내 예외 ----
{
  const ctx = await launch('a', 9460);
  const A = {};
  if (!(await enterMatch(ctx)) || !(await waitPlay(ctx))) { A.skip = true; }
  else {
    await ctx.shot('/tmp/vt4a-before.png');
    const t0 = (await ctx.hu()).t;
    await ctx.ev('window.__m.players[window.__hu.hid] = null; 0'); // 강제조건: 조작 선수 참조 파괴 → 다음 프레임 hu 접근에서 TypeError
    await sleep(1500);
    A.errors = await ctx.ev('JSON.stringify(window.__errors)');
    const t1 = (await ctx.hu())?.t; await sleep(1000); const t2 = (await ctx.hu())?.t;
    A.tInject = t0; A.tAfter1 = t1; A.tAfter2 = t2; A.simFrozen = (t1 !== undefined && t1 === t2);
    await ctx.shot('/tmp/vt4a-after.png');
    A.msgShown = await ctx.ev(`(() => { const b = document.body.textContent; return b.includes('3D 표시 실패') || b.includes('표시 오류') ? b.match(/3D 표시 실패[^\\n]*|표시 오류[^\\n]*/)?.[0] : null; })()`);
    // 오류 후 탈출 경로: 일시정지 → 경기 나가기
    await ctx.ev('window.confirm = () => true; 0');
    A.pauseClickable = await ctx.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent === '일시정지'); if (b) { b.click(); return true; } return false; })()`);
    await sleep(600);
    A.pauseOverlayShown = await ctx.ev(`document.body.textContent.includes('계속하기')`);
    await ctx.shot('/tmp/vt4a-pause.png');
    A.quitClickable = await ctx.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent === '경기 나가기'); if (b) { b.click(); return true; } return false; })()`);
    await sleep(1200);
    A.backHome = await ctx.ev(`document.body.textContent.includes('직접 뛰기') || document.body.textContent.includes('유스')`);
    await ctx.shot('/tmp/vt4a-home.png');
  }
  out.A = A; ctx.chrome.kill();
}

// ---- 실험 B: 컨텍스트 손실/복구 ----
{
  const ctx = await launch('b', 9461);
  const B = {};
  if (!(await enterMatch(ctx)) || !(await waitPlay(ctx))) { B.skip = true; }
  else {
    B.extAvailable = await ctx.ev(`(() => { const c = document.querySelectorAll('canvas')[0]; const gl = c.getContext('webgl2') || c.getContext('webgl'); window.__ext = gl.getExtension('WEBGL_lose_context'); return !!window.__ext; })()`);
    if (B.extAvailable) {
      await ctx.shot('/tmp/vt4b-before.png');
      await ctx.ev('window.__ext.loseContext(); 0');
      await sleep(2500);
      const t1 = (await ctx.hu())?.t; await sleep(1000); const t2 = (await ctx.hu())?.t;
      B.simAdvancingDuringLoss = (t1 !== undefined && t2 !== undefined && t2 > t1);
      B.errorsDuringLoss = await ctx.ev('JSON.stringify(window.__errors)');
      await ctx.shot('/tmp/vt4b-lost.png');
      B.bodyTextDuringLoss = (await ctx.ev('document.body.textContent')).slice(0, 200);
      await ctx.ev('window.__ext.restoreContext(); 0');
      await sleep(3000);
      await ctx.shot('/tmp/vt4b-restored.png');
      const t3 = (await ctx.hu())?.t;
      B.simAliveAfterRestore = (t3 !== undefined && t2 !== undefined && t3 > t2);
      B.errorsAfterRestore = await ctx.ev('JSON.stringify(window.__errors)');
    }
  }
  out.B = B; ctx.chrome.kill();
}
server.close();
console.log(JSON.stringify(out, null, 1));
