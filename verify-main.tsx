// 시험 전용 진입점(제품에 포함되지 않음). 실제 App을 띄우고 키보드 입력을 넣어 실시간 완주를 확인한다.
// 입력은 게임 상태를 보지 않는 단순 패턴이라 사람 실력 검증이 아니라, 실시간 완주와 결과 반영 경로 확인이다.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './src/App';
import { Guard } from './src/Guard';
import { MiniPortrait } from './src/MiniPortrait';
import './src/style.css';

const CASE = new URLSearchParams(location.search).get('case') || 'youth';
const SK = 'rookie-soccer.v1';

const TEAM_NAMES = ['우리 구단', '한강 FC', '파도 FC', '북악 FC', '남해 FC', '새벽 FC', '청룡 FC', '은하 FC'];
function schedule(): number[][][] {
    const ids = [0, 1, 2, 3, 4, 5, 6, 7]; const rounds: number[][][] = [];
    for (let r = 0; r < 7; r++) { const pairs: number[][] = []; for (let i = 0; i < 4; i++) pairs.push(r % 2 ? [ids[7 - i], ids[i]] : [ids[i], ids[7 - i]]); rounds.push(pairs); ids.splice(1, 0, ids.pop()!); }
    return [...rounds, ...rounds.map(r => r.map(p => [p[1], p[0]]))];
}

const keepPl = CASE === 'proleague' && (() => { try { const p = JSON.parse(localStorage.getItem(SK) || 'null'); return !!(p && p.league && (p.phase === 'league' || p.phase === 'leagueEnd')); } catch { return false; } })();
if (!keepPl && CASE !== 'golden' && CASE !== 'flow') { // flow: CDP가 신규 문서 스크립트로 주입한 저장을 그대로 쓴다(전이 연결 검증 전용)
localStorage.removeItem(SK);
const base: any = { v: 1, phase: 'home', name: '시험선수', pos: 'FW', stats: { shoot: 58, pass: 50, dribble: 54, defense: 42, speed: 52 }, season: 1, game: 0, trust: 30, ratings: [], trained: false, last: null, evalRes: null, attempts: 1, legacy: 0, proRes: null, league: null };
if (CASE === 'newlook') {
    base.phase = 'new';
    base.look = parseInt(new URLSearchParams(location.search).get('li') || '3', 10) || 0;
}
if (CASE === 'pl2') {
    base.phase = 'league'; base.season = 3; base.game = 1; base.trust = 70; base.proSeason = 2;
    base.hist = [{ n: 1, rk: 8, pts: 4, g: 0, a: 0 }];
    base.stats = { shoot: 71, pass: 63, dribble: 67, defense: 51, speed: 65 };
    base.grow = { n: 1, rk: 8, from: { shoot: 70, pass: 62, dribble: 66, defense: 50, speed: 64 }, to: { shoot: 71, pass: 63, dribble: 67, defense: 51, speed: 65 } };
    base.league = { round: 0, teams: TEAM_NAMES.map((n, i) => ({ id: i, n, str: [64, 52, 56, 60, 64, 68, 72, 58][i], p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 })), fixtures: schedule(), log: [], lastMsg: '' };
}
if (CASE === 'proleague') {
    base.phase = 'league'; base.season = 3; base.game = 1; base.trust = 70; base.proSeason = 1; base.hist = [];
    base.stats = { shoot: 70, pass: 62, dribble: 66, defense: 50, speed: 64 };
    base.league = { round: 0, teams: TEAM_NAMES.map((n, i) => ({ id: i, n, str: [64, 52, 56, 60, 64, 68, 72, 58][i], p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 })), fixtures: schedule(), log: [], lastMsg: '' };
}
if (CASE === 'pro' || CASE === 'touchpro' || CASE === 'goldpro') {
    base.phase = 'league'; base.season = 3; base.game = 1; base.trust = 70; base.proSeason = 1; base.hist = [];
    base.stats = { shoot: 70, pass: 62, dribble: 66, defense: 50, speed: 64 };
    base.league = { round: 0, teams: TEAM_NAMES.map((n, i) => ({ id: i, n, str: [64, 52, 56, 60, 64, 68, 72, 58][i], p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 })), fixtures: schedule(), log: [], lastMsg: '' };
}
if (CASE === 'disp') {
    base.ratings = [6.2, 7.1]; base.game = 2;
}
if (CASE === 'dispeval') {
    base.phase = 'eval'; base.ratings = [6.2, 7.1]; base.game = 2;
    base.evalRes = { ability: 22, perf: Math.round(Math.max(0, Math.min(1, ((6.65 - 5) / 3))) * 35), trust: 8, total: 0, need: 80, early: true, ok: false, missing: '능력치' };
    base.evalRes.total = base.evalRes.ability + base.evalRes.perf + base.evalRes.trust;
}
if (CASE === 'displeague') {
    base.phase = 'league'; base.season = 3; base.game = 1; base.trust = 70; base.proSeason = 1; base.hist = [];
    base.stats = { shoot: 70, pass: 62, dribble: 66, defense: 50, speed: 64 };
    base.league = { round: 2, teams: TEAM_NAMES.map((n, i) => ({ id: i, n, str: [64, 52, 56, 60, 64, 68, 72, 58][i], p: 2, w: 1, d: 0, l: 1, gf: 3, ga: 3 })), fixtures: schedule(), lastMsg: '우리 구단 2 : 1 한강 FC',
        log: [ { rating: 7.4, goals: 2, assists: 1, played: true, sc: [2, 1], vs: '한강 FC' }, { rating: 0, goals: 0, assists: 0, played: false, sc: [0, 2], vs: '파도 FC' } ] };
}
if (CASE === 'yhist') {
    base.phase = 'result'; base.game = 1; base.trust = 55; base.ratings = [6.2, 7.1];
    base.sg = 3; base.sa = 1; base.sgn = 2;
    base.last = { score: [2, 0], rating: 7.1, goals: 2, assists: 0, passOk: 3, passAtt: 5, shots: 2, tackles: 1, trustD: 6, grew: '슛' };
}
localStorage.setItem(SK, JSON.stringify(base));
}
let seededRaw: string | null = null;
if (CASE === 'corruptsave') { // 유효 JSON이지만 렌더 예외를 일으키는 형태(리그 라운드 범위 밖)
    localStorage.setItem(SK, JSON.stringify({ v: 1, phase: 'league', name: '시험선수', pos: 'FW', stats: { shoot: 80, pass: 80, dribble: 80, defense: 80, speed: 80 }, season: 3, game: 1, trust: 70, ratings: [], trained: false, last: null, evalRes: null, attempts: 1, legacy: 0, league: { round: 99, teams: TEAM_NAMES.map((n, i) => ({ id: i, n, str: 60, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 })), fixtures: schedule(), log: [], lastMsg: '' } }));
    seededRaw = localStorage.getItem(SK);
}
if (CASE === 'sdgbad') { // 진단 필드 오염(문자열): 형태 검증이 거부하고 원본을 보존해야 한다
    localStorage.setItem(SK, JSON.stringify({ v: 1, phase: 'home', name: '시험선수', pos: 'FW', stats: { shoot: 58, pass: 50, dribble: 54, defense: 42, speed: 52 }, season: 1, game: 0, trust: 30, ratings: [], trained: false, last: null, evalRes: null, attempts: 1, legacy: 0, league: null, sdg: { f: 'junk', n: 1 } }));
    seededRaw = localStorage.getItem(SK);
}
if (CASE === 'corruptjson') { // 문법이 깨진 JSON: 파싱 실패도 같은 보존·정지 경로여야 한다
    localStorage.setItem(SK, '{"v":1,"phase":"league","league":{"round":9');
    seededRaw = localStorage.getItem(SK);
}
if (CASE === 'resetfail') { // 손상 시드 + 삭제 실패 주입: 정지·원본 유지를 확인한다
    localStorage.setItem(SK, JSON.stringify({ v: 1, phase: 'league', name: '시험선수', pos: 'FW', stats: { shoot: 80, pass: 80, dribble: 80, defense: 80, speed: 80 }, season: 3, game: 1, trust: 70, ratings: [], trained: false, last: null, evalRes: null, attempts: 1, legacy: 0, league: { round: 99, teams: TEAM_NAMES.map((n, i) => ({ id: i, n, str: 60, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 })), fixtures: schedule(), log: [], lastMsg: '' } }));
    seededRaw = localStorage.getItem(SK);
    Storage.prototype.removeItem = function () { throw new Error('denied'); };
}
if (CASE === 'importfail') { // 복원 전 보관(prerestore) 쓰기 실패 주입: 복원이 멈추고 저장이 바뀌지 않아야 한다
    const origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) { if (k === SK + '.prerestore') throw new Error('denied'); origSet.call(this, k, v); };
    (window as any).confirm = () => true; // 사용자 승인 모사(확인창 자체의 검증이 아님)
}
if (CASE === 'importraw') { // 원문 JSON 붙여넣기 복원: 저장 코드가 아니어도 원문 JSON을 받아야 한다
    (window as any).confirm = () => true;
}
if (CASE === 'importwritefail') { // prerestore 보관은 성공, 주 키 쓰기만 실패 주입: 복구 성공으로 오안내하지 않아야 한다
    const origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) { if (k === SK) throw new Error('denied'); origSet.call(this, k, v); };
    (window as any).confirm = () => true;
}
if (CASE === 'writefail') { // 주 저장 쓰기 전면 실패: 경고 문구가 상태로 렌더되어야 한다
    Storage.prototype.setItem = function () { throw new Error('denied'); };
}
if (CASE === 'oldsave') { // 구버전 정상 세이브 모사(새 선택 필드 없음, proRes 잔존) — 과잉 거부가 없어야 한다
    localStorage.setItem(SK, JSON.stringify({ v: 1, phase: 'home', name: '옛선수', pos: 'FW', stats: { shoot: 61, pass: 53, dribble: 57, defense: 45, speed: 55 }, season: 2, game: 1, trust: 45, ratings: [6.1], trained: false, last: null, evalRes: null, attempts: 1, legacy: 0, proRes: null, league: null }));
}

if (CASE === 'unreadable') { // getItem 실패 환경 모사: 읽기 불가 안내·정지 경로(실제 브라우저 거부가 아닌 코드 경로 시험)
    Storage.prototype.getItem = function () { throw new Error('denied'); };
    Storage.prototype.setItem = function () { (window as any).__wr = true; };
    Storage.prototype.removeItem = function () { (window as any).__wr = true; };
}

(window as any).__errors = []; (window as any).__log = []; (window as any).__done = false;
window.addEventListener('error', e => (window as any).__errors.push(String((e as ErrorEvent).message)));
window.addEventListener('unhandledrejection', e => (window as any).__errors.push('rej:' + String((e as PromiseRejectionEvent).reason)));

if (CASE === 'portrait') {
    const li = parseInt(new URLSearchParams(location.search).get('li') || '0', 10) || 0;
    createRoot(document.getElementById('root')!).render(<div style={{ background: '#1b2b4a', width: 390, height: 600, color: '#fff' }}>look {li}<MiniPortrait look={li} size={300} /></div>);
    setTimeout(() => { (window as any).__done = true; }, 8000);
} else if (CASE === 'golden') { // 앱이 실제로 생성해 둔 저장을 읽어 들여 거부 없이 렌더되는지 회귀 확인
    const gi = new URLSearchParams(location.search).get('gi') || 'result';
    fetch('golden/' + gi + '.json').then(r => r.text()).then(raw => { localStorage.setItem(SK, raw); createRoot(document.getElementById('root')!).render(<Guard><App /></Guard>); });
} else createRoot(document.getElementById('root')!).render(<Guard><App /></Guard>);

const log = (ev: string, data?: any) => { (window as any).__log.push({ t: Math.round(performance.now() / 1000), ev, ...data }); };
const kd = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
const ku = (k: string) => window.dispatchEvent(new KeyboardEvent('keyup', { key: k }));
const DIRS = ['arrowup', 'arrowright', 'arrowdown', 'arrowleft'];
let held: string[] = [];
const clickBtn = (txt: string) => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').includes(txt) && !(x as HTMLButtonElement).disabled); if (b) { (b as HTMLButtonElement).click(); return true; } return false; };
const save = () => { try { return JSON.parse(localStorage.getItem(SK) || '{}'); } catch { return {}; } };

setInterval(() => {
    if ((window as any).__done) return;
    const body = document.body.textContent || '';
    if (CASE === 'home0' || CASE === 'flow') return; // 홈 화면 표시 전용(스크린샷) / flow는 CDP 구동, 자동 진행 없음
    if (CASE === 'sdgbad') {
        if (body.includes('손상되어 열 수 없다')) {
            log('sdgBadHeld', { notice: true, mainUntouched: localStorage.getItem(SK) === seededRaw, gameNotEntered: !body.includes('선수 만들기') });
            (window as any).__done = true; document.title = 'VERIFY_DONE';
        }
        return;
    }
    if (CASE === 'resetfail') {
        if (!(window as any).__cs1 && body.includes('손상되어 열 수 없다')) {
            (window as any).__cs1 = true;
            if (clickBtn('새로 시작')) return;
        }
        if ((window as any).__cs1 && !(window as any).__cs2 && body.includes('정말 진행할까')) { (window as any).__cs2 = true; clickBtn('삭제하고 새로 시작'); return; }
        if ((window as any).__cs2 && body.includes('지우지 못해')) {
            log('resetFailHeld', { notice: true, mainUntouched: localStorage.getItem(SK) === seededRaw, gameNotEntered: !body.includes('선수 만들기') });
            (window as any).__done = true; document.title = 'VERIFY_DONE';
        }
        return;
    }
    if (CASE === 'importfail' || CASE === 'importraw' || CASE === 'importwritefail') {
        const ta = document.querySelector('textarea') as HTMLTextAreaElement | null;
        if (!ta) { const sum = [...document.querySelectorAll('summary')].find(x => (x.textContent || '').includes('저장 백업')); if (sum) (sum as HTMLElement).click(); return; }
        const good: any = { v: 1, phase: 'home', name: CASE === 'importraw' ? '원문선수' : '보관실패', pos: 'FW', stats: { shoot: 61, pass: 53, dribble: 57, defense: 45, speed: 55 }, season: 2, game: 1, trust: CASE === 'importraw' ? 55 : 77, ratings: [6.1], trained: false, last: null, evalRes: null, attempts: 1, legacy: 0, league: null };
        if (!(window as any).__badSet) {
            (window as any).__badSet = true;
            const raw = JSON.stringify(good);
            const payload = CASE === 'importfail' ? btoa(unescape(encodeURIComponent(raw))) : raw;
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
            setter.call(ta, payload); ta.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => clickBtn('이 코드로 복구'), 300);
            return;
        }
        if (CASE === 'importfail' && body.includes('보관에 실패해 복구를 멈췄다')) {
            const sv = save();
            log('importFailHeld', { notice: true, saveUnchanged: sv.phase === 'home' && sv.name === '시험선수' && sv.trust === 30, noFalseSuccess: !body.includes('불러왔다') });
            (window as any).__done = true; document.title = 'VERIFY_DONE';
            return;
        }
        if (CASE === 'importwritefail' && body.includes('쓰지 못해 복구를 멈췄다')) {
            const sv = save();
            log('importWriteFailHeld', { notice: true, saveUnchanged: sv.phase === 'home' && sv.name === '시험선수' && sv.trust === 30, prerestoreKept: !!localStorage.getItem(SK + '.prerestore'), noFalseSuccess: !body.includes('불러왔다') });
            (window as any).__done = true; document.title = 'VERIFY_DONE';
            return;
        }
        if (CASE === 'importraw' && body.includes('불러왔다')) {
            const sv = save();
            log('importRawOk', { restored: sv.name === '원문선수' && sv.trust === 55, prerestoreKept: !!localStorage.getItem(SK + '.prerestore') });
            (window as any).__done = true; document.title = 'VERIFY_DONE';
        }
        return;
    }
    if (CASE === 'writefail') {
        if (body.includes('저장이 막혀 있다')) {
            log('writeFailWarned', { notice: true, mainUntouched: save().name === '시험선수', gameShown: body.includes('경기 시작') });
            (window as any).__done = true; document.title = 'VERIFY_DONE';
        }
        return;
    }
    if (CASE === 'golden') {
        const gi = new URLSearchParams(location.search).get('gi') || 'result';
        const MARKERS: Record<string, string> = { result: '경기 결과', homeyhist: '유스 기록:', eval: '승격 평가', leaguemid: '/14라운드', leagueend: '시즌 종료', pro2: '시즌 성장 (' };
        const marker = MARKERS[gi] || '';
        if (body.includes('손상되어')) { log('goldenRejected', { gi }); (window as any).__done = true; document.title = 'VERIFY_FAIL'; return; }
        if (marker && body.includes(marker)) {
            log('goldenOk', { gi, phase: save().phase, errorCount: (window as any).__errors.length });
            (window as any).__done = true; document.title = (window as any).__errors.length ? 'VERIFY_FAIL' : 'VERIFY_DONE';
        }
        return;
    }
    if (CASE === 'goldpro') { // 직접 1라운드 + 자동 나머지: 혼합 기록의 실제 생성 저장 수집용
        const inM = [...document.querySelectorAll('button')].some(x => (x.textContent || '').trim() === '슛');
        if (!inM) {
            const mm = body.match(/리그 (\d+)\/14라운드/);
            if (mm && parseInt(mm[1], 10) === 3 && !(window as any).__gpMid) { (window as any).__gpMid = true; log('goldenLeagueMid', { raw: localStorage.getItem(SK) }); }
            if (body.includes('시즌 종료')) {
                if (!(window as any).__gpEnd) { (window as any).__gpEnd = true; log('goldenLeagueEnd', { raw: localStorage.getItem(SK) }); }
                if (clickBtn('시즌 시작')) return;
                return;
            }
            if ((window as any).__gpEnd && body.includes('리그 1/14라운드')) { log('goldenPro2', { raw: localStorage.getItem(SK) }); (window as any).__done = true; document.title = 'VERIFY_DONE'; return; }
            if (mm && parseInt(mm[1], 10) === 1 && !(window as any).__gpPlayed) { if (clickBtn('직접 뛰기')) { (window as any).__gpPlayed = true; log('playRound1'); return; } }
            if (mm && clickBtn('자동 진행')) return;
            return;
        }
    }
    if (CASE === 'corruptsave' || CASE === 'corruptjson') {
        const corruptKeys = Object.keys(localStorage).filter(k => k.startsWith(SK + '.corrupt-'));
        if (!(window as any).__cs1 && body.includes('손상되어 열 수 없다')) {
            (window as any).__cs1 = true;
            log('corruptNotice', { case: CASE, notice: true, asideKeys: corruptKeys.length, mainUntouched: localStorage.getItem(SK) === seededRaw, gameNotEntered: !body.includes('선수 만들기') });
            if (new URLSearchParams(location.search).has('hold')) { (window as any).__done = true; document.title = 'VERIFY_DONE'; return; }
            if (clickBtn('새로 시작')) return;
        }
        if ((window as any).__cs1 && body.includes('정말 진행할까')) { clickBtn('삭제하고 새로 시작'); return; }
        if ((window as any).__cs1 && body.includes('선수 만들기')) {
            log('corruptReset', { enteredNew: true, mainRemoved: localStorage.getItem(SK) === null, asideKept: Object.keys(localStorage).filter(k => k.startsWith(SK + '.corrupt-')).length === 1 });
            (window as any).__done = true; document.title = 'VERIFY_DONE';
        }
        return;
    }
    if (CASE === 'unreadable') {
        if (body.includes('저장소를 읽을 수 없어')) {
            log('unreadableShown', { notice: true, noWriteAttempt: !(window as any).__wr, gameNotEntered: !body.includes('선수 만들기') });
            (window as any).__done = true; document.title = 'VERIFY_DONE';
        }
        return;
    }
    if (CASE === 'oldsave') {
        if (body.includes('손상되어 원본을')) { log('oldsaveFalselyRejected', {}); (window as any).__done = true; document.title = 'VERIFY_FAIL'; return; }
        if (body.includes('경기 시작')) { log('oldsaveOk', { phase: save().phase, trust: save().trust }); (window as any).__done = true; document.title = 'VERIFY_DONE'; }
        return;
    }
    if (CASE === 'crashui') {
        if (body.includes('화면을 표시하지 못했다')) {
            log('guardShown', { hasRetry: body.includes('다시 시도'), hasExport: body.includes('저장 원본 보기'), hasTwoStepWipe: body.includes('저장을 지우고 새로 시작') });
            (window as any).__done = true; document.title = 'VERIFY_DONE';
        }
        return;
    }
    if (CASE === 'badimport') {
        const ta = document.querySelector('textarea') as HTMLTextAreaElement | null;
        if (!ta) { const sum = [...document.querySelectorAll('summary')].find(x => (x.textContent || '').includes('저장 백업')); if (sum) (sum as HTMLElement).click(); return; }
        const okTeams = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ id: i, n: 'T' + i, str: 60, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }));
        const okLeague = () => ({ round: 0, teams: okTeams, fixtures: [[[0, 1]]], log: [] });
        const baseImp = () => ({ v: 1, phase: 'league', stats: { shoot: 80, pass: 80, dribble: 80, defense: 80, speed: 80 }, league: okLeague() });
        const CODES: [any, string][] = [ // 모두 구조는 정상인 채 한 곳만 잘못 — 사유 분리 확인
            [{ ...baseImp(), league: { ...okLeague(), round: 99 } }, '리그 라운드 범위 오류'],
            [{ ...baseImp(), ratings: [7, null] }, '평점 목록 원소 오류'],
            [{ ...baseImp(), yhist: [null] }, '유스 기록 원소 오류'],
            [{ ...baseImp(), league: { ...okLeague(), fixtures: [[[0, 9]]] } }, '리그 대진 팀 번호 오류'],
            [{ ...baseImp(), league: { ...okLeague(), log: [{ rating: 7, goals: null, assists: 0, played: true }] } }, '리그 기록 원소 수치 오류'],
        ];
        const idx = (window as any).__badIdx || 0;
        if (!(window as any).__badSet) {
            if (idx >= CODES.length) { (window as any).__done = true; document.title = 'VERIFY_DONE'; return; }
            (window as any).__badSet = true;
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
            setter.call(ta, btoa(unescape(encodeURIComponent(JSON.stringify(CODES[idx][0]))))); ta.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => clickBtn('이 코드로 복구'), 300);
            return;
        }
        const rm = body.match(/저장 코드가 아니다\(([^)]*)\)/);
        if (rm && rm[1] !== (window as any).__lastReason) {
            (window as any).__lastReason = rm[1];
            log('badImportRejected', { idx, expect: CODES[idx][1], reason: rm[1], matched: rm[1] === CODES[idx][1] });
            if (idx === CODES.length - 1) { const sv = save(); log('badImportAll', { saveUnchanged: sv.phase === 'home' && sv.name === '시험선수' && sv.trust === 30 }); (window as any).__done = true; document.title = 'VERIFY_DONE'; return; }
            (window as any).__badIdx = idx + 1; (window as any).__badSet = false;
        }
        return;
    }
    if (body.includes('3D 표시 실패')) { log('webglFail', { text: body.slice(0, 200) }); (window as any).__done = true; document.title = 'VERIFY_FAIL'; return; }
    if (CASE === 'yhist') {
        if (body.includes('유스 2시즌')) { const sv = save(); log('yhistAfter', { yhist: sv.yhist, season: sv.season, sg: sv.sg, sa: sv.sa, sgn: sv.sgn, ratings: sv.ratings, hasLine: body.includes('유스 기록:'), raw: localStorage.getItem(SK) }); (window as any).__done = true; document.title = 'VERIFY_DONE'; return; }
        if (body.includes('다음 시즌')) { if (clickBtn('다음 시즌')) { log('evalNext'); return; } }
        if (body.includes('시즌 말 승격 평가')) { if (clickBtn('시즌 말 승격 평가')) { log('toEval'); return; } }
        return;
    }
    if (CASE === 'disp' && body.includes('이번 시즌 평점')) {
        const m = body.match(/이번 시즌 평점: [0-9. ·]+\(평균 [0-9.]+\)/);
        log('dispLine', { text: m ? m[0] : 'NO_MATCH', growthLine: body.includes('태클 1회 이상이면') }); (window as any).__done = true; document.title = 'VERIFY_DONE'; return;
    }
    if (CASE === 'dispeval' && body.includes('기준')) {
        const m = body.match(/경기 활약 [0-9]+\/35점은 이번 시즌 평균 평점 [0-9.]+ 기준[^승]*?만점\./);
        log('evalLine', { text: m ? m[0] : 'NO_MATCH', raw: localStorage.getItem(SK) }); (window as any).__done = true; document.title = 'VERIFY_DONE'; return;
    }
    if (CASE === 'displeague' && body.includes('라운드 기록')) {
        const det = [...document.querySelectorAll('details')].find(d => (d.textContent || '').includes('라운드 기록')) as HTMLDetailsElement | undefined;
        const sum = det?.querySelector('summary') as HTMLElement | null;
        if (det && !det.open && sum) { sum.click(); return; }
        const txt = (det && det.textContent) || '';
        log('displeague', { open: !!det?.open, showsPlayedGA: txt.includes('2골 1도움'), showsPlayedRating: txt.includes('평점 7.4'), showsAuto: txt.includes('자동'), sample: txt.slice(0, 140) });
        (window as any).__done = true; document.title = 'VERIFY_DONE'; return;
    }
    const inMatch = [...document.querySelectorAll('button')].some(x => (x.textContent || '').trim() === '슛');
    if (CASE === 'touch' || CASE === 'touchpro') { if (inMatch) { if (!(window as any).__ready) { (window as any).__ready = true; log('ready'); } return; } }
    if (inMatch) {
        held.forEach(ku); held = [];
        if (new URLSearchParams(location.search).has('noauto')) return; // 제어 입력 시험: 자동 이동·스페이스·k/q 모두 억제
        const t = performance.now() / 1000;
        const d1 = DIRS[Math.floor(t / 2) % 4]; kd(d1); held.push(d1);
        if (Math.floor(t) % 2) { const d2 = DIRS[(Math.floor(t / 2) + 1) % 4]; kd(d2); held.push(d2); }
        if (Math.floor(t * 2) % 4 === 0) { kd(' '); setTimeout(() => ku(' '), 120); }
        if (Math.floor(t) % 6 === 3) { kd('k'); setTimeout(() => ku('k'), 800); }
        if ((CASE === 'pro' || CASE === 'proleague') && Math.floor(t) % 4 === 1) { kd('q'); setTimeout(() => ku('q'), 120); }
        return;
    }
    held.forEach(ku); held = [];
    if (clickBtn('경기 시작')) { log('startMatch'); return; }
    if (CASE === 'youth' && body.includes('경기 결과')) {
        const sv = save();
        log('result', { last: sv.last, phase: sv.phase, sg: sv.sg, sa: sv.sa, sgn: sv.sgn, raw: localStorage.getItem(SK) });
        // 저장 백업 코드 만들기 확인
        const sum = [...document.querySelectorAll('summary')].find(x => (x.textContent || '').includes('저장 백업'));
        if (sum) { (sum as HTMLElement).click(); setTimeout(() => { clickBtn('코드 만들기'); setTimeout(() => { const ta = document.querySelector('textarea') as HTMLTextAreaElement | null; log('backupExport', { len: ta ? ta.value.length : -1 }); (window as any).__done = true; document.title = 'VERIFY_DONE'; }, 300); }, 300); }
        else { (window as any).__done = true; document.title = 'VERIFY_DONE'; }
        return;
    }
    if (CASE === 'newlook') {
    base.phase = 'new';
    base.look = parseInt(new URLSearchParams(location.search).get('li') || '3', 10) || 0;
}
if (CASE === 'pl2') {
    base.phase = 'league'; base.season = 3; base.game = 1; base.trust = 70; base.proSeason = 2;
    base.hist = [{ n: 1, rk: 8, pts: 4, g: 0, a: 0 }];
    base.stats = { shoot: 71, pass: 63, dribble: 67, defense: 51, speed: 65 };
    base.grow = { n: 1, rk: 8, from: { shoot: 70, pass: 62, dribble: 66, defense: 50, speed: 64 }, to: { shoot: 71, pass: 63, dribble: 67, defense: 51, speed: 65 } };
    base.league = { round: 0, teams: TEAM_NAMES.map((n, i) => ({ id: i, n, str: [64, 52, 56, 60, 64, 68, 72, 58][i], p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 })), fixtures: schedule(), log: [], lastMsg: '' };
}
if (CASE === 'proleague') {
        if (body.includes('1군 2시즌 리그 1/14라운드')) { const sv = save(); log('season2Start', { proSeason: sv.proSeason, hist: sv.hist, grow: sv.grow, stats: sv.stats, round: sv.league?.round, logLen: sv.league?.log?.length }); (window as any).__done = true; document.title = 'VERIFY_DONE'; return; }
        if (body.includes('시즌 종료')) { const sv = save(); log('seasonEnd', { log: sv.league?.log?.map((e: any) => [e.sc, e.played, e.rating, e.goals, e.assists]), teams: sv.league?.teams?.map((t: any) => [t.n, t.p, t.w, t.d, t.l, t.gf, t.ga]) }); if (clickBtn('시즌 시작 (성장 적용)')) { log('nextSeason'); return; } }
        { const mm = body.match(/리그 (\d+)\/14라운드/); if (mm) document.title = 'PLC-r' + mm[1]; }
        if (body.includes('/14라운드')) { const cnt = (window as any).__plc = ((window as any).__plc || 0) + 1; if (cnt % 3 === 0) { if (clickBtn('자동 진행')) { log('autoRound'); return; } } if (clickBtn('직접 뛰기')) { log('playRound'); return; } return; }
    }
    if (CASE === 'pro' && body.includes('리그 2/14라운드')) {
        const sv = save();
        log('leagueAfter', { round: sv.league?.round, log: sv.league?.log, lastMsg: sv.league?.lastMsg, teams: sv.league?.teams?.map((t: any) => [t.n, t.p, t.w, t.d, t.l, t.gf, t.ga]) });
        (window as any).__done = true; document.title = 'VERIFY_DONE';
        return;
    }
    if ((CASE === 'pro' || CASE === 'touchpro') && !new URLSearchParams(location.search).has('noauto') && clickBtn('직접 뛰기')) { log('playRound'); return; }
}, 500);
