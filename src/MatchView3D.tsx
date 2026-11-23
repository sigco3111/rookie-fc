import React, { useEffect, useRef, useState } from 'react';
import { W, L, GOAL_HALF, makeMatch, step, rating, type Match, type Stats, type Pos, type Rec, type Input } from './engine';
import hudUrl from './models/hud.woff?url';
import { loadAssets, Rig, T } from './rig';

const CW = 390, CH = 590;
declare const __TEST_HOOKS__: boolean;
const DBG = typeof __TEST_HOOKS__ !== 'undefined' && __TEST_HOOKS__ && typeof location !== 'undefined' && new URLSearchParams(location.search).has('dbg');
const FASTN = DBG ? Math.max(1, Math.min(90, parseInt(new URLSearchParams(location.search).get('fast') || '1', 10) || 1)) : 1;
export interface Result { score: [number, number]; rec: Rec; rating: number }

function pitchTexture() {
    const c = document.createElement('canvas'); c.width = 720; c.height = 1200; const g = c.getContext('2d')!; const k = 20; // 1m = 20px
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#2f7d3a' : '#2a7035'; g.fillRect(0, i * 120, 720, 120); }
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 5;
    g.strokeRect(3, 3, 714, 1194); g.beginPath(); g.moveTo(0, 600); g.lineTo(720, 600); g.stroke();
    g.beginPath(); g.arc(360, 600, 5 * k, 0, Math.PI * 2); g.stroke();
    g.strokeRect(360 - 9 * k, 3, 18 * k, 9 * k); g.strokeRect(360 - 4 * k, 3, 8 * k, 3.5 * k);
    g.strokeRect(360 - 9 * k, 1197 - 9 * k, 18 * k, 9 * k); g.strokeRect(360 - 4 * k, 1197 - 3.5 * k, 8 * k, 3.5 * k);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function MatchView({ stats, pos, oppStr, teamControl, halfLen, onFinish, onQuit }: { stats: Stats; pos: Pos; oppStr: number; teamControl: boolean; halfLen: number; onFinish: (r: Result) => void; onQuit?: () => void }) {
    const gl = useRef<HTMLCanvasElement>(null);
    const hud = useRef<HTMLCanvasElement>(null);
    const inp = useRef({ mx: 0, mz: 0, passPressed: false, shootDown: false, shootReleased: false, switchPressed: false, keys: {} as Record<string, boolean> });
    const stick = useRef<{ id: number; ox: number; oy: number } | null>(null);
    const finished = useRef(false);
    const shotCancel = useRef(0); const prevTk = useRef(0); const lgPrev = useRef<Record<number, number>>({}); const tAtts = useRef<{ pid: number; tk: number }[]>([]);
    const passBtn = useRef<HTMLButtonElement>(null);
    const [msg, setMsg] = useState('3D 모델 불러오는 중');
    const [hint, setHint] = useState('');
    const hintSeq = useRef(0);
    const flash = (t: string) => { const n = ++hintSeq.current; setHint(t); setTimeout(() => { if (hintSeq.current === n) setHint(''); }, 1600); };
    const paused = useRef(false); const [ps, setPs] = useState(false); const [glLost, setGlLost] = useState(false); const glLostRef = useRef(false); const [fatalErr, setFatalErr] = useState(false);
    const setPause = (v: boolean) => { paused.current = v; setPs(v); if (v) { const I = inp.current; I.mx = 0; I.mz = 0; I.shootDown = false; for (const k in I.keys) I.keys[k] = false; } };
    useEffect(() => { const h = () => { if (document.hidden) setPause(true); }; document.addEventListener('visibilitychange', h); return () => document.removeEventListener('visibilitychange', h); }, []);

    useEffect(() => {
        let raf = 0, alive = true; let renderer: any = null;
        const m: Match = makeMatch(stats, pos, oppStr, teamControl, halfLen);
        const g = hud.current!.getContext('2d')!;
        const kd = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
            if (k === 'p' && !e.repeat) { if (!glLostRef.current) setPause(!paused.current); return; }
            if (!inp.current.keys[k]) { if (k === ' ' || k === 'j') inp.current.passPressed = true; if (k === 'l' || k === 'q') inp.current.switchPressed = true; if (k === 'k') inp.current.shootDown = true; }
            inp.current.keys[k] = true;
        };
        const ku = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); inp.current.keys[k] = false; if (k === 'k') { inp.current.shootDown = false; inp.current.shootReleased = true; } };
        window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
        (async () => {
            try {
                renderer = new T.WebGLRenderer({ canvas: gl.current!, antialias: true });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(CW, CH, false);
                try { const ff = new FontFace('RSHud', `url(${hudUrl})`); await ff.load(); document.fonts.add(ff); } catch {}
                const A = await loadAssets(); if (!alive) return;
                const scene = new T.Scene(); scene.background = new T.Color(0x86b9e0); scene.fog = new T.Fog(0x86b9e0, 55, 110);
                scene.add(new T.HemisphereLight(0xffffff, 0x4a6a4a, 1.9)); const dl = new T.DirectionalLight(0xffffff, 1.6); dl.position.set(10, 30, 20); scene.add(dl);
                const ground = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({ color: 0x2a6a33 })); ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, -0.02, L / 2); scene.add(ground);
                const pitch = new T.Mesh(new T.PlaneGeometry(W, L), new T.MeshStandardMaterial({ map: pitchTexture() })); pitch.rotation.x = -Math.PI / 2; pitch.position.set(W / 2, 0, L / 2); scene.add(pitch);
                // 골대
                const post = new T.MeshStandardMaterial({ color: 0xffffff }); const net = new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: T.DoubleSide });
                for (const z of [0, L]) {
                    const d = z === 0 ? -1 : 1;
                    for (const sx of [-1, 1]) { const p = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 2.4, 8), post); p.position.set(W / 2 + sx * GOAL_HALF, 1.2, z); scene.add(p); }
                    const bar = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, GOAL_HALF * 2, 8), post); bar.rotation.z = Math.PI / 2; bar.position.set(W / 2, 2.4, z); scene.add(bar);
                    const back = new T.Mesh(new T.PlaneGeometry(GOAL_HALF * 2, 2.4), net); back.position.set(W / 2, 1.2, z + d * 1.8); scene.add(back);
                    const top = new T.Mesh(new T.PlaneGeometry(GOAL_HALF * 2, 1.8), net); top.rotation.x = Math.PI / 2; top.position.set(W / 2, 2.4, z + d * 0.9); scene.add(top);
                }
                const rigs = m.players.map(p => { const r = new Rig(A, p.role === 'GK' ? 2 : p.team); r.holder.rotation.order = 'YXZ'; scene.add(r.holder); return r; });
                const blob = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 });
                const shadows = m.players.map(() => { const s = new T.Mesh(new T.CircleGeometry(0.55, 16), blob); s.rotation.x = -Math.PI / 2; s.position.y = 0.01; scene.add(s); return s; });
                const ring = new T.Mesh(new T.RingGeometry(0.7, 0.9, 24), new T.MeshBasicMaterial({ color: 0xffe14d, side: T.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; scene.add(ring);
                const arrow = new T.Mesh(new T.ConeGeometry(0.28, 0.5, 4), new T.MeshBasicMaterial({ color: 0xffe14d })); arrow.rotation.x = Math.PI; scene.add(arrow);
                const ball = new T.Mesh(new T.SphereGeometry(0.22, 18, 14), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })); scene.add(ball);
                const bs = new T.Mesh(new T.CircleGeometry(0.28, 12), blob); bs.rotation.x = -Math.PI / 2; bs.position.y = 0.012; scene.add(bs);
                const cam = new T.PerspectiveCamera(52, CW / CH, 0.5, 200); let cx = W / 2, cz = L - 4;
                setMsg('');
                renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glLostRef.current = true; setGlLost(true); if (!paused.current) setPause(true); });
                renderer.domElement.addEventListener('webglcontextrestored', () => { glLostRef.current = false; setGlLost(false); });
                let last = performance.now(), endT = 0;
                let frameErr = false;
                const frame = (now: number) => {
                    if (!alive) return; try {
                    const dt = Math.min((now - last) / 1000, 0.1); last = now;
                    const I = inp.current; const k = I.keys;
                    const kx = (k['arrowright'] || k['d'] ? 1 : 0) - (k['arrowleft'] || k['a'] ? 1 : 0), kz = (k['arrowdown'] || k['s'] ? 1 : 0) - (k['arrowup'] || k['w'] ? 1 : 0);
                    let mx = I.mx, mz = I.mz; if (kx || kz) { mx = kx; mz = kz; }
                    const inputObj: Input = { mx, mz, passPressed: I.passPressed, shootDown: I.shootDown, shootReleased: I.shootReleased, switchPressed: I.switchPressed };
                    if (!paused.current && !glLostRef.current) { if (inputObj.shootReleased && m.state === 'play' && m.ball.owner !== m.players[m.humanId]) flash('공이 없어 슛이 안 나갔다'); if (FASTN > 1) { for (let i = 0; i < FASTN && m.state !== 'end'; i++) step(m, 1 / 60, i === 0 ? inputObj : { ...inputObj, passPressed: false, shootReleased: false, switchPressed: false }); } else step(m, dt, inputObj); } I.passPressed = false; I.shootReleased = false; I.switchPressed = false;
                    const hu = m.players[m.humanId]; const want = m.ball.owner === hu ? '패스' : '태클'; if (passBtn.current && passBtn.current.textContent !== want) passBtn.current.textContent = want;
                    if (m.rec.tackles > prevTk.current) { prevTk.current = m.rec.tackles; flash('태클로 공을 빼앗았다'); } // 태클 성공 피드백(엔진은 성공 시 rec.tackles만 증가)
                    // 태클 시도 추적: 시작은 조작 선수의 런지 상승 에지, 종료는 시도별 선수 자신의 하강 에지(선수별 직전값 맵). 전환/연속 시도가 겹쳐도 시도 단위로 독립 판정
                    const prevMap = lgPrev.current;
                    if (hu.lunge > 0 && (prevMap[m.humanId] ?? 0) <= 0) tAtts.current.push({ pid: m.humanId, tk: m.ball.owner && m.ball.owner.team !== hu.team ? m.rec.tackles : -1 });
                    tAtts.current = tAtts.current.filter(a => { const p = m.players[a.pid]; const pv = prevMap[a.pid] ?? 0; if (p.lunge <= 0 && pv > 0) { if (a.tk >= 0 && m.rec.tackles === a.tk) flash('태클이 빗나갔다'); return false; } return true; });
                    m.players.forEach(p => { prevMap[p.id] = p.lunge; });
                    if (DBG) { (window as any).__m = m; (window as any).__atts = tAtts.current.map(a => a.pid + ':' + a.tk); (window as any).__hu = { x: hu.x, z: hu.z, t: m.t, state: m.state, owner: m.ball.owner ? m.ball.owner.id : -1, hid: m.humanId, mx: I.mx, mz: I.mz, sd: I.shootDown, pa: m.rec.passAtt, po: m.rec.passOk, gl: m.rec.goals, tk: m.rec.tackles, bx: m.ball.x, bz: m.ball.z, lng: hu.lunge, sdn: m.rec.sdg?.n ?? 0, sdw: m.rec.sdg?.w ?? 0, sdr: m.rec.sdg?.r ?? 0, sdc: shotCancel.current, sh: m.rec.shots, chg: Math.round(m.charge * 100) / 100 }; }
                    m.players.forEach((p, i) => {
                        const sp = Math.hypot(p.vx, p.vz); rigs[i].update(dt, p.x, p.z, p.h, sp, p.kick ? Math.min(1, p.kick.t / 0.42) : -1); rigs[i].holder.rotation.x = p.lunge > 0 ? 0.5 * (p.lunge / 0.3) : 0; shadows[i].position.x = p.x; shadows[i].position.z = p.z;
                    });
                    ring.position.x = hu.x; ring.position.z = hu.z; arrow.position.set(hu.x, 2.5 + Math.sin(now / 200) * 0.1, hu.z);
                    const b = m.ball; ball.position.set(b.x, 0.22 + b.y, b.z); bs.position.x = b.x; bs.position.z = b.z; ball.rotation.x += b.vz * dt * 3; ball.rotation.z -= b.vx * dt * 3;
                    // 카메라: 공과 내 선수 사이를 따라간다
                    const fx = (b.x + hu.x) / 2, fz = (b.z * 0.6 + hu.z * 0.4); cx += (fx - cx) * Math.min(1, dt * 3); cz += (fz - cz) * Math.min(1, dt * 3);
                    const ccx = W / 2 + (cx - W / 2) * 0.8; cam.position.set(ccx, 17, Math.min(cz + 14, L + 19)); const lk = 17 + 6 * Math.min(1, Math.max(0, (L - cz - 8) / 20)); cam.lookAt(ccx, 0, Math.min(cz + 14, L + 19) - lk);
                    renderer.render(scene, cam);
                    drawHud(g, m, stick.current, I);
                    if (m.state === 'end') { endT += dt; if (endT > 1.5 && !finished.current) { finished.current = true; onFinish({ score: [...m.score] as [number, number], rec: { ...m.rec, sdg: { n: m.rec.sdg?.n ?? 0, w: m.rec.sdg?.w ?? 0, r: m.rec.sdg?.r ?? 0, c: shotCancel.current } }, rating: rating(m) }); return; } }
                    raf = requestAnimationFrame(frame);
                    } catch (e) { if (!frameErr) { frameErr = true; console.error('[frame]', e); setFatalErr(true); } }
                };
                raf = requestAnimationFrame(frame);
            } catch (e) { setMsg('3D 표시 실패: ' + String(e)); }
        })();
        return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); try { renderer?.dispose(); } catch (e) { /* 무시 */ } };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pt = (e: React.PointerEvent) => { const r = hud.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) * CW / r.width, y: (e.clientY - r.top) * CH / r.height }; };
    const onDown = (e: React.PointerEvent) => { const p = pt(e); if (p.x > CW * 0.62 && p.y > CH * 0.6) return; if (stick.current) return; (e.target as Element).setPointerCapture(e.pointerId); stick.current = { id: e.pointerId, ox: p.x, oy: p.y }; };
    const onMove = (e: React.PointerEvent) => { const s = stick.current; if (!s || s.id !== e.pointerId) return; const p = pt(e); let dx = (p.x - s.ox) / 38, dy = (p.y - s.oy) / 38; const n = Math.hypot(dx, dy); if (n > 1) { dx /= n; dy /= n; } if (n < 0.12) { dx = 0; dy = 0; } inp.current.mx = dx; inp.current.mz = dy; };
    const onUp = (e: React.PointerEvent) => { const s = stick.current; if (!s || s.id !== e.pointerId) return; stick.current = null; inp.current.mx = 0; inp.current.mz = 0; };
    const btn = (extra: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', borderRadius: '50%', border: '2px solid rgba(255,255,255,.85)', color: '#fff', fontWeight: 700, fontSize: 15, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', ...(ps ? { pointerEvents: 'none', opacity: 0.3 } : {}), ...extra });
    const fill: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', borderRadius: 12, touchAction: 'none' };
    return <div className="rs-wrap" style={{ position: 'relative', width: '100%', maxWidth: 420, margin: '0 auto', aspectRatio: `${CW} / ${CH}`, touchAction: 'none', userSelect: 'none', background: '#2a6a33', borderRadius: 12 }}>
        <canvas ref={gl} width={CW} height={CH} style={fill} />
        <canvas ref={hud} width={CW} height={CH} style={fill} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        {!ps && !msg && <button type="button" aria-label="일시정지" onClick={() => setPause(true)} style={{ position: 'absolute', right: '2%', top: '9%', padding: '4px 10px', borderRadius: 14, border: '1px solid rgba(255,255,255,.7)', background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 13 }}>일시정지</button>}
        {ps && <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', boxSizing: 'border-box', zIndex: 5, borderRadius: 12, background: 'rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#fff', textAlign: 'center', padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 22 }}>일시정지</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, textAlign: 'center', wordBreak: 'keep-all', padding: '0 14px', opacity: 0.9 }}>왼쪽 화면을 누른 채 끌어서 이동. 패스 버튼은 패스와 태클, 슛 버튼은 오른쪽 아래. 슛은 누르고 있으면 힘이 찬다.</div>
            <button type="button" disabled={glLost} onClick={() => { if (!glLostRef.current) setPause(false); }} style={{ padding: '10px 26px', borderRadius: 22, border: 'none', background: '#ffd23d', color: '#222', fontWeight: 700, fontSize: 16, ...(glLost ? { opacity: 0.45, cursor: 'default' } : {}) }}>{glLost ? '복구 대기 중' : '계속하기'}</button>
            {onQuit && <button type="button" onClick={() => { if (window.confirm('경기를 나가면 이 경기는 처음부터 다시 해야 한다. 나갈까?')) onQuit(); }} style={{ padding: '8px 20px', borderRadius: 22, border: '1px solid rgba(255,255,255,.7)', background: 'transparent', color: '#fff', fontSize: 14 }}>경기 나가기</button>}
        </div>}
        {msg && <div style={{ position: 'absolute', left: 0, right: 0, top: '45%', textAlign: 'center', color: '#fff', fontWeight: 700, padding: 12 }}>{msg}</div>}
        {glLost && !fatalErr && <div style={{ position: 'absolute', left: '6%', right: '6%', top: '12%', textAlign: 'center', pointerEvents: 'none', zIndex: 6 }}><span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 16, background: 'rgba(0,0,0,.78)', color: '#fff', fontWeight: 700, fontSize: 14 }}>그래픽 연결이 끊겨 복구를 시도하고 있습니다</span></div>}
        {fatalErr && <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', boxSizing: 'border-box', zIndex: 7, borderRadius: 12, background: 'rgba(0,0,0,.78)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#fff', textAlign: 'center', padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 20 }}>화면 표시에 문제가 생겼습니다</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, wordBreak: 'keep-all', opacity: 0.9 }}>이 경기는 여기서 중단됐습니다.{onQuit ? ' 경기를 나갔다가 다시 들어와 주세요.' : ' 페이지를 새로고침해 주세요.'}</div>
            {onQuit && <button type="button" onClick={() => { if (window.confirm('경기를 나가면 이 경기는 처음부터 다시 해야 한다. 나갈까?')) onQuit(); }} style={{ padding: '10px 26px', borderRadius: 22, border: 'none', background: '#ffd23d', color: '#222', fontWeight: 700, fontSize: 16 }}>경기 나가기</button>}
        </div>}
        {hint && !msg && !ps && <div style={{ position: 'absolute', left: 0, right: 0, bottom: '42%', textAlign: 'center', pointerEvents: 'none', zIndex: 4 }}><span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 16, background: 'rgba(0,0,0,.65)', color: '#ffd23d', fontWeight: 700, fontSize: 14, maxWidth: '86%' }}>{hint}</span></div>}
        <button type="button" ref={passBtn} aria-label="패스 또는 태클" style={btn({ right: '22%', bottom: '4%', width: '17%', aspectRatio: '1', background: 'rgba(40,110,200,.75)' })}
            onPointerDown={e => { e.preventDefault(); inp.current.passPressed = true; }}>패스</button>
        <button type="button" aria-label="슛, 누르고 있으면 힘이 찹니다" style={btn({ right: '3%', bottom: '8%', width: '20%', aspectRatio: '1', background: 'rgba(210,60,50,.8)' })}
            onPointerDown={e => { e.preventDefault(); (e.target as Element).setPointerCapture(e.pointerId); inp.current.shootDown = true; }}
            onPointerUp={() => { inp.current.shootDown = false; inp.current.shootReleased = true; }} onPointerCancel={() => { inp.current.shootDown = false; shotCancel.current++; flash('슛이 취소됐다'); }}>슛</button>
        {teamControl && <button type="button" aria-label="선수 전환" style={btn({ right: '3%', bottom: '28%', width: '15%', aspectRatio: '1', background: 'rgba(60,60,60,.7)', fontSize: 13 })}
            onPointerDown={e => { e.preventDefault(); inp.current.switchPressed = true; }}>전환</button>}
    </div>;
}

function drawHud(g: CanvasRenderingContext2D, m: Match, st: { ox: number; oy: number } | null, I: { mx: number; mz: number }) {
    g.clearRect(0, 0, CW, CH);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, CW, 24);
    g.fillStyle = '#fff'; g.font = '700 15px RSHud, sans-serif'; g.textAlign = 'center';
    const tt = Math.min(m.t - (m.half - 1) * m.halfLen, m.halfLen); const mm = Math.floor(tt / 60), ss = Math.floor(tt % 60);
    g.fillText(`내 팀 ${m.score[0]} : ${m.score[1]} 상대    ${m.half === 1 ? '전반' : '후반'} ${mm}:${String(ss).padStart(2, '0')}`, CW / 2, 17);
    if (m.charge > 0) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(CW / 2 - 40, CH - 28, 80, 10); g.fillStyle = m.charge > 0.8 ? '#ff6b3d' : '#ffd23d'; g.fillRect(CW / 2 - 39, CH - 27, 78 * m.charge, 8); }
    if (m.banner && m.state !== 'play') { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, CH / 2 - 34, CW, 58); g.fillStyle = '#fff'; g.font = '800 34px RSHud, sans-serif'; g.fillText(m.banner, CW / 2, CH / 2 + 8); }
    if (st) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.beginPath(); g.arc(st.ox, st.oy, 38, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(st.ox + I.mx * 38, st.oy + I.mz * 38, 16, 0, Math.PI * 2); g.fill(); }
    g.textAlign = 'left';
}
