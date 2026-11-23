// 실행 전: npx tsc src/engine.ts src/growth.ts --outDir /tmp/eng --module esnext --target es2020
const { makeMatch, step, W, L } = await import((process.env.ENG_DIR || '/tmp/eng') + '/engine.js');
const IN={mx:0,mz:0,passPressed:false,shootDown:false,shootReleased:false,switchPressed:false};
const ME={shoot:80,pass:70,dribble:60,defense:40,speed:70};
function run(m,secs,inp){const n=Math.round(secs/0.05);for(let i=0;i<n;i++)step(m,0.05,inp);}
function toPlay(m){run(m,1.5,IN);} // kickoff 1.2s 경과 → play
function clearField(m){for(const p of m.players){if(!p.human){p.x=p.team===1?1:W-1;p.z=p.team===1?2:L-2;p.vx=p.vz=0;}}}
function giveTo(m,p){const b=m.ball;b.owner=p;b.x=p.x;b.z=p.z;b.y=0;b.vx=b.vz=b.vy=0;b.last=p;b.lastTeam=p.team;}

// 시험1: 내 슛 → 골 링크 (rec.shots, rec.goals)
{
  const m=makeMatch(ME,'FW',55,false,70); toPlay(m);
  const H=m.players[m.humanId]; clearField(m);
  H.x=W/2; H.z=7; H.vx=H.vz=0; giveTo(m,H);
  run(m,1.0,{...IN,shootDown:true});           // 충전
  step(m,0.05,{...IN,shootReleased:true});     // 발사
  let goalT=-1; for(let i=0;i<160&&goalT<0;i++){step(m,0.05,IN); if(m.state==='goal')goalT=i;}
  console.log('T1 shot:',JSON.stringify({shots:m.rec.shots,shotsOn:m.rec.shotsOn,goal:m.state==='goal',goals:m.rec.goals,score:[...m.score],sdg:m.rec.sdg}));
}
// 시험2: 내 패스 → 팀메이트 골 → 어시스트 링크 (시드 고정 결정론: 같은 시드는 같은 결과여야 함)
const mul32 = s => { let a = s >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
function t2once(seed) {
  const orig = Math.random; Math.random = mul32(seed);
  try {
    const m=makeMatch(ME,'FW',55,false,70); toPlay(m);
    const H=m.players[m.humanId]; clearField(m);
    const T=m.players.find(p=>p.team===0&&!p.human&&p.role!=='GK');
    H.x=W/2; H.z=16; H.vx=H.vz=0; giveTo(m,H);
    T.x=W/2; T.z=8; T.vx=T.vz=0;
      step(m,0.05,{...IN,mz:-1,passPressed:true});  // 앞쪽으로 패스
  let res={}; for(let i=0;i<600;i++){step(m,0.05,IN); if(m.state==='goal'){res={goalAt:i,score:[...m.score],goals:m.rec.goals,assists:m.rec.assists,passOk:m.rec.passOk,passAtt:m.rec.passAtt};break;}}
  return res.goalAt !== undefined ? res : {noGoal:true,assists:m.rec.assists,goals:m.rec.goals,passOk:m.rec.passOk,passAtt:m.rec.passAtt,bz:Math.round(m.ball.z*10)/10};
  } finally { Math.random = orig; }
}
for (const seed of [1, 2, 3, 7, 42]) {
  const a = t2once(seed), b = t2once(seed);
  const same = JSON.stringify(a) === JSON.stringify(b);
  console.log('T2 assist seed=' + seed + ':', JSON.stringify(a), '| reproducible:', same);
}
// 시험3: 무소유 릴리스 진단(sdg.n) + 충전 중 소유 상실(sdg.w)
{
  const m=makeMatch(ME,'FW',55,false,70); toPlay(m);
  const opp=m.players.find(p=>p.team===1); giveTo(m,opp);
  step(m,0.05,{...IN,shootReleased:true});
  console.log('T3 noBallRelease:',JSON.stringify(m.rec.sdg));
}
{
  const m=makeMatch(ME,'FW',55,false,70); toPlay(m);
  const H=m.players[m.humanId]; giveTo(m,H);
  run(m,0.5,{...IN,shootDown:true});            // 충전 시작
  const opp=m.players.find(p=>p.team===1); giveTo(m,opp); // 빼앗김
  step(m,0.05,{...IN,shootReleased:true});      // 릴리스
  console.log('T4 chargeLost:',JSON.stringify(m.rec.sdg));
}
