// 7대7 축구 경기 엔진. 좌표 단위는 m. x는 폭(0~W), z는 길이(0~L). 홈(내 팀)은 위쪽(z=0) 골대를 공격한다.
export const W = 36, L = 60, GOAL_HALF = 3.2;
export type Pos = 'GK' | 'DF' | 'MF' | 'FW';
export interface Stats { shoot: number; pass: number; dribble: number; defense: number; speed: number }
export interface Player {
    id: number; team: 0 | 1; role: Pos; bx: number; bd: number; x: number; z: number; vx: number; vz: number; h: number;
    st: Stats; phase: number; kick: null | { t: number; type: 'pass' | 'shoot'; dx: number; dz: number; power: number; target: Player | null; done: boolean };
    stun: number; lunge: number; lungeCd: number; noPick: number; think: number; human: boolean;
}
export interface Ball { x: number; z: number; y: number; vx: number; vz: number; vy: number; owner: Player | null; last: Player | null; lastTeam: 0 | 1; lastPassFrom: Player | null; lastPassT: number }
export interface Input { mx: number; mz: number; passPressed: boolean; shootDown: boolean; shootReleased: boolean; switchPressed: boolean }
export interface Rec { goals: number; assists: number; shots: number; shotsOn: number; passAtt: number; passOk: number; tackles: number; lost: number }
export interface Match {
    players: Player[]; ball: Ball; score: [number, number]; t: number; half: number; halfLen: number; state: 'kickoff' | 'play' | 'goal' | 'halftime' | 'end';
    stateT: number; kickTeam: 0 | 1; humanId: number; teamControl: boolean; rec: Rec; charge: number; events: string[]; pendingPass: { from: Player; to: Player; t: number } | null; banner: string; switchCd: number;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
export const ownGoalZ = (team: number) => (team === 0 ? L : 0);
export const fwd = (team: number) => (team === 0 ? -1 : 1);
const SLOTS: { role: Pos; bx: number; bd: number }[] = [
    { role: 'GK', bx: 18, bd: 0.04 }, { role: 'DF', bx: 10, bd: 0.22 }, { role: 'DF', bx: 26, bd: 0.22 },
    { role: 'MF', bx: 7, bd: 0.46 }, { role: 'MF', bx: 18, bd: 0.4 }, { role: 'MF', bx: 29, bd: 0.46 }, { role: 'FW', bx: 18, bd: 0.68 },
];
export function makeMatch(me: Stats, pos: Pos, oppStr: number, teamControl: boolean, halfLen = 70): Match {
    const players: Player[] = [];
    for (const team of [0, 1] as const) {
        SLOTS.forEach((s, i) => {
            const base = team === 0 ? 55 : oppStr;
            const j = (k: number) => clamp(base + ((i * 7 + k * 5 + team * 3) % 11) - 5, 30, 95);
            players.push({ id: team * 7 + i, team, role: s.role, bx: s.bx, bd: s.bd, x: s.bx, z: ownGoalZ(team) + fwd(team) * s.bd * L, vx: 0, vz: 0, h: team === 0 ? -Math.PI / 2 : Math.PI / 2,
                st: { shoot: j(0), pass: j(1), dribble: j(2), defense: j(3), speed: j(4) }, phase: 0, kick: null, stun: 0, lunge: 0, lungeCd: 0, noPick: 0, think: Math.random() * 0.3, human: false });
        });
    }
    const hi = pos === 'FW' ? 6 : pos === 'MF' ? 4 : 1;
    players[hi].st = { ...me }; players[hi].human = true;
    const m: Match = { players, ball: { x: W / 2, z: L / 2, y: 0, vx: 0, vz: 0, vy: 0, owner: null, last: null, lastTeam: 0, lastPassFrom: null, lastPassT: -9 }, score: [0, 0], t: 0, half: 1, halfLen,
        state: 'kickoff', stateT: 0, kickTeam: 0, humanId: hi, teamControl, rec: { goals: 0, assists: 0, shots: 0, shotsOn: 0, passAtt: 0, passOk: 0, tackles: 0, lost: 0 }, charge: 0, events: [], pendingPass: null, banner: '킥오프', switchCd: 0 };
    resetKickoff(m, 0);
    return m;
}
function resetKickoff(m: Match, team: 0 | 1) {
    m.kickTeam = team;
    for (const p of m.players) { p.x = p.bx; p.z = ownGoalZ(p.team) + fwd(p.team) * p.bd * L * (p.role === 'GK' ? 1 : 0.9); p.vx = p.vz = 0; p.kick = null; p.stun = 0; p.h = p.team === 0 ? -Math.PI / 2 : Math.PI / 2; p.noPick = 0 }
    const k = m.players.find(p => p.team === team && p.role === 'FW')!; k.x = W / 2 - 0.8; k.z = L / 2 + fwd(team) * -0.6;
    m.ball = { x: W / 2, z: L / 2, y: 0, vx: 0, vz: 0, vy: 0, owner: null, last: null, lastTeam: team, lastPassFrom: null, lastPassT: -9 };
    m.ball.owner = k; m.ball.last = k; m.pendingPass = null; m.stateT = 0; m.state = 'kickoff';
}
const spd = (p: Player) => 4.3 + p.st.speed * 0.03;
function teamHasBall(m: Match, team: number) { return m.ball.owner ? m.ball.owner.team === team : m.ball.lastTeam === team; }
function giveBall(m: Match, p: Player) {
    const b = m.ball; const prev = b.owner;
    b.owner = p; b.vx = b.vz = b.vy = 0; b.y = 0;
    if (m.pendingPass && m.pendingPass.from.team === p.team) {
        const hp = m.pendingPass.from;
        if (p !== hp) { if (hp.human && m.t - m.pendingPass.t < 4) { m.rec.passOk++; } b.lastPassFrom = hp; b.lastPassT = m.t; }
        m.pendingPass = null;
    } else if (m.pendingPass && m.pendingPass.from.team !== p.team) { if (m.pendingPass.from.human) m.rec.lost++; m.pendingPass = null; }
    if (prev && prev.team !== p.team) { b.lastPassFrom = null }
    b.last = p; b.lastTeam = p.team;
    if (m.teamControl && p.team === 0 && !p.human) { switchTo(m, p) }
}
function switchTo(m: Match, p: Player) { const o = m.players[m.humanId]; if (o === p || p.role === 'GK') return; o.human = false; p.human = true; m.humanId = p.id; }
// 슛 방향 규칙: 이동 스틱의 좌우 성분(|mx| > 0.25)이 있으면 그 쪽 골대 구석(중앙에서 최대 GOAL_HALF*0.8)을 노린다.
// 스틱을 안 쓰거나 거의 중앙이면 이전처럼 골대 중앙 근처 무작위. 골대 반대(뒤쪽) 입력은 방향에 쓰이지 않는다.
export const TUNE = { aim: true, aimDead: 0.25, aimReach: 0.8, aimErrMul: 0.6, gkReach: 1.4, gkTrack: 0.2, gkReachOwn: 1.9, gkTrackOwn: 0.35 } // gk*는 상대(team 1) 키퍼, gk*Own은 내 팀 키퍼(예전 값 유지);
function shoot(m: Match, p: Player, power: number, aim?: number) {
    const gz = p.team === 0 ? 0 : L; const useAim = TUNE.aim && aim !== undefined && Math.abs(aim) > TUNE.aimDead;
    const gx = useAim ? W / 2 + Math.sign(aim!) * Math.min(1, Math.abs(aim!)) * GOAL_HALF * TUNE.aimReach : W / 2 + (Math.random() - 0.5) * GOAL_HALF * 1.2;
    let dx = gx - p.x, dz = gz - p.z; const n = Math.hypot(dx, dz); dx /= n; dz /= n;
    const err = (1 - p.st.shoot / 100) * 0.55 * (0.6 + power * 0.7) * (Math.random() * 2 - 1) * (useAim ? TUNE.aimErrMul : 1);
    const c = Math.cos(err), s = Math.sin(err); const rx = dx * c - dz * s, rz = dx * s + dz * c;
    p.kick = { t: 0, type: 'shoot', dx: rx, dz: rz, power, target: null, done: false }; p.h = Math.atan2(rz, rx);
}
function passTo(m: Match, p: Player, t: Player | null, dirx: number, dirz: number) {
    let dx = dirx, dz = dirz;
    if (t) { dx = t.x + t.vx * 0.5 - p.x; dz = t.z + t.vz * 0.5 - p.z; const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n; }
    const err = (1 - p.st.pass / 100) * 0.4 * (Math.random() * 2 - 1); const c = Math.cos(err), s = Math.sin(err);
    p.kick = { t: 0, type: 'pass', dx: dx * c - dz * s, dz: dx * s + dz * c, power: t ? clamp(dist(p, t) / 24, 0.25, 1) : 0.5, target: t, done: false }; p.h = Math.atan2(dz, dx);
}
function bestPassTarget(m: Match, p: Player, dirx: number, dirz: number, useDir: boolean): Player | null {
    let best: Player | null = null, bs = -1e9;
    const f = fwd(p.team);
    for (const t of m.players) {
        if (t.team !== p.team || t === p || t.role === 'GK' && p.role !== 'DF') continue;
        const d = dist(p, t); if (d < 4 || d > 30) continue;
        let s = -Math.abs(d - 14) * 0.15;
        if (useDir) { const n = Math.hypot(dirx, dirz) || 1; const dot = ((t.x - p.x) * dirx + (t.z - p.z) * dirz) / (d * n); if (dot < 0.55) continue; s += dot * 6; }
        else s += (t.z - p.z) * f * 0.18;
        let open = 8; for (const o of m.players) if (o.team !== p.team) { const od = dist(o, t); if (od < 8) open = Math.min(open, od) }
        s += open * 0.8;
        if (s > bs) { bs = s; best = t }
    }
    return best;
}
function releaseKick(m: Match, p: Player) {
    const k = p.kick!; const b = m.ball; k.done = true;
    if (b.owner !== p && dist(p, b) > 1.5) return;
    b.owner = null; b.last = p; b.lastTeam = p.team; p.noPick = 0.4;
    if (k.type === 'shoot') {
        const v = 12 + k.power * 14; b.vx = k.dx * v; b.vz = k.dz * v; b.vy = k.power > 0.75 ? 2.5 + (Math.random()) * 2 : 0.5 * k.power;
        if (p.human) { m.rec.shots++; const gz = p.team === 0 ? 0 : L; if (Math.abs(b.vz) > 0.1) { const tt = (gz - b.z) / b.vz; if (tt > 0) { const xe = b.x + b.vx * tt; if (Math.abs(xe - W / 2) < GOAL_HALF + 0.3) m.rec.shotsOn++ } } }
        m.pendingPass = null; m.events.push(p.team === 0 ? '슛' : '');
    } else {
        const v = 9 + k.power * 11; b.vx = k.dx * v; b.vz = k.dz * v; b.vy = 0;
        if (p.human) m.rec.passAtt++;
        m.pendingPass = { from: p, to: k.target as Player, t: m.t };
        if (m.teamControl && p.human && k.target) { /* 수신자 전환은 공을 받을 때 */ }
    }
}
function update(m: Match, dt: number, inp: Input) {
    const b = m.ball;
    m.switchCd -= dt;
    // 사람 조작
    const hp = m.players[m.humanId];
    if (inp.switchPressed && m.teamControl && m.switchCd <= 0) {
        let bp: Player | null = null, bd = 1e9; for (const p of m.players) if (p.team === 0 && p !== hp && p.role !== 'GK') { const d = dist(p, b); if (d < bd) { bd = d; bp = p } }
        if (bp) { switchTo(m, bp); m.switchCd = 0.3 }
    }
    if (m.teamControl && m.switchCd <= 0 && b.owner?.team !== 0 && !hp.kick) {
        let bp: Player | null = null, bd = 1e9; for (const p of m.players) if (p.team === 0 && p.role !== 'GK') { const d = dist(p, b); if (d < bd) { bd = d; bp = p } }
        if (bp && bp !== hp && dist(hp, b) - bd > 3) { switchTo(m, bp); m.switchCd = 0.8 }
    }
    const H = m.players[m.humanId];
    if (inp.shootDown && b.owner === H && !H.kick) m.charge = Math.min(1, m.charge + dt * 1.1); else if (!inp.shootDown && !inp.shootReleased) m.charge = 0;
    if (inp.shootReleased && b.owner === H && !H.kick && m.state !== 'goal') { shoot(m, H, Math.max(0.35, m.charge), inp.mz > 0.3 && H.team === 0 ? 0 : inp.mx); m.charge = 0 }
    if (inp.passPressed && !H.kick) {
        if (b.owner === H) {
            const useDir = Math.hypot(inp.mx, inp.mz) > 0.3; const t = bestPassTarget(m, H, inp.mx, inp.mz, useDir);
            passTo(m, H, t, useDir ? inp.mx : 0, useDir ? inp.mz : fwd(0));
        } else if (H.lungeCd <= 0) { H.lunge = 0.3; H.lungeCd = 0.9 }
    }
    for (const p of m.players) {
        p.stun = Math.max(0, p.stun - dt); p.lunge = Math.max(0, p.lunge - dt); p.lungeCd = Math.max(0, p.lungeCd - dt); p.noPick = Math.max(0, p.noPick - dt);
        let ax = 0, az = 0, sp = spd(p);
        if (m.state === 'kickoff' && m.stateT < 1.2) { sp = 0 }
        if (p.human) { ax = inp.mx; az = inp.mz; const n = Math.hypot(ax, az); if (n > 1) { ax /= n; az /= n } }
        else if (m.state === 'play' || m.state === 'kickoff') { const a = ai(m, p, dt); ax = a[0]; az = a[1]; if (a[2]) sp *= a[2] }
        if (b.owner === p) sp *= 0.9 + p.st.dribble * 0.0012;
        if (p.stun > 0) sp *= 0.2; if (p.kick) sp *= 0.25; if (p.lunge > 0) sp *= 1.5;
        if (m.state === 'goal' || m.state === 'halftime' || m.state === 'end') sp = 0;
        const tvx = ax * sp, tvz = az * sp; const k = Math.min(1, dt * 9);
        p.vx += (tvx - p.vx) * k; p.vz += (tvz - p.vz) * k; p.x = clamp(p.x + p.vx * dt, 0.5, W - 0.5); p.z = clamp(p.z + p.vz * dt, 0.5, L - 0.5);
        const v = Math.hypot(p.vx, p.vz); if (v > 0.6 && !p.kick) p.h = Math.atan2(p.vz, p.vx); if (v > 0.4) p.phase += dt * (v / 5) * 1.5;
        if (p.kick) { p.kick.t += dt; if (!p.kick.done && p.kick.t >= 0.16) releaseKick(m, p); if (p.kick.t >= 0.42) p.kick = null }
    }
    // 선수끼리 겹침 완화
    for (let i = 0; i < m.players.length; i++) for (let j = i + 1; j < m.players.length; j++) { const a = m.players[i], c = m.players[j]; const d = dist(a, c); if (d < 0.9 && d > 0.01) { const push = (0.9 - d) / 2, nx = (a.x - c.x) / d, nz = (a.z - c.z) / d; a.x += nx * push; a.z += nz * push; c.x -= nx * push; c.z -= nz * push } }
    // 공
    if (b.owner) {
        const o = b.owner; const bob = 0.6 + 0.35 * Math.abs(Math.sin(o.phase * Math.PI * 2)); const hx = Math.cos(o.h), hz = Math.sin(o.h);
        b.x = o.x + hx * bob; b.z = o.z + hz * bob; b.y = 0; b.vx = b.vz = 0;
        // 태클
        for (const d of m.players) {
            if (d.team === o.team || d.stun > 0 || d.kick) continue; const dd = dist(d, o); const reach = d.lunge > 0 ? 1.6 : 0.9;
            if (dd < reach) { const rate = (d.lunge > 0 ? 3.2 : 0.8) * (d.st.defense / (d.st.defense + o.st.dribble * 1.1)); if (Math.random() < rate * dt * 2) {
                if (d.human) m.rec.tackles++; if (o.human) m.rec.lost++; b.owner = null; b.vx = (Math.cos(d.h)) * 3; b.vz = Math.sin(d.h) * 3; b.last = d; b.lastTeam = d.team; o.stun = 0.6; o.noPick = 0.5; d.noPick = 0; if (m.pendingPass) m.pendingPass = null; if (m.teamControl && d.team === 0) switchTo(m, d); break } }
        }
    } else {
        b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt; b.vy -= 9.8 * dt;
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) * 0.4; if (b.vy < 0.8) b.vy = 0 }
        const fr = b.y > 0.05 ? 0.2 : 1.3; const sp = Math.hypot(b.vx, b.vz); if (sp > 0) { const ns = Math.max(0, sp - fr * dt * (sp > 6 ? 2.2 : 3.5)); b.vx *= ns / sp; b.vz *= ns / sp }
        // 줍기
        let best: Player | null = null, bd = 1e9;
        for (const p of m.players) {
            if (p.noPick > 0 || p.stun > 0) continue; const d = dist(p, b); const reach = p.role === 'GK' ? (p.team === 1 ? TUNE.gkReach : TUNE.gkReachOwn) : 1.0; const maxY = p.role === 'GK' ? 2.4 : 1.0;
            if (d < reach && b.y < maxY && d < bd) { bd = d; best = p }
        }
        if (best) {
            const sp = Math.hypot(b.vx, b.vz);
            if (best.role === 'GK' && sp > 12 && best.team !== b.lastTeam) {
                const sv = 0.82 - (sp - 12) * 0.035 + best.st.defense * 0.002; if (Math.random() > sv) { b.vx *= -0.35; b.vz *= -0.35; b.vy = 1.5; best.noPick = 0.5 } else giveBall(m, best)
            } else if (sp < 20 || best.role === 'GK') giveBall(m, best)
        }
        // 골/아웃
        if (m.state !== 'play' && m.state !== 'kickoff') { /* 득점 직후 처리 없음 */ } else if ((b.z < 0 || b.z > L)) {
            const homeAttack = b.z < 0; const inGoal = Math.abs(b.x - W / 2) < GOAL_HALF && b.y < 2.4;
            if (inGoal) goal(m, homeAttack ? 0 : 1);
            else { const t: 0 | 1 = b.lastTeam === 0 ? 1 : 0; const gk = m.players.find(p => p.team === (homeAttack ? 1 : 0) && p.role === 'GK')!; if (b.lastTeam === (homeAttack ? 0 : 1)) { b.x = gk.x; b.z = gk.z + fwd(gk.team) * 0.5; b.vx = b.vz = 0; giveBall(m, gk) } else { b.vx = -b.vx * 0.3; b.vz = -b.vz; b.z = clamp(b.z, 0.3, L - 0.3); void t } }
        } else if (b.x < 0 || b.x > W) {
            const t: 0 | 1 = b.lastTeam === 0 ? 1 : 0; const x = b.x < 0 ? 0.6 : W - 0.6; const z = clamp(b.z, 4, L - 4);
            let n: Player | null = null, nd = 1e9; for (const p of m.players) if (p.team === t && p.role !== 'GK') { const d = Math.hypot(p.x - x, p.z - z); if (d < nd) { nd = d; n = p } }
            if (n) { n.x = x; n.z = z; n.vx = n.vz = 0; b.x = x; b.z = z; b.vx = b.vz = 0; giveBall(m, n); n.stun = 0.4 }
        }
    }
    if (b.owner && b.owner.team === 0 && b.owner.human) { /* 어시스트 추적은 골 때 */ }
}
function goal(m: Match, team: 0 | 1) {
    m.score[team]++; m.state = 'goal'; m.stateT = 0; m.banner = team === 0 ? '골!' : '실점';
    const last = m.ball.last;
    if (team === 0) { if (last && last.human) { m.rec.goals++ } else if (m.ball.lastPassFrom && m.ball.lastPassFrom.human && m.t - m.ball.lastPassT < 6) { m.rec.assists++ } }
    m.ball.owner = null; m.ball.vx *= 0.2; m.ball.vz *= 0.2; m.pendingPass = null;
}
function ai(m: Match, p: Player, dt: number): [number, number, number?] {
    const b = m.ball; const f = fwd(p.team); const gz = p.team === 0 ? 0 : L;
    const toward = (tx: number, tz: number, run = 1): [number, number, number] => { const dx = tx - p.x, dz = tz - p.z; const d = Math.hypot(dx, dz); if (d < 0.35) return [0, 0, 1]; return [dx / d, dz / d, run] };
    if (p.role === 'GK') {
        const gl = ownGoalZ(p.team); const bd = dist(p, b);
        if (!b.owner && bd < 9 && Math.abs(b.z - gl) < 14 && (b.vz * f < 0 ? false : Math.hypot(b.vx, b.vz) < 14)) return toward(b.x, b.z, 1);
        if (b.owner === p) { p.think -= dt; if (p.think <= 0 && !p.kick) { p.think = 0.9; const t = bestPassTarget(m, p, 0, 0, false); passTo(m, p, t, 0, f) } return [0, 0, 0] }
        const gx = clamp(W / 2 + (b.x - W / 2) * (p.team === 1 ? TUNE.gkTrack : TUNE.gkTrackOwn), W / 2 - 3, W / 2 + 3); return toward(gx, gl + f * (b.vz * -f > 6 ? 1.4 : 1.8), 0.9);
    }
    if (b.owner === p) {
        p.think -= dt; let near: Player | null = null, nd = 1e9; for (const o of m.players) if (o.team !== p.team) { const d = dist(o, p); if (d < nd) { nd = d; near = o } }
        const dg = Math.hypot(W / 2 - p.x, gz - p.z);
        if (p.think <= 0 && !p.kick && m.state === 'play') {
            p.think = 0.22 + Math.random() * 0.2;
            const shotOk = dg < 15 + p.st.shoot * 0.06 && (nd > 2.4 || dg < 8);
            if (shotOk && Math.random() < 0.55) { shoot(m, p, 0.6 + Math.random() * 0.4); return [0, 0, 0.2] }
            if (nd < 3.2 || (m.state === 'play' && Math.random() < 0.06)) { const t = bestPassTarget(m, p, 0, 0, false); if (t) { passTo(m, p, t, 0, 0); return [0, 0, 0.2] } }
        }
        if (m.state === 'kickoff' && m.stateT > 0.9 && !p.kick) { const t = bestPassTarget(m, p, 0, 0, false); if (t) { passTo(m, p, t, 0, 0); return [0, 0, 0.2] } }
        let tx = W / 2, tz = gz; if (near && nd < 4) { const ax = p.x - near.x; tx = p.x + ax * 0.8 + (W / 2 - p.x) * 0.2; tz = p.z + f * 6 }
        return toward(tx, tz, 0.95);
    }
    const bp = (b.z / L); const depth = p.team === 0 ? 1 - bp : bp;
    const hasBall = teamHasBall(m, p.team);
    // 공을 쫓는 선수: 팀에서 공에 가까운 2명
    let rank = 0; const dd = dist(p, b); for (const q of m.players) if (q.team === p.team && q.role !== 'GK' && q !== p && dist(q, b) < dd) rank++;
    // 수비: 공을 가진 상대에 가까우면 슬라이딩 태클을 시도한다 (사람 조작 선수만 쓰던 태클을 AI도 쓰게 한다)
    if (!hasBall && b.owner && b.owner.team !== p.team && rank < 2 && !p.human && p.lungeCd <= 0 && p.stun <= 0 && !p.kick && dist(p, b.owner) < 1.9 && Math.random() < dt * (1.2 + p.st.defense * 0.02)) { p.lunge = 0.3; p.lungeCd = 1.6 }
    if (!hasBall && rank < 2 && !p.human) return toward(b.x + b.vx * 0.25, b.z + b.vz * 0.25, 1);
    if (!b.owner && rank < 1) return toward(b.x + b.vx * 0.3, b.z + b.vz * 0.3, 1);
    const shift = hasBall ? 0.18 + clamp((depth - 0.4) * 0.3, 0, 0.12) : clamp((depth - 0.5) * 0.4, -0.12, 0.1) - 0.04;
    const d = clamp(p.bd + shift * (p.role === 'DF' ? 0.6 : 1), 0.06, 0.86);
    const tz = ownGoalZ(p.team) + f * d * L; const tx = p.bx + (b.x - W / 2) * 0.25;
    return toward(clamp(tx, 2, W - 2), tz, 0.85);
}
export function step(m: Match, dtReal: number, inp: Input) {
    const dt = Math.min(dtReal, 0.05); m.stateT += dt;
    if (m.state === 'kickoff') { update(m, dt, inp); if (m.stateT > 1.2) { m.state = 'play'; m.banner = '' } return }
    if (m.state === 'play') {
        m.t += dt; update(m, dt, inp);
        if (m.t >= m.halfLen * m.half) { if (m.half === 1) { m.state = 'halftime'; m.stateT = 0; m.banner = '전반 종료' } else { m.state = 'end'; m.banner = '경기 종료' } }
        return
    }
    if (m.state === 'goal') { update(m, dt, { ...inp, passPressed: false, shootDown: false, shootReleased: false }); if (m.stateT > 1.8) { const conceding: 0 | 1 = m.banner === '골!' ? 1 : 0; resetKickoff(m, conceding); m.banner = '킥오프' } return }
    if (m.state === 'halftime') { if (m.stateT > 2) { resetKickoff(m, 1); m.half = 2; m.banner = '후반 시작' } return }
}
export function rating(m: Match): number {
    const r = m.rec; const res = m.score[0] > m.score[1] ? 0.5 : m.score[0] === m.score[1] ? 0.2 : 0;
    return clamp(5.5 + r.goals * 1.2 + r.assists * 0.8 + Math.min(r.passOk, 10) * 0.1 + r.shotsOn * 0.2 + r.tackles * 0.3 - Math.max(0, r.passAtt - r.passOk) * 0.05 + res, 3, 10);
}
