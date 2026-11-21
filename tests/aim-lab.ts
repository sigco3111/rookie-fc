// 조준 실험: 통제 조건(수비 제거, 키퍼만)에서 스틱 방향별 득점률. 대조군 = TUNE.aim=false(예전 동작). 사람 플레이 아님.
import { makeMatch, step, TUNE, type Input } from '../src/engine';
import { POS } from '../src/growth';
const dt = 1 / 30;
function lab(aimOn: boolean, mx: number, mzIn: number, charge: number, z0: number, N = 300) {
  TUNE.aim = aimOn; let goals = 0, on = 0;
  for (let i = 1; i <= N; i++) {
    let s = i * 104729; const rnd = Math.random; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    const m = makeMatch({ ...POS[0].base }, 'FW', 44, false, 70); m.state = 'play'; m.stateT = 5; const H = m.players.find(p => p.id === m.humanId)!;
    for (const p of m.players) if (p !== H && !(p.team === 1 && p.role === 'GK')) { p.x = 0; p.z = 58; p.stun = 99; }
    H.x = 18 + (Math.random() - 0.5) * 8; H.z = z0; m.ball.x = H.x; m.ball.z = H.z; m.ball.owner = H; m.ball.vx = m.ball.vz = 0;
    let hold = 0, rel = false; const sc0 = m.score[0];
    for (let f = 0; f < 150 && m.score[0] === sc0; f++) {
      const inp: Input = { mx, mz: mzIn, passPressed: false, shootDown: false, shootReleased: false, switchPressed: false };
      if (!rel) { if (hold < charge) { inp.shootDown = true; hold += dt; } else { inp.shootReleased = true; rel = true; } } else { inp.mx = 0; inp.mz = 0; }
      step(m, dt, inp);
    }
    on += m.rec.shotsOn; if (m.score[0] > sc0) goals++; Math.random = rnd;
  }
  TUNE.aim = true; return `골 ${goals}/${N} 유효 ${on}`;
}
for (const z of [10, 16, 22]) {
  console.log('거리', z, '대조(예전)', lab(false, 0, 0, 0.3, z));
  console.log('거리', z, '스틱 없음', lab(true, 0, 0, 0.3, z), '| 오른쪽', lab(true, 1, 0, 0.3, z), '| 왼쪽', lab(true, -1, 0, 0.3, z), '| 뒤쪽입력(골 반대)', lab(true, 0, 1, 0.3, z), '| 뒤+오른쪽', lab(true, 0.7, 0.7, 0.3, z));
}
