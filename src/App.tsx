import { MiniPortrait, LOOKS } from './MiniPortrait';
import React, { useState } from 'react';
import { Callout, Closing, Facts, FileCard, Group, Header, useLocalState } from './ui';
import { MatchView, type Result } from './MatchView3D';
import type { Pos, Stats } from './engine';

const SK: { key: keyof Stats; name: string }[] = [{ key: 'shoot', name: '슛' }, { key: 'pass', name: '패스' }, { key: 'dribble', name: '드리블' }, { key: 'defense', name: '수비' }, { key: 'speed', name: '속도' }];
const POS: { id: Pos; name: string; base: Stats; key: (keyof Stats)[] }[] = [
    { id: 'FW', name: '공격수', base: { shoot: 58, pass: 50, dribble: 54, defense: 42, speed: 52 }, key: ['shoot', 'dribble', 'speed'] },
    { id: 'MF', name: '미드필더', base: { shoot: 48, pass: 58, dribble: 54, defense: 50, speed: 50 }, key: ['pass', 'dribble', 'defense'] },
    { id: 'DF', name: '수비수', base: { shoot: 40, pass: 50, dribble: 46, defense: 60, speed: 52 }, key: ['defense', 'speed', 'pass'] },
];
const MATCHES_PER_SEASON = 2, SEASONS = 3, HALF = 70;
interface Team { id: number; n: string; str: number; p: number; w: number; d: number; l: number; gf: number; ga: number }
interface League { round: number; teams: Team[]; fixtures: number[][][]; log: { rating: number; goals: number; assists: number; played: boolean }[]; lastMsg: string }
interface Save { v: 1; tr?: string; look?: number; phase: 'new' | 'home' | 'result' | 'eval' | 'pro' | 'league' | 'leagueEnd'; league: League | null; name: string; pos: Pos; stats: Stats; season: number; game: number; trust: number; ratings: number[]; trained: boolean; last: null | { score: [number, number]; rating: number; goals: number; assists: number; passOk: number; passAtt: number; shots: number; tackles: number; trustD: number; grew: string }; evalRes: null | { ability: number; perf: number; trust: number; total: number; need: number; early: boolean; ok: boolean; missing: string }; attempts: number; legacy: number; proRes: null }
const initial: Save = { v: 1, phase: 'new', name: '내 선수', pos: 'FW', stats: POS[0].base, season: 1, game: 0, trust: 30, ratings: [], trained: false, last: null, evalRes: null, attempts: 1, legacy: 0, proRes: null, league: null };
const TEAM_NAMES = ['우리 구단', '한강 FC', '파도 FC', '북악 FC', '남해 FC', '새벽 FC', '청룡 FC', '은하 FC'];
const poisson = (lam: number) => { const l = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > l); return k - 1; };
function schedule(): number[][][] {
    const ids = [0, 1, 2, 3, 4, 5, 6, 7]; const rounds: number[][][] = [];
    for (let r = 0; r < 7; r++) { const pairs: number[][] = []; for (let i = 0; i < 4; i++) pairs.push(r % 2 ? [ids[7 - i], ids[i]] : [ids[i], ids[7 - i]]); rounds.push(pairs); ids.splice(1, 0, ids.pop()!); }
    return [...rounds, ...rounds.map(r => r.map(p => [p[1], p[0]]))];
}
function newLeague(myStr: number): League {
    const strs = [myStr, 52, 56, 60, 64, 68, 72, 58];
    return { round: 0, teams: TEAM_NAMES.map((n, i) => ({ id: i, n, str: strs[i], p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 })), fixtures: schedule(), log: [], lastMsg: '' };
}
const pts = (t: Team) => t.w * 3 + t.d;
const sorted = (ts: Team[]) => [...ts].sort((a, b) => pts(b) - pts(a) || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
function applyRound(lg: League, myScore: [number, number] | null, rec?: { rating: number; goals: number; assists: number }): League {
    const teams = lg.teams.map(t => ({ ...t })); const fx = lg.fixtures[lg.round]; let msg = '';
    for (const [h, a] of fx) {
        let gh: number, ga: number; const mine = h === 0 || a === 0;
        if (mine && myScore) { const mineHome = h === 0; gh = mineHome ? myScore[0] : myScore[1]; ga = mineHome ? myScore[1] : myScore[0]; }
        else { const sh = teams[h].str, sa = teams[a].str; gh = poisson(1.3 * Math.pow(sh / sa, 1.3)); ga = poisson(1.3 * Math.pow(sa / sh, 1.3)); }
        const T1 = teams[h], T2 = teams[a]; T1.p++; T2.p++; T1.gf += gh; T1.ga += ga; T2.gf += ga; T2.ga += gh;
        if (gh > ga) { T1.w++; T2.l++; } else if (gh < ga) { T2.w++; T1.l++; } else { T1.d++; T2.d++; }
        if (mine) msg = `${teams[h].n} ${gh} : ${ga} ${teams[a].n}`;
    }
    return { ...lg, teams, round: lg.round + 1, log: [...lg.log, { rating: rec?.rating ?? 0, goals: rec?.goals ?? 0, assists: rec?.assists ?? 0, played: !!rec }], lastMsg: msg };
}
const myFixture = (lg: League) => { const p = lg.fixtures[lg.round].find(x => x[0] === 0 || x[1] === 0)!; return p[0] === 0 ? p[1] : p[0]; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const avgKey = (s: Stats, pos: Pos) => { const k = POS.find(p => p.id === pos)!.key; return k.reduce((a, c) => a + s[c], 0) / k.length; };

function Btn({ children, onClick, kind = 'primary', disabled }: { children: React.ReactNode; onClick: () => void; kind?: 'primary' | 'secondary'; disabled?: boolean }) {
    return <button type="button" className="file-button is-compact" data-variant={kind} disabled={disabled} onClick={onClick} style={{ minHeight: 44 }}>{children}</button>;
}
function Table({ lg }: { lg: League }) {
    return <table className="rs-table"><thead><tr><th>순</th><th>팀</th><th>경기</th><th>승무패</th><th>득실</th><th>승점</th></tr></thead><tbody>{sorted(lg.teams).map((t, i) => <tr key={t.id} className={t.id === 0 ? 'rs-me' : ''}><td>{i + 1}</td><td>{t.n}</td><td>{t.p}</td><td>{t.w}-{t.d}-{t.l}</td><td>{t.gf - t.ga}</td><td><b>{pts(t)}</b></td></tr>)}</tbody></table>;
}
function Bars({ s }: { s: Stats }) {
    return <div className="rs-bars">{SK.map(k => <div key={k.key} className="rs-bar"><span>{k.name}</span><div><i style={{ width: `${clamp(s[k.key], 0, 100)}%` }} /></div><b>{s[k.key]}</b></div>)}</div>;
}

export function App() {
    const [save, setSave, saved] = useLocalState<Save>('rookie-soccer.v1', initial);
    const [playing, setPlaying] = useState<null | { oppStr: number; team: boolean; kind: 'youth' | 'pro' }>(null);
    const [key, setKey] = useState(0);
    const set = (p: Partial<Save>) => { if (saved.ready) setSave({ ...save, ...p }); };
    const s = save;

    const startMatch = () => { setKey(k => k + 1); setPlaying({ oppStr: 44 + (s.season - 1) * 5 + s.game * 3 + s.attempts * 0, team: false, kind: 'youth' }); };
    const train = (k: keyof Stats) => {
        const posd = POS.find(p => p.id === s.pos)!; const gain = posd.key.includes(k) ? 3 : 2;
        set({ stats: { ...s.stats, [k]: clamp(s.stats[k] + gain, 0, 99) }, trained: true, tr: `${SK.find(x => x.key === k)!.name} +${gain}` });
    };
    const finish = (r: Result) => {
        setPlaying(null);
        if (playing?.kind === 'pro') { const lg = applyRound(s.league!, r.score, { rating: r.rating, goals: r.rec.goals, assists: r.rec.assists }); set({ league: lg, phase: lg.round >= 14 ? 'leagueEnd' : 'league' }); return; }
        const trustD = Math.round((r.rating - 6.5) * 6 + 2); const stats = { ...s.stats }; let grew = '';
        const bump = (k: keyof Stats) => { stats[k] = clamp(stats[k] + 1, 0, 99); grew = grew ? grew + ', ' + SK.find(x => x.key === k)!.name : SK.find(x => x.key === k)!.name; };
        if (r.rec.goals + r.rec.shots >= 2) bump('shoot'); if (r.rec.passOk >= 3) bump('pass'); if (r.rec.tackles >= 1) bump('defense'); if (!grew) bump(POS.find(p => p.id === s.pos)!.key[0]);
        set({ phase: 'result', stats, trust: clamp(s.trust + trustD, 0, 100), ratings: [...s.ratings, r.rating], last: { score: r.score, rating: r.rating, goals: r.rec.goals, assists: r.rec.assists, passOk: r.rec.passOk, passAtt: r.rec.passAtt, shots: r.rec.shots, tackles: r.rec.tackles, trustD, grew } });
    };
    const afterResult = () => {
        if (s.game + 1 >= MATCHES_PER_SEASON) {
            const ability = Math.round(clamp((avgKey(s.stats, s.pos) - 45) / 25, 0, 1) * 40);
            const avgR = s.ratings.reduce((a, c) => a + c, 0) / Math.max(1, s.ratings.length); const perf = Math.round(clamp((avgR - 5) / 3, 0, 1) * 35);
            const trust = Math.round(s.trust / 100 * 25); const total = ability + perf + trust; const final = s.season >= SEASONS; const need = final ? 65 : 80; const ok = total >= need;
            const miss: [string, number][] = [['능력치', 40 - ability], ['경기 활약', 35 - perf], ['감독 신뢰', 25 - trust]]; miss.sort((a, b) => b[1] - a[1]);
            set({ phase: 'eval', evalRes: { ability, perf, trust, total, need, early: !final, ok, missing: miss[0][0] } });
        } else set({ phase: 'home', game: s.game + 1, trained: false });
    };
    const afterEval = () => {
        const e = s.evalRes!;
        if (e.ok) { set({ phase: 'pro' }); return; }
        if (s.season >= SEASONS) { const posd = POS.find(p => p.id === s.pos)!; const b: Stats = { ...posd.base }; const L2 = s.legacy + 3; (Object.keys(b) as (keyof Stats)[]).forEach(k => { b[k] += L2; }); set({ phase: 'home', season: 1, game: 0, trust: 40, ratings: [], stats: b, trained: false, attempts: s.attempts + 1, legacy: L2, evalRes: null }); }
        else set({ phase: 'home', season: s.season + 1, game: 0, ratings: [], trained: false, evalRes: null });
    };
    const startLeague = () => { const myStr = Math.round(60 + (avgKey(s.stats, s.pos) - 55) * 0.3); set({ league: newLeague(myStr), phase: 'league' }); };
    const playRound = () => { const lg = s.league!; const o = lg.teams[myFixture(lg)]; setKey(k => k + 1); setPlaying({ oppStr: o.str, team: true, kind: 'pro' }); };
    const autoRound = () => { const lg = s.league!; const me = lg.teams[0], o = lg.teams[myFixture(lg)]; const gm = poisson(1.3 * Math.pow(me.str / o.str, 1.3)), go = poisson(1.3 * Math.pow(o.str / me.str, 1.3)); const nl = applyRound(lg, [gm, go]); set({ league: nl, phase: nl.round >= 14 ? 'leagueEnd' : 'league' }); };
    const reset = () => { if (!saved.ready) return; if (!window.confirm('저장된 진행을 모두 지우고 처음부터 시작할까?')) return; setSave(initial); };

    return <FileCard>
        <Header title="루키나인 축구" fact="유스에서 키워 1군으로. 7대7" />
        <Callout>{saved.message || '진행은 이 기기와 이 브라우저에 저장된다.'}</Callout>
        {playing && <Group label={playing.kind === 'pro' ? '1군 경기: 팀 전체 조작' : `유스 ${s.season}시즌 ${s.game + 1}경기`} heading>
            <MatchView key={key} stats={s.stats} pos={s.pos} oppStr={playing.oppStr} teamControl={playing.team} halfLen={HALF} onFinish={finish} onQuit={() => setPlaying(null)} />
            <p className="rs-hint">왼쪽 화면을 누른 채 끌어서 이동. 슛은 누르고 있으면 힘이 찬다. 공이 없을 때 패스 버튼은 태클이다{playing.team ? '. 전환은 가까운 선수로 바꾼다' : ''}. 키보드는 방향키, 스페이스 패스, K 슛.</p>
        </Group>}
        {!playing && s.phase === 'new' && <Group label="선수 만들기" heading>
            <label className="rs-field">이름<input className="rs-input" value={s.name} maxLength={8} onChange={e => set({ name: e.target.value })} /></label>
            <div className="rs-center"><MiniPortrait look={s.look ?? 0} /></div>
            <div className="rs-row">{LOOKS.map((_, i) => <Btn key={i} kind={(s.look ?? 0) === i ? 'primary' : 'secondary'} onClick={() => set({ look: i })}>외형 {i + 1}</Btn>)}</div>
            <div className="rs-row">{POS.map(p => <Btn key={p.id} kind={s.pos === p.id ? 'primary' : 'secondary'} onClick={() => set({ pos: p.id, stats: p.base })}>{p.name}</Btn>)}</div>
            <Bars s={s.stats} />
            <Btn onClick={() => set({ phase: 'home', trained: false })}>유스팀 입단</Btn>
        </Group>}
        {!playing && s.phase === 'home' && <Group label={`${s.name} 유스 ${s.season}시즌 ${s.game + 1}/${MATCHES_PER_SEASON}경기`} heading>
            <div className="rs-center"><MiniPortrait look={s.look ?? 0} size={88} /></div>
            <div className="rs-tiles">
                <div className="rs-tile"><b>{s.trust}</b><small>감독 신뢰 / 100</small></div>
                <div className="rs-tile"><b>{44 + (s.season - 1) * 5 + s.game * 3}</b><small>다음 상대 강함</small></div>
                <div className="rs-tile"><b>{s.attempts}</b><small>{s.attempts}번째 도전 (계승 +{s.legacy})</small></div>
            </div>
            <Bars s={s.stats} />
            {s.trained && s.tr && <div className="rs-grow"><strong>이번 훈련 성장</strong><span className="rs-chip">{s.tr}</span></div>}
            <p className="rs-hint">경기 전 훈련 하나를 고른다. 숫자는 오르는 양.</p>
            <div className="rs-row">{SK.map(k => <Btn key={k.key} kind="secondary" disabled={s.trained} onClick={() => train(k.key)}>{k.name} +{POS.find(p => p.id === s.pos)!.key.includes(k.key) ? 3 : 2}</Btn>)}</div>
            <Btn onClick={startMatch}>{s.trained ? '경기 시작' : '훈련 없이 경기 시작'}</Btn>
        </Group>}
        {!playing && s.phase === 'result' && s.last && <Group label={`경기 결과 · ${s.last.score[0] > s.last.score[1] ? '승리' : s.last.score[0] < s.last.score[1] ? '패배' : '무승부'}`} heading>
            <div className="rs-center"><MiniPortrait look={s.look ?? 0} size={120} /></div>
            <div className="rs-score"><span>{s.last.score[0]}</span><i>:</i><span>{s.last.score[1]}</span></div>
            <div className="rs-tiles">
                {([['평점', s.last.rating.toFixed(1)], ['골', String(s.last.goals)], ['도움', String(s.last.assists)], ['슛', String(s.last.shots)], ['패스', `${s.last.passOk}/${s.last.passAtt}`], ['태클', String(s.last.tackles)]] as [string, string][]).map(([k, v]) => <div key={k} className="rs-tile"><b>{v}</b><small>{k}</small></div>)}
            </div>
            <div className="rs-grow"><strong>이번 경기 성장</strong>{s.last.grew.split(', ').map(g => <span key={g} className="rs-chip">{g} +1</span>)}<span className="rs-chip rs-chip-trust">감독 신뢰 {s.last.trustD >= 0 ? '+' : ''}{s.last.trustD}</span></div>
            <Btn onClick={afterResult}>{s.game + 1 >= MATCHES_PER_SEASON ? '시즌 말 승격 평가' : '다음 경기 준비'}</Btn>
        </Group>}
        {!playing && s.phase === 'eval' && s.evalRes && <Group label={`${s.season}시즌 말 승격 평가`} heading>
            <div className="rs-center"><MiniPortrait look={s.look ?? 0} size={96} /></div>
            <div className="rs-score"><span>{s.evalRes.total}</span><i>/ 100</i></div>
            <p className="rs-hint rs-mid">기준 {s.evalRes.need}점 ({s.evalRes.early ? '조기 승격' : '기본 승격'}) {s.evalRes.ok ? '통과' : '미달'}</p>
            <div className="rs-bars">
                {([['능력치', s.evalRes.ability, 40], ['경기 활약', s.evalRes.perf, 35], ['감독 신뢰', s.evalRes.trust, 25]] as [string, number, number][]).map(([k, v, mx]) => <div key={k} className="rs-bar rs-bar-w"><span>{k}</span><div><i style={{ width: `${Math.min(100, v / mx * 100)}%` }} /></div><b>{v}/{mx}</b></div>)}
            </div>
            {!s.evalRes.ok && <div className="rs-grow"><strong>가장 부족한 항목</strong><span className="rs-chip">{s.evalRes.missing}</span><small className="rs-hint">{s.evalRes.missing === '능력치' ? '훈련으로 능력치를 올린다.' : s.evalRes.missing === '경기 활약' ? '평균 평점이 오르면 상승 (8.0이면 만점).' : '평점 약 6.25 이상이면 신뢰 상승, 약 6.1 미만이면 하락 (사이는 그대로).'}</small></div>}
            <Btn onClick={afterEval}>{s.evalRes.ok ? '1군 승격' : s.season >= SEASONS ? '재도전 (계승 보상 +3)' : '다음 시즌'}</Btn>
        </Group>}
        {!playing && s.phase === 'pro' && <Group label="1군 승격" heading>
            <Callout>승격 후에는 팀 전체를 조작한다. 공을 가진 선수는 직접, 나머지는 AI. 전환 버튼으로 가까운 선수로 바꾼다. 가상 구단 8팀 풀리그(14라운드)이고 직접 뛰지 않는 라운드는 자동 진행한다.</Callout>
            <Btn onClick={startLeague}>1군 리그 시작</Btn>
        </Group>}
        {!playing && s.phase === 'league' && s.league && <Group label={`1군 리그 ${s.league.round + 1}/14라운드`} heading>
            {s.league.lastMsg && <Callout>지난 경기: {s.league.lastMsg}</Callout>}
            <div className="rs-tiles rs-vs">
                <div className="rs-tile"><b>{s.league.teams[0].str}</b><small>우리 구단 강함</small></div>
                <div className="rs-vsm">VS</div>
                <div className="rs-tile"><b>{s.league.teams[myFixture(s.league)].str}</b><small>{s.league.teams[myFixture(s.league)].n}</small></div>
            </div>
            <div className="rs-row"><Btn onClick={playRound}>직접 뛰기</Btn><Btn kind="secondary" onClick={autoRound}>자동 진행</Btn></div>
            <Table lg={s.league} />
        </Group>}
        {!playing && s.phase === 'leagueEnd' && s.league && <Group label="1군 첫 시즌 종료" heading>
            {(() => { const so = sorted(s.league.teams); const rk = so.findIndex(t => t.id === 0) + 1; const me = so[rk - 1]; return <>
                <div className="rs-center"><MiniPortrait look={s.look ?? 0} size={96} /></div>
                <div className="rs-score"><span>{rk}위</span><i>/ 8팀</i></div>
                <div className="rs-tiles">
                    <div className="rs-tile"><b>{pts(me)}</b><small>승점</small></div>
                    <div className="rs-tile"><b>{s.league.log.filter(x => x.played).length}</b><small>직접 뛴 경기</small></div>
                    <div className="rs-tile"><b>{s.league.log.reduce((a, c) => a + c.goals, 0)} / {s.league.log.reduce((a, c) => a + c.assists, 0)}</b><small>골 / 도움</small></div>
                </div></>; })()}
            <p className="rs-hint">이 버전은 여기까지. 다음 시즌은 아직 없다.</p>
            <Table lg={s.league} />
            <Btn onClick={() => { if (window.confirm('이번 리그 순위와 기록이 지워지고 새 리그가 시작된다. 계속할까?')) startLeague(); }}>리그 다시 도전 (이번 기록 초기화)</Btn>
            <Btn kind="secondary" onClick={reset}>처음부터</Btn>
        </Group>}
        {!playing && s.phase !== 'new' && s.phase !== 'leagueEnd' && <div className="rs-foot"><Btn kind="secondary" onClick={reset}>처음부터 다시</Btn></div>}
        <details className="rs-info"><summary>이 버전의 한계와 출처</summary><Group label="이 버전의 한계" heading>
            <Facts items={[
                { label: '모델과 동작', value: '실제 3D. Kenney 3번 캐릭터 모델, 달리기와 대기는 Kenney 동작, 킥은 CMU 모션캡처를 3번 뼈대에 옮겨 입힌 것. 육성 화면의 선수는 Kenney 4번(Mini Characters, CC0)' },
                { label: '없는 것', value: '반칙, 오프사이드, 헤딩, 프리킥, 이적과 재정, 실제 물리 충돌. 공은 단순 계산이다' },
                { label: '미확인', value: '여러 기종 휴대폰 성능, 장시간 플레이 밸런스' },
            ]} />
        </Group></details>
        <Closing>시험 버전. 규칙과 수치는 바뀔 수 있다.</Closing>
    </FileCard>;
}
