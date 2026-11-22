// 손상 저장 방어: 저장 데이터의 형태를 검사한다. 반환 null = 통과, 문자열 = 거부 사유.
// 원칙: 이 앱이 실제로 쓰는 저장은 모두 통과시키고(누락 필드는 허용 — 구버전 호환),
// 렌더·진행 중 예외를 일으킬 수 있는 잘못된 형태만 거부한다.
import { POS } from './growth';
import type { Stats } from './engine';

const PHASES = ['new', 'home', 'result', 'eval', 'pro', 'league', 'leagueEnd'];
const STAT_KEYS: (keyof Stats)[] = ['shoot', 'pass', 'dribble', 'defense', 'speed'];
const num = (x: unknown) => typeof x === 'number' && isFinite(x);
const statsShape = (s: any): boolean => !!s && typeof s === 'object' && STAT_KEYS.every(k => num(s[k]));
// result 단계 렌더가 쓰는 last의 최소 형태
const lastShape = (l: any): string | null => {
    if (!l || typeof l !== 'object' || Array.isArray(l)) return '지난 경기 형태 오류';
    if (!Array.isArray(l.score) || l.score.length !== 2 || !num(l.score[0]) || !num(l.score[1])) return '지난 경기 점수 오류';
    for (const k of ['rating', 'goals', 'assists', 'passOk', 'passAtt', 'shots', 'tackles', 'trustD']) if (!num(l[k])) return '지난 경기 수치 오류: ' + k;
    if (typeof l.grew !== 'string') return '지난 경기 성장 문구 오류';
    return null;
};
// eval 단계 렌더가 쓰는 evalRes의 최소 형태
const evalShape = (e: any): string | null => {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return '평가 결과 형태 오류';
    for (const k of ['ability', 'perf', 'trust', 'total', 'need']) if (!num(e[k])) return '평가 결과 수치 오류: ' + k;
    if (typeof e.early !== 'boolean' || typeof e.ok !== 'boolean' || typeof e.missing !== 'string') return '평가 결과 형태 오류';
    return null;
};

export function validateSave(o: any): string | null {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return '객체가 아님';
    if (o.v !== 1) return '버전이 다름';
    if (typeof o.phase !== 'string' || !PHASES.includes(o.phase)) return '알 수 없는 단계';
    if (o.pos !== undefined && !POS.some(p => p.id === o.pos)) return '알 수 없는 포지션';
    if (o.stats !== undefined) { // stats가 있으면 5개 수치가 모두 숫자여야 함(이 앱은 항상 전체를 쓴다)
        if (!o.stats || typeof o.stats !== 'object') return '능력치 형태 오류';
        for (const k of STAT_KEYS) if (!num(o.stats[k])) return '능력치 수치 오류: ' + k;
    }
    for (const k of ['season', 'game', 'trust', 'attempts', 'legacy', 'proSeason']) if (o[k] !== undefined && !num(o[k])) return '수치 필드 오류: ' + k;
    if (o.ratings !== undefined) {
        if (!Array.isArray(o.ratings)) return '평점 목록 형태 오류';
        for (const r of o.ratings) if (!num(r)) return '평점 목록 원소 오류'; // 렌더에서 toFixed/합산에 쓴다
    }
    if (o.yhist !== undefined) {
        if (!Array.isArray(o.yhist)) return '유스 기록 형태 오류';
        for (const h of o.yhist) {
            if (!h || typeof h !== 'object' || Array.isArray(h)) return '유스 기록 원소 오류';
            if (!num(h.n) || !num(h.avg) || typeof h.ok !== 'boolean') return '유스 기록 원소 수치 오류';
            if ((h.g !== undefined && !num(h.g)) || (h.a !== undefined && !num(h.a))) return '유스 기록 원소 수치 오류';
        }
    }
    if (o.hist !== undefined) {
        if (!Array.isArray(o.hist)) return '1군 기록 형태 오류';
        for (const h of o.hist) {
            if (!h || typeof h !== 'object' || Array.isArray(h)) return '1군 기록 원소 오류';
            if (!num(h.n) || !num(h.rk) || !num(h.pts)) return '1군 기록 원소 수치 오류';
            if ((h.g !== undefined && !num(h.g)) || (h.a !== undefined && !num(h.a))) return '1군 기록 원소 수치 오류';
        }
    }
    if (o.last !== undefined && o.last !== null) { const bad = lastShape(o.last); if (bad) return bad; }
    if (o.evalRes !== undefined && o.evalRes !== null) { const bad = evalShape(o.evalRes); if (bad) return bad; }
    if (o.grow !== undefined && o.grow !== null) {
        const g = o.grow;
        if (!g || typeof g !== 'object' || !num(g.n) || !num(g.rk) || !statsShape(g.from) || !statsShape(g.to)) return '성장 기록 형태 오류';
    }
    // 단계별 필수 데이터: 이 앱은 해당 단계에 진입할 때 함께 기록하므로, 없으면 렌더 예외가 나는 손상이다
    if (o.phase === 'result' && (o.last === undefined || o.last === null)) return '단계에 필요한 지난 경기 없음';
    if (o.phase === 'eval' && (o.evalRes === undefined || o.evalRes === null)) return '단계에 필요한 평가 결과 없음';
    if ((o.phase === 'league' || o.phase === 'leagueEnd') && (o.league === undefined || o.league === null)) return '단계에 필요한 리그 없음';
    if (o.league !== undefined && o.league !== null) {
        const lg = o.league;
        if (typeof lg !== 'object' || Array.isArray(lg)) return '리그 형태 오류';
        if (!Array.isArray(lg.teams) || lg.teams.length !== 8) return '리그 팀 수 오류';
        for (const t of lg.teams) {
            if (!t || typeof t.n !== 'string') return '리그 팀 형태 오류';
            for (const k of ['str', 'p', 'w', 'd', 'l', 'gf', 'ga']) if (!num(t[k])) return '리그 팀 수치 오류: ' + k;
        }
        if (!Array.isArray(lg.fixtures) || !lg.fixtures.length) return '리그 일정 오류';
        for (const r of lg.fixtures) {
            if (!Array.isArray(r)) return '리그 라운드 형태 오류';
            for (const pr of r) if (!Array.isArray(pr) || pr.length !== 2 || !Number.isInteger(pr[0]) || !Number.isInteger(pr[1]) || pr[0] < 0 || pr[1] < 0 || pr[0] >= lg.teams.length || pr[1] >= lg.teams.length) return '리그 대진 팀 번호 오류'; // teams 배열 인덱스로 접근하므로 정수 범위 검사
        }
        if (!Number.isInteger(lg.round) || lg.round < 0 || lg.round > lg.fixtures.length) return '리그 라운드 범위 오류';
        if (o.phase === 'league' && lg.round >= lg.fixtures.length) return '리그 단계와 라운드 불일치'; // fixtures[round] 접근 예외 방지
        if (lg.log !== undefined) {
            if (!Array.isArray(lg.log)) return '리그 기록 형태 오류';
            for (const e of lg.log) {
                if (!e || typeof e !== 'object' || Array.isArray(e)) return '리그 기록 원소 오류';
                if (!num(e.rating) || !num(e.goals) || !num(e.assists) || typeof e.played !== 'boolean') return '리그 기록 원소 수치 오류'; // 합산·toFixed·필터에 쓴다
                if (e.sc !== undefined && (!Array.isArray(e.sc) || e.sc.length !== 2 || !num(e.sc[0]) || !num(e.sc[1]))) return '리그 기록 원소 점수 오류';
                if (e.vs !== undefined && typeof e.vs !== 'string') return '리그 기록 원소 오류';
            }
        }
    }
    return null;
}

// 정상 구버전 저장의 누락 하위 필드만 기본값으로 채운다(검증 통과 후에만 호출).
// 리그 기록(log) 필드는 도입 이후 모든 버전이 원소 전체를 기록했으므로, log 자체가 없는 초기 저장만 []로 채운다.
export function normalizeSave(o: any): void {
    if (o && o.league && typeof o.league === 'object') {
        if (!Array.isArray(o.league.log)) o.league.log = [];
        if (typeof o.league.lastMsg !== 'string') o.league.lastMsg = '';
    }
}
