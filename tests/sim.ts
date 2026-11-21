// 엔진 단독 입력 시뮬레이션(화면 없음). 실제 makeMatch/step/rating을 쓰고 단순 규칙 봇이 Input을 넣는다.
// 사람 플레이가 아니다. "입력으로 득점이 가능한가"와 평점 범위 확인용이며 밸런스 증거가 아니다.
import { makeMatch, step, rating, TUNE, type Input } from '../src/engine';
import { POS } from '../src/growth';
const dt = 1 / 30;
function run(seed: number, posId: 'FW' | 'MF' | 'DF', oppStr: number, shootDist: number, charge: number) {
  let s = seed; const rnd = Math.random; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const pd = POS.find(p => p.id === posId)!; const m = makeMatch({ ...pd.base }, posId, oppStr, false, 70);
  let hold = 0; let guard = 0;
  while (m.state !== 'end' && guard++ < 20000) {
    const H = m.players.find(p => p.id === m.humanId)!; const b = m.ball;
    const inp: Input = { mx: 0, mz: 0, passPressed: false, shootDown: false, shootReleased: false, switchPressed: false };
    const has = b.owner === H;
    const tx = has ? 0 : b.x, tz = has ? 0 : b.z; // 내 팀은 z 감소 방향이 공격
    const dx = tx - H.x, dz = tz - H.z; const d = Math.hypot(dx, dz) || 1; inp.mx = dx / d; inp.mz = dz / d;
    if (has) { const gd = Math.hypot(H.x, H.z); if (gd < shootDist || hold > 0) { inp.mx = 0; inp.mz = 0; if (hold < charge) { inp.shootDown = true; hold += dt; } else { inp.shootReleased = true; hold = 0; } } }
    else hold = 0;
    step(m, dt, inp);
  }
  Math.random = rnd; return { g: m.rec.goals, sh: m.rec.shots, on: m.rec.shotsOn, sc: m.score.join(':'), r: rating(m) };
}
const LEGACY = { gkReach: 1.9, gkTrack: 0.35, aim: false }; const NOW = { gkReach: TUNE.gkReach, gkTrack: TUNE.gkTrack, aim: TUNE.aim };
for (const [name, cfg] of [['대조(예전 키퍼)', LEGACY], ['현재 값', NOW]] as const) for (const pos of ['FW', 'MF', 'DF'] as const) for (const opp of [44, 55]) {
  Object.assign(TUNE, cfg);
  const rs: any[] = []; for (let i = 1; i <= 20; i++) rs.push(run(i * 7919, pos, opp, 16, 0.6));
  const avg = (k: string) => (rs.reduce((a, c) => a + c[k], 0) / rs.length).toFixed(2);
  const conc = (rs.reduce((a, c) => a + +c.sc.split(':')[1], 0) / rs.length).toFixed(2);
  const wins = rs.filter(r => +r.sc.split(':')[0] > +r.sc.split(':')[1]).length;
  console.log(name, pos, '상대', opp, '20경기: 평균 골', avg('g'), '실점', conc, '평점', avg('r'), '최대평점', Math.max(...rs.map(r => r.r)).toFixed(2), '승', wins);
}
