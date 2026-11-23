import { POS, avgKeyOf, abilityScore, perfScore, trustScore, trustDelta, needFor } from './growth';
import { MiniPortrait, LOOKS } from './MiniPortrait';
import React, { useState } from 'react';
import { Callout, Closing, Facts, FileCard, Group, Header, useLocalState, type StoreBlock } from './ui';
import { MatchView, type Result } from './MatchView3D';
import { validateSave, normalizeSave } from './saveGuard';
declare const __TEST_HOOKS__: boolean;
// 검증 통과 뒤 정상 구버전 저장의 누락 하위 필드를 채운다(로드·복원 공통)
const checkSave = (o: any): string | null => { const bad = validateSave(o); if (bad) return bad; normalizeSave(o); return null; };
const CRASH = typeof __TEST_HOOKS__ !== 'undefined' && __TEST_HOOKS__ && typeof location !== 'undefined' && new URLSearchParams(location.search).has('crash');
import type { Pos, Stats } from './engine';

const SK: { key: keyof Stats; name: string }[] = [{ key: 'shoot', name: '슛' }, { key: 'pass', name: '패스' }, { key: 'dribble', name: '드리블' }, { key: 'defense', name: '수비' }, { key: 'speed', name: '속도' }];

const MATCHES_PER_SEASON = 2, SEASONS = 3, HALF = 70;
interface Team { id: number; n: string; str: number; p: number; w: number; d: number; l: number; gf: number; ga: number }
interface League { round: number; teams: Team[]; fixtures: number[][][]; log: { rating: number; goals: number; assists: number; played: boolean; sc?: [number, number]; vs?: string }[]; lastMsg: string }
interface Save { v: 1; grow?: { n: number; rk: number; from: Stats; to: Stats }; tr?: string; look?: number; phase: 'new' | 'home' | 'result' | 'eval' | 'pro' | 'league' | 'leagueEnd'; league: League | null; name: string; pos: Pos; stats: Stats; season: number; game: number; trust: number; ratings: number[]; trained: boolean; last: null | { score: [number, number]; rating: number; goals: number; assists: number; passOk: number; passAtt: number; shots: number; tackles: number; trustD: number; grew: string; gb?: boolean }; evalRes: null | { ability: number; perf: number; trust: number; total: number; need: number; early: boolean; ok: boolean; missing: string }; attempts: number; legacy: number; proSeason?: number; sg?: number; sa?: number; sgn?: number; sdg?: { f: number; n: number; w: number; r: number; c: number }; /* 슛 진단 누적: 발사 f, 무소유 릴리스 n, 충전 중 소유 상실 후 릴리스 w, 방출 시점 소유 상실 r, 취소 c (원인 미확정 슛0 조사용 최소 자료) */ yhist?: { n: number; avg: number; ok: boolean; g?: number; a?: number }[]; hist?: { n: number; rk: number; pts: number; g: number; a: number }[] }
const initial: Save = { v: 1, phase: 'new', name: '내 선수', pos: 'FW', stats: POS[0].base, season: 1, game: 0, trust: 30, ratings: [], trained: false, last: null, evalRes: null, attempts: 1, legacy: 0, league: null };
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
    const teams = lg.teams.map(t => ({ ...t })); const fx = lg.fixtures[lg.round]; let msg = ''; let myRec: { sc: [number, number]; vs: string } | null = null;
    for (const [h, a] of fx) {
        let gh: number, ga: number; const mine = h === 0 || a === 0;
        if (mine && myScore) { const mineHome = h === 0; gh = mineHome ? myScore[0] : myScore[1]; ga = mineHome ? myScore[1] : myScore[0]; }
        else { const sh = teams[h].str, sa = teams[a].str; gh = poisson(1.3 * Math.pow(sh / sa, 1.3)); ga = poisson(1.3 * Math.pow(sa / sh, 1.3)); }
        const T1 = teams[h], T2 = teams[a]; T1.p++; T2.p++; T1.gf += gh; T1.ga += ga; T2.gf += ga; T2.ga += gh;
        if (gh > ga) { T1.w++; T2.l++; } else if (gh < ga) { T2.w++; T1.l++; } else { T1.d++; T2.d++; }
        if (mine) { msg = `${teams[h].n} ${gh} : ${ga} ${teams[a].n}`; myRec = { sc: (h === 0 ? [gh, ga] : [ga, gh]) as [number, number], vs: teams[h === 0 ? a : h].n }; }
    }
    return { ...lg, teams, round: lg.round + 1, log: [...lg.log, { rating: rec?.rating ?? 0, goals: rec?.goals ?? 0, assists: rec?.assists ?? 0, played: !!rec, sc: myRec?.sc, vs: myRec?.vs }], lastMsg: msg };
}
const myFixture = (lg: League) => { const p = lg.fixtures[lg.round].find(x => x[0] === 0 || x[1] === 0)!; return p[0] === 0 ? p[1] : p[0]; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
// 1군 시즌 사이 성장: 순위가 높을수록 주 능력치가 더 오른다. 나머지 능력치는 +1.
const proGain = (rk: number) => rk <= 2 ? 3 : rk <= 5 ? 2 : 1;
const proGrow = (st: Stats, pos: Pos, rk: number): Stats => { const key = (POS.find(p => p.id === pos) || POS[0]).key; const g = proGain(rk); const o = { ...st }; (Object.keys(o) as (keyof Stats)[]).forEach(k => { o[k] = clamp(o[k] + (key.includes(k) ? g : 1), 0, 99); }); return o; };
const avgKey = avgKeyOf;

function Btn({ children, onClick, kind = 'primary', disabled }: { children: React.ReactNode; onClick: () => void; kind?: 'primary' | 'secondary'; disabled?: boolean }) {
    return <button type="button" className="file-button is-compact" data-variant={kind} disabled={disabled} onClick={onClick} style={{ minHeight: 44 }}>{children}</button>;
}
function Table({ lg }: { lg: League }) {
    return <table className="rs-table"><thead><tr><th>순</th><th>팀</th><th>경기</th><th>승무패</th><th>득실</th><th>승점</th></tr></thead><tbody>{sorted(lg.teams).map((t, i) => <tr key={t.id} className={t.id === 0 ? 'rs-me' : ''}><td>{i + 1}</td><td>{t.n}</td><td>{t.p}</td><td>{t.w}-{t.d}-{t.l}</td><td>{t.gf - t.ga}</td><td><b>{pts(t)}</b></td></tr>)}</tbody></table>;
}
function Backup({ save, onRestore, persist }: { save: Save; onRestore: (v: Save) => void; persist: (v: Save) => boolean }) {
    const [code, setCode] = useState(''); const [msg, setMsg] = useState('');
    const enc = (o: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
    const dec = (t: string) => JSON.parse(decodeURIComponent(escape(atob(t))));
    const doExport = () => { try { setCode(enc(save)); setMsg('아래 코드를 복사해 두면 된다. 이 코드에는 지금까지의 진행이 들어 있다.'); } catch { setMsg('코드를 만들지 못했다.'); } };
    const doImport = () => {
        let o: any = null;
        try { o = dec(code.trim()); } catch { try { o = JSON.parse(code.trim()); } catch { setMsg('코드를 읽지 못했다. 복사가 잘 됐는지 확인해 달라.'); return; } } // 저장 코드(base64) 또는 원문 JSON 모두 받는다
        const bad = checkSave(o);
        if (bad) { setMsg('이 코드는 이 게임의 저장 코드가 아니다(' + bad + ').'); return; }
        if (!window.confirm('지금 진행을 지우고 이 코드의 진행으로 바꿀까?')) return;
        let cur: string | null;
        try { cur = localStorage.getItem('rookie-soccer.v1'); } catch { setMsg('지금 진행을 읽을 수 없어 복구를 멈췄다. 저장은 바뀌지 않았다.'); return; }
        if (cur) { try { localStorage.setItem('rookie-soccer.v1.prerestore', cur); } catch { setMsg('직전 진행 보관에 실패해 복구를 멈췄다. 저장은 바뀌지 않았다.'); return; } } // 보관 실패 시 덮어쓰지 않고 멈춘다
        const nv = { ...initial, ...o };
        if (!persist(nv)) { setMsg('저장소에 쓰지 못해 복구를 멈췄다. 기존 저장은 그대로다. 브라우저 저장 설정을 확인해 달라.'); return; } // 주 저장 쓰기 실패 시 복구 성공으로 안내하지 않는다
        onRestore(nv); setMsg(cur ? '불러왔다. (직전 진행은 이 브라우저에 한 벌 보관됐다.)' : '불러왔다.');
    };
    return <details className="rs-info"><summary>저장 백업·복구</summary>
        <p className="rs-hint">진행은 이 브라우저에만 저장된다. 코드를 복사해 두면 저장이 지워져도, 다른 기기나 브라우저에서도 이어 할 수 있다.</p>
        <div className="rs-row"><Btn kind="secondary" onClick={doExport}>코드 만들기</Btn><Btn kind="secondary" onClick={doImport} disabled={!code.trim()}>이 코드로 복구</Btn></div>
        <textarea className="rs-input" style={{ width: '100%', minHeight: 64, boxSizing: 'border-box', resize: 'vertical' }} value={code} onChange={e => setCode(e.target.value)} placeholder="저장 코드 또는 원문 JSON" />
        {msg && <p className="rs-hint">{msg}</p>}
    </details>;
}
function CorruptScreen({ block, resetFailed, onReset }: { block: StoreBlock; resetFailed: boolean; onReset: () => void }) {
    const [confirming, setConfirming] = useState(false);
    if (block.kind === 'unreadable') return <>
        <Callout>저장소를 읽을 수 없어 진행을 열지 못했다. 저장된 데이터는 건드리지 않은 상태다. 브라우저가 이 사이트의 저장을 막고 있지 않은지 확인한 뒤 다시 열어 달라.</Callout>
    </>;
    return <>
        <Callout>저장된 진행 데이터가 손상되어 열 수 없다. 원본은 그대로 보존되어 있다{block.asideOk ? '(이 브라우저에 별도 사본도 보관했다)' : '(별도 사본 보관에 실패했다. 아래 코드를 직접 복사해 보관해 달라)'}.</Callout>
        <details className="rs-info" open={!block.asideOk}><summary>손상된 원본 보기(원문 JSON — 보관용, 고친 뒤 복구 입력에 붙여 복원 가능)</summary><textarea className="rs-input" readOnly style={{ width: '100%', minHeight: 96, boxSizing: 'border-box' }} value={block.raw} /></details>
        {resetFailed && <Callout>원본을 지우지 못해 새로 시작을 멈췄다. 저장된 데이터는 그대로다. 브라우저 저장 설정을 확인한 뒤 다시 시도해 달라.</Callout>}
        {!confirming
            ? <Btn kind="secondary" onClick={() => setConfirming(true)}>새로 시작</Btn>
            : <Callout>새로 시작하면 손상된 원본은 지워진다. {block.asideOk ? '별도 사본은 남는다. ' : ''}정말 진행할까? <Btn kind="secondary" onClick={onReset}>삭제하고 새로 시작</Btn></Callout>}
    </>;
}
const fmtY = (h: { n: number; avg: number; ok: boolean; g?: number; a?: number }) => `${h.n}시즌 평균 ${h.avg.toFixed(1)}${h.g !== undefined ? ` · ${h.g}골 ${h.a}도움` : ''} · ${h.ok ? '승격' : '미달'}`;
function Bars({ s }: { s: Stats }) {
    return <div className="rs-bars">{SK.map(k => <div key={k.key} className="rs-bar"><span>{k.name}</span><div><i style={{ width: `${clamp(s[k.key], 0, 100)}%` }} /></div><b>{s[k.key]}</b></div>)}</div>;
}

export function App() {
    const [save, setSave, saved] = useLocalState<Save>('rookie-soccer.v1', initial, checkSave);
    const [playing, setPlaying] = useState<null | { oppStr: number; team: boolean; kind: 'youth' | 'pro' }>(null);
    const [key, setKey] = useState(0);
    if (CRASH) throw new Error('verify-crash');
    const set = (p: Partial<Save>) => { if (saved.ready) setSave({ ...save, ...p }); };
    const s = save;
    if (saved.corrupt) return <FileCard>
        <Header title="루키나인 축구" fact="유스에서 키워 1군으로. 7대7" />
        <CorruptScreen block={saved.corrupt} resetFailed={saved.resetFailed} onReset={saved.reset} />
    </FileCard>;

    const startMatch = () => { setKey(k => k + 1); setPlaying({ oppStr: 44 + (s.season - 1) * 5 + s.game * 3, team: false, kind: 'youth' }); };
    const train = (k: keyof Stats) => {
        const posd = POS.find(p => p.id === s.pos)!; const gain = posd.key.includes(k) ? 3 : 2;
        set({ stats: { ...s.stats, [k]: clamp(s.stats[k] + gain, 0, 99) }, trained: true, tr: `${SK.find(x => x.key === k)!.name} +${gain}` });
    };
    const finish = (r: Result) => {
        setPlaying(null);
        const ct = (v: any) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.floor(v) : 0); const rs = r.rec.sdg;
        const sdg = { f: ct(s.sdg?.f) + ct(r.rec.shots), n: ct(s.sdg?.n) + ct(rs?.n), w: ct(s.sdg?.w) + ct(rs?.w), r: ct(s.sdg?.r) + ct(rs?.r), c: ct(s.sdg?.c) + ct(rs?.c) };
        if (playing?.kind === 'pro') { const lg = applyRound(s.league!, r.score, { rating: r.rating, goals: r.rec.goals, assists: r.rec.assists }); set({ league: lg, phase: lg.round >= 14 ? 'leagueEnd' : 'league', sdg }); return; }
        const trustD = trustDelta(r.rating); const stats = { ...s.stats }; let grew = '';
        const bump = (k: keyof Stats) => { stats[k] = clamp(stats[k] + 1, 0, 99); grew = grew ? grew + ', ' + SK.find(x => x.key === k)!.name : SK.find(x => x.key === k)!.name; };
        if (r.rec.goals + r.rec.shots >= 2) bump('shoot'); if (r.rec.passOk >= 3) bump('pass'); if (r.rec.tackles >= 1) bump('defense'); let gb = false; if (!grew) { bump(POS.find(p => p.id === s.pos)!.key[0]); gb = true; }
        set({ phase: 'result', stats, trust: clamp(s.trust + trustD, 0, 100), ratings: [...s.ratings, r.rating], sg: (s.sg ?? 0) + r.rec.goals, sa: (s.sa ?? 0) + r.rec.assists, sgn: (s.sgn ?? 0) + 1, sdg, last: { score: r.score, rating: r.rating, goals: r.rec.goals, assists: r.rec.assists, passOk: r.rec.passOk, passAtt: r.rec.passAtt, shots: r.rec.shots, tackles: r.rec.tackles, trustD, grew, gb } });
    };
    const afterResult = () => {
        if (s.game + 1 >= MATCHES_PER_SEASON) {
            const ability = abilityScore(s.stats, s.pos);
            const perf = perfScore(s.ratings);
            const trust = trustScore(s.trust); const total = ability + perf + trust; const final = s.season >= SEASONS; const need = needFor(s.season, SEASONS); const ok = total >= need;
            const miss: [string, number][] = [['능력치', 40 - ability], ['경기 활약', 35 - perf], ['감독 신뢰', 25 - trust]]; miss.sort((a, b) => b[1] - a[1]);
            set({ phase: 'eval', evalRes: { ability, perf, trust, total, need, early: !final, ok, missing: miss[0][0] } });
        } else set({ phase: 'home', game: s.game + 1, trained: false });
    };
    const afterEval = () => {
        const e = s.evalRes!;
        const avg = s.ratings.length ? s.ratings.reduce((a, c) => a + c, 0) / s.ratings.length : 0;
        const rec: { n: number; avg: number; ok: boolean; g?: number; a?: number } = { n: s.season, avg: Math.round(avg * 100) / 100, ok: e.ok };
        if (s.ratings.length > 0 && (s.sgn ?? 0) >= s.ratings.length) { rec.g = s.sg ?? 0; rec.a = s.sa ?? 0; }
        const yhist = [...(s.yhist ?? []), rec];
        if (e.ok) { set({ phase: 'pro', yhist, sg: 0, sa: 0, sgn: 0 }); return; }
        if (s.season >= SEASONS) { const b: Stats = { ...s.stats }; const L2 = s.legacy + 3; (Object.keys(b) as (keyof Stats)[]).forEach(k => { b[k] = clamp(b[k] + 3, 0, 99); }); set({ phase: 'home', season: 1, game: 0, trust: 40, ratings: [], stats: b, trained: false, attempts: s.attempts + 1, legacy: L2, evalRes: null, yhist, sg: 0, sa: 0, sgn: 0 }); }
        else set({ phase: 'home', season: s.season + 1, game: 0, ratings: [], trained: false, evalRes: null, yhist, sg: 0, sa: 0, sgn: 0 });
    };
    const nextProSeason = () => { const lg = s.league!; const so = sorted(lg.teams); const rk = so.findIndex(t => t.id === 0) + 1; const me = so[rk - 1]; const n = s.proSeason ?? 1; const rec = { n, rk, pts: pts(me), g: lg.log.reduce((a, c) => a + c.goals, 0), a: lg.log.reduce((a, c) => a + c.assists, 0) }; const ns = proGrow(s.stats, s.pos, rk); const myStr = Math.round(60 + (avgKey(ns, s.pos) - 55) * 0.3); set({ hist: [...(s.hist ?? []), rec], stats: ns, grow: { n, rk, from: s.stats, to: ns }, proSeason: n + 1, league: newLeague(myStr), phase: 'league' }); };
    const startLeague = () => { const myStr = Math.round(60 + (avgKey(s.stats, s.pos) - 55) * 0.3); set({ league: newLeague(myStr), phase: 'league' }); };
    const playRound = () => { const lg = s.league!; const o = lg.teams[myFixture(lg)]; setKey(k => k + 1); setPlaying({ oppStr: o.str, team: true, kind: 'pro' }); };
    const autoRound = () => { const lg = s.league!; const me = lg.teams[0], o = lg.teams[myFixture(lg)]; const gm = poisson(1.3 * Math.pow(me.str / o.str, 1.3)), go = poisson(1.3 * Math.pow(o.str / me.str, 1.3)); const nl = applyRound(lg, [gm, go]); set({ league: nl, phase: nl.round >= 14 ? 'leagueEnd' : 'league' }); };
    const reset = () => { if (!saved.ready) return; if (!window.confirm('저장된 진행을 모두 지우고 처음부터 시작할까?')) return; setSave(initial); };

    return <FileCard>
        <Header title="루키나인 축구" fact="유스에서 키워 1군으로. 7대7" />
        <Callout>{saved.message || '진행은 이 기기와 이 브라우저에 저장된다.'}</Callout>
        {playing && <Group label={playing.kind === 'pro' ? '1군 경기: 팀 전체 조작' : `유스 ${s.season}시즌 ${s.game + 1}경기`} heading>
            <MatchView key={key} stats={s.stats} pos={s.pos} oppStr={playing.oppStr} teamControl={playing.team} halfLen={HALF} onFinish={finish} onQuit={() => setPlaying(null)} />
            <p className="rs-hint">왼쪽 화면을 누른 채 끌어서 이동. 슛은 누르고 있으면 힘이 차고, 뗄 때 스틱을 좌우로 잡고 있으면 그쪽 골대 구석을 노린다(스틱을 안 쓰거나 뒤로 당기면 중앙 쪽). 공이 없을 때 패스 버튼은 태클이다{playing.team ? '. 전환은 가까운 선수로 바꾼다' : ''}. 키보드는 WASD·방향키 이동, J·스페이스 패스(공이 없으면 태클), K 홀드 충전 후 떼면 슛, P 일시정지{playing.team ? ', L 전환' : ''}.</p>
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
            {s.ratings.length > 0 && <p className="rs-hint">이번 시즌 평점: {s.ratings.map(r => r.toFixed(1)).join(' · ')} (평균 {(s.ratings.reduce((a, c) => a + c, 0) / s.ratings.length).toFixed(1)})</p>}
            {s.ratings.length === 0 && <p className="rs-hint">이번 시즌 평가 전 — 활약 미집계. 현재 능력치 {abilityScore(s.stats, s.pos)}/40 · 신뢰 {trustScore(s.trust)}/25. 훈련과 경기 성장으로 능력치가, 남은 {MATCHES_PER_SEASON - s.game}경기 평점이 활약과 신뢰를 정한다.</p>}
            {s.ratings.length > 0 && (() => { const ab = abilityScore(s.stats, s.pos), pf = perfScore(s.ratings), ts = trustScore(s.trust), tot = ab + pf + ts, need = needFor(s.season, SEASONS); const left = MATCHES_PER_SEASON - s.game; return <p className="rs-hint">지금 상태로 평가하면 {tot}점 / 기준 {need}점 (능력치 {ab} · 활약 {pf} · 신뢰 {ts}){left > 0 ? `. 남은 ${left}경기 평점이 활약·신뢰를, 훈련·경기 성장이 능력치를 바꾼다.` : ''}</p>; })()}
            {(s.yhist ?? []).length > 0 && <p className="rs-hint">유스 기록: {s.yhist!.map(fmtY).join(' / ')}</p>}
            <p className="rs-hint">경기 전 훈련 하나를 고른다. 오른쪽 숫자가 훈련 후 능력치.</p>
            <p className="rs-hint">경기에서는 슛과 골을 합해 2회 이상이면 슛, 패스 성공 3회 이상이면 패스, 태클 1회 이상이면 수비가 오른다. 어느 조건도 못 채우면 포지션 핵심 능력치가 기본으로 오르고, 드리블과 속도는 경기로는 오르지 않는다.</p>
            <div className="rs-row">{SK.map(k => <Btn key={k.key} kind="secondary" disabled={s.trained} onClick={() => train(k.key)}>{k.name} {s.stats[k.key]}{s.trained ? '' : '→' + clamp(s.stats[k.key] + (POS.find(p => p.id === s.pos)!.key.includes(k.key) ? 3 : 2), 0, 99)}</Btn>)}</div>
            <Btn onClick={startMatch}>{s.trained ? '경기 시작' : '훈련 없이 경기 시작'}</Btn>
        </Group>}
        {!playing && s.phase === 'result' && s.last && <Group label={`경기 결과 · ${s.last.score[0] > s.last.score[1] ? '승리' : s.last.score[0] < s.last.score[1] ? '패배' : '무승부'}`} heading>
            <div className="rs-center"><MiniPortrait look={s.look ?? 0} size={120} /></div>
            <div className="rs-score"><span>{s.last.score[0]}</span><i>:</i><span>{s.last.score[1]}</span></div>
            <div className="rs-tiles">
                {([['평점', s.last.rating.toFixed(1)], ['골', String(s.last.goals)], ['도움', String(s.last.assists)], ['슛', String(s.last.shots)], ['패스', `${s.last.passOk}/${s.last.passAtt}`], ['태클', String(s.last.tackles)]] as [string, string][]).map(([k, v]) => <div key={k} className="rs-tile"><b>{v}</b><small>{k}</small></div>)}
            </div>
            <div className="rs-grow"><strong>이번 경기 성장</strong>{s.last.grew.split(', ').map(g => <span key={g} className="rs-chip">{s.last!.gb ? '기본 성장 ' : ''}{g} +1</span>)}<span className="rs-chip rs-chip-trust">감독 신뢰 {s.last.trustD >= 0 ? '+' : ''}{s.last.trustD}</span></div>
            <p className="rs-hint">경기 평점에 따라 감독 신뢰가 달라진다. 실제 수치는 위에 표시된다.</p>
            <p className="rs-hint">평점은 골 +1.2, 도움 +0.8, 패스 성공 +0.1(10회까지), 유효슛 +0.2, 태클 +0.3, 패스 실패 -0.05, 이기면 +0.5·비기면 +0.2를 기본 5.5에 더해 매긴다.</p>
            <Btn onClick={afterResult}>{s.game + 1 >= MATCHES_PER_SEASON ? '시즌 말 승격 평가' : '다음 경기 준비'}</Btn>
        </Group>}
        {!playing && s.phase === 'eval' && s.evalRes && <Group label={`${s.season}시즌 말 승격 평가`} heading>
            <div className="rs-center"><MiniPortrait look={s.look ?? 0} size={96} /></div>
            <div className="rs-score"><span>{s.evalRes.total}</span><i>/ 100</i></div>
            <p className="rs-hint rs-mid">기준 {s.evalRes.need}점 ({s.evalRes.early ? '조기 승격' : '기본 승격'}) {s.evalRes.ok ? '통과' : '미달'}</p>
            <div className="rs-bars">
                {([['능력치', s.evalRes.ability, 40], ['경기 활약', s.evalRes.perf, 35], ['감독 신뢰', s.evalRes.trust, 25]] as [string, number, number][]).map(([k, v, mx]) => <div key={k} className="rs-bar rs-bar-w"><span>{k}</span><div><i style={{ width: `${Math.min(100, v / mx * 100)}%` }} /></div><b>{v}/{mx}</b></div>)}
            </div>
            <p className="rs-hint rs-mid">경기 활약 {s.evalRes.perf}/35점은 이번 시즌 평균 평점 {(s.ratings.length ? s.ratings.reduce((a, c) => a + c, 0) / s.ratings.length : 0).toFixed(1)} 기준. 평균 5.0이면 0점, 8.0이면 만점.</p>
            {(s.yhist ?? []).length > 0 && <p className="rs-hint rs-mid">유스 기록: {s.yhist!.map(fmtY).join(' / ')}</p>}
            {!s.evalRes.ok && <div className="rs-grow"><strong>만점까지 가장 많이 남은 항목</strong><span className="rs-chip">{s.evalRes.missing}</span><small className="rs-hint">{s.evalRes.missing === '능력치' ? '훈련으로 능력치를 올린다.' : s.evalRes.missing === '경기 활약' ? '평균 평점이 오르면 상승 (8.0이면 만점).' : '경기 평점이 높을수록 감독 신뢰가 더 많이 오른다.'}</small></div>}
            <Btn onClick={afterEval}>{s.evalRes.ok ? '1군 승격' : s.season >= SEASONS ? '재도전 (계승 보상 능력치 +3, 신뢰 40 시작)' : '다음 시즌'}</Btn>
        </Group>}
        {!playing && s.phase === 'pro' && <Group label="1군 승격" heading>
            {(s.yhist ?? []).length > 0 && <Callout>유스 기록: {s.yhist!.map(fmtY).join(' / ')}</Callout>}
            <Callout>승격 후에는 팀 전체를 조작한다. 공을 가진 선수는 직접, 나머지는 AI. 전환 버튼으로 가까운 선수로 바꾼다. 가상 구단 8팀 풀리그(14라운드)이고 직접 뛰지 않는 라운드는 자동 진행한다.</Callout>
            <Btn onClick={startLeague}>1군 리그 시작</Btn>
        </Group>}
        {!playing && s.phase === 'league' && s.league && <Group label={`1군 ${s.proSeason ?? 1}시즌 리그 ${s.league.round + 1}/14라운드`} heading>
            {s.grow && s.league.round === 0 && <Callout>{s.grow.n}시즌 성장 ({s.grow.rk}위): {SK.map(k => `${k.name} ${s.grow!.from[k.key]}→${s.grow!.to[k.key]}`).join(', ')}</Callout>}
            {s.league.lastMsg && <Callout>지난 경기: {s.league.lastMsg}</Callout>}
            <div className="rs-tiles rs-vs">
                <div className="rs-tile"><b>{s.league.teams[0].str}</b><small>우리 구단 강함</small></div>
                <div className="rs-vsm">VS</div>
                <div className="rs-tile"><b>{s.league.teams[myFixture(s.league)].str}</b><small>{s.league.teams[myFixture(s.league)].n}</small></div>
            </div>
            <div className="rs-row"><Btn onClick={playRound}>직접 뛰기</Btn><Btn kind="secondary" onClick={autoRound}>자동 진행</Btn></div>
            <Table lg={s.league} />
            {s.league.log.length > 0 && <details className="rs-info"><summary>라운드 기록 ({s.league.log.length})</summary><p className="rs-hint">{s.league.log.map((e, i) => `${i + 1}R${e.vs ? ' vs ' + e.vs : ''}${e.sc ? ` ${e.sc[0]}:${e.sc[1]}` : ''}${e.played ? ` · 평점 ${e.rating.toFixed(1)} · ${e.goals}골 ${e.assists}도움` : ' · 자동'}`).join(' / ')}</p></details>}
        </Group>}
        {!playing && s.phase === 'leagueEnd' && s.league && <Group label={`1군 ${s.proSeason ?? 1}시즌 종료`} heading>
            {(() => { const so = sorted(s.league.teams); const rk = so.findIndex(t => t.id === 0) + 1; const me = so[rk - 1]; return <>
                <div className="rs-center"><MiniPortrait look={s.look ?? 0} size={96} /></div>
                <div className="rs-score"><span>{rk}위</span><i>/ 8팀</i></div>
                <div className="rs-tiles">
                    <div className="rs-tile"><b>{pts(me)}</b><small>승점</small></div>
                    <div className="rs-tile"><b>{s.league.log.filter(x => x.played).length}</b><small>직접 뛴 경기</small></div>
                    <div className="rs-tile"><b>{s.league.log.reduce((a, c) => a + c.goals, 0)} / {s.league.log.reduce((a, c) => a + c.assists, 0)}</b><small>골 / 도움</small></div>
                </div></>; })()}
            {(s.hist ?? []).length > 0 && (() => { const H = s.hist ?? [], fmt = (h: { n: number; rk: number; pts: number; g?: number; a?: number }) => `${h.n}시즌 ${h.rk}위(승점 ${h.pts}${h.g !== undefined ? `, ${h.g}골 ${h.a}도움` : ''})`, K = 4; return <>
                <p className="rs-hint">지난 시즌: {H.slice(-K).map(fmt).join(', ')}</p>
                {H.length > K && <details className="rs-info"><summary>이전 시즌 기록 보기 ({H.length - K})</summary><p className="rs-hint">{H.slice(0, -K).map(fmt).join(', ')}</p></details>}</>; })()}
            {(() => { const rk = sorted(s.league.teams).findIndex(t => t.id === 0) + 1; const to = proGrow(s.stats, s.pos, rk); return <Callout>성장 예정: {SK.map(k => `${k.name} ${s.stats[k.key]}→${to[k.key]}`).join(', ')}</Callout>; })()}
            <p className="rs-hint">시즌이 끝나면 성장한다. 이번 순위 기준으로 {s.pos === 'FW' ? '공격수' : s.pos === 'MF' ? '미드필더' : '수비수'}의 핵심 능력치({(POS.find(p => p.id === s.pos) || POS[0]).key.map(k => SK.find(x => x.key === k)!.name).join('·')})는 +{proGain(sorted(s.league.teams).findIndex(t => t.id === 0) + 1)}, 나머지는 +1. 새 8팀 리그를 치르고 순위는 기록으로 남는다. 이적은 아직 없다.</p>
            <Table lg={s.league} />
            <Btn onClick={nextProSeason}>{`1군 ${(s.proSeason ?? 1) + 1}시즌 시작 (성장 적용)`}</Btn>
            <Btn kind="secondary" onClick={() => { if (window.confirm('이번 리그 순위와 기록이 지워지고 새 리그가 시작된다. 계속할까?')) startLeague(); }}>리그 다시 도전 (이번 기록 초기화)</Btn>
            <Btn kind="secondary" onClick={reset}>처음부터</Btn>
            <Backup save={s} onRestore={v => { if (saved.ready) setSave(v); }} persist={saved.persist} />
        </Group>}
        {!playing && s.phase !== 'new' && s.phase !== 'leagueEnd' && <div className="rs-foot"><Backup save={s} onRestore={v => { if (saved.ready) setSave(v); }} persist={saved.persist} /><Btn kind="secondary" onClick={reset}>처음부터 다시</Btn></div>}
        <details className="rs-info"><summary>이 버전의 한계와 출처</summary><Group label="이 버전의 한계" heading>
            <Facts items={[
                { label: '모델과 동작', value: '실제 3D. Kenney 3번 캐릭터 모델, 달리기와 대기는 Kenney 동작, 킥은 CMU 모션캡처를 3번 뼈대에 옮겨 입힌 것. 육성 화면의 선수는 Kenney 4번(Mini Characters, CC0)' },
                { label: '없는 것', value: '반칙, 오프사이드, 프리킥, 이적과 재정, 실제 물리 충돌. 공은 단순 계산이다. 헤딩 판정이나 조작은 없고, 높은 공을 받을 때 머리 동작만 보여준다' },
                { label: '미확인', value: '여러 기종 휴대폰 성능, 장시간 플레이 밸런스' },
            ]} />
        </Group></details>
        <Closing>시험 버전. 규칙과 수치는 바뀔 수 있다.</Closing>
    </FileCard>;
}
