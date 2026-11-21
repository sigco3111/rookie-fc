// 슛 실험실: 수비수와 압박을 치우고 키퍼만 둔 통제 조건에서 충전 시간별 득점률. 실제 step/Input 사용. 사람 플레이 아님.
import { makeMatch, step, type Input } from '../src/engine';
import { POS } from '../src/growth';
const dt = 1 / 30;
export function lab(charge: number, z0: number, stat: number, trials = 300) {
  let goals = 0, on = 0, shots = 0;
  for (let i = 1; i <= trials; i++) {
    let s = i * 104729; const rnd = Math.random; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    const pd = POS[0]; const m = makeMatch({ ...pd.base, shoot: stat }, 'FW', 44, false, 70);
    m.state = 'play'; m.stateT = 5; const H = m.players.find(p => p.id === m.humanId)!;
    for (const p of m.players) if (p !== H && !(p.team === 1 && p.role === 'GK')) { p.x = 0; p.z = 58; p.stun = 99; }
    H.x = 18 + (Math.random() - 0.5) * 8; H.z = z0; m.ball.x = H.x; m.ball.z = H.z; m.ball.owner = H; m.ball.vx = m.ball.vz = 0;
    let hold = 0; let released = false; const sc0 = m.score[0];
    for (let f = 0; f < 150 && m.score[0] === sc0; f++) {
      const inp: Input = { mx: 0, mz: 0, passPressed: false, shootDown: false, shootReleased: false, switchPressed: false };
      if (!released) { if (hold < charge) { inp.shootDown = true; hold += dt; } else { inp.shootReleased = true; released = true; } }
      step(m, dt, inp);
    }
    shots += m.rec.shots; on += m.rec.shotsOn; if (m.score[0] > sc0) goals++; Math.random = rnd;
  }
  return { shots, on, goals };
}
if (process.argv[1]?.includes('shot-lab')) for (const z0 of [10, 16, 22]) for (const c of [0, 0.3, 0.6, 0.9]) { const r = lab(c, z0, 58); console.log('골대거리', z0, '충전초', c, '슛', r.shots, '유효', r.on, '골', r.goals, '골률', (r.goals / 300).toFixed(2)); }
