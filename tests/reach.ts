// 승격 점수 도달 범위 계산. 실행: npx esbuild tests/reach.ts --bundle --platform=node --format=esm --outfile=/tmp/reach.mjs && node /tmp/reach.mjs
// 주의: 이 값은 첫 도전 기준 가정 내 계산이다. 재도전(능력 +3, 신뢰 40 시작)은 포함하지 않는다.
import { POS, abilityScore, perfScore, trustScore, trustDelta, needFor } from '../src/growth';
import { rating } from '../src/engine';
// 가정: 시즌 2경기, 매 경기 전 훈련 1회(핵심 능력 +3), 경기 후 성장 규칙(슛/패스/태클 조건, 없으면 포지션 첫 핵심 +1),
// 최고 평점 10, 신뢰 시작 30, 신뢰와 능력은 시즌 간 이어지고 평점은 시즌별 초기화. 상한은 요소별 최대를 각각 합친 값(느슨한 상한).
const SEASONS = 3, M = 2;
for (const p of POS) {
  const st = { ...p.base }; let trust = 30; const out: string[] = [];
  for (let s = 1; s <= SEASONS; s++) {
    for (let g = 0; g < M; g++) {
      // 상한: 훈련은 핵심 능력 중 가장 낮은 것에 +3, 경기 성장은 조건 충족 시 핵심에 해당하는 슛/패스/태클 모두 +1
      const k = [...p.key].sort((a, b) => st[a] - st[b])[0]; st[k] = Math.min(99, st[k] + 3);
      for (const kk of ['shoot', 'pass', 'defense'] as const) if (p.key.includes(kk)) st[kk] = Math.min(99, st[kk] + 1);
      trust = Math.min(100, trust + trustDelta(10));
    }
    const a = abilityScore(st, p.id), pf = perfScore([10, 10]), tr = trustScore(trust);
    out.push(`시즌${s} 상한 ${a}+${pf}+${tr}=${a + pf + tr} (기준 ${needFor(s, SEASONS)})`);
  }
  console.log(p.id, out.join(' | '));
}
// 현실적 평점별 (엔진 rating 함수로 만든 평점) 예시
const ex = (n: string, rec: any, sc: [number, number]) => console.log(n, rating({ rec, score: sc } as any).toFixed(2));
ex('1골+승', { goals: 1, assists: 0, passOk: 3, passAtt: 4, shotsOn: 2, tackles: 0 }, [2, 1]);
ex('1골+1도움+승', { goals: 1, assists: 1, passOk: 5, passAtt: 6, shotsOn: 3, tackles: 1 }, [3, 1]);
ex('무득점 패', { goals: 0, assists: 0, passOk: 1, passAtt: 4, shotsOn: 0, tackles: 0 }, [0, 2]);
// 시즌별 중간 평점 도달표 (공격수, 요소 근사: 훈련 핵심+3, 경기 슛+1, 신뢰는 평점 기준)
for (const p of POS) for (const r of [6.5, 7, 7.5, 8, 8.5, 9]) {
  const st = { ...p.base }; let trust = 30; const o: string[] = [];
  for (let s = 1; s <= SEASONS; s++) { for (let g = 0; g < M; g++) { const k = [...p.key].sort((a, b) => st[a] - st[b])[0]; st[k] = Math.min(99, st[k] + 3); for (const kk of ['shoot', 'pass', 'defense'] as const) if (p.key.includes(kk)) st[kk] = Math.min(99, st[kk] + 1); trust = Math.min(100, Math.max(0, trust + trustDelta(r))); }
    o.push(abilityScore(st, p.id) + perfScore([r, r]) + trustScore(trust)); }
  console.log(p.id, '평점', r, o.join('/'), '기준 80/80/65');
}
