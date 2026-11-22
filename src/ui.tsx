import React, { useEffect, useRef, useState } from 'react';
export function FileCard({ children }: { children: React.ReactNode }) { return <main className="ui-card">{children}</main>; }
export function Header({ title, fact, intro }: { title: string; fact?: string; intro?: string }) { return <header><h1 className="ui-title">{title}</h1>{fact && <p className="ui-fact">{fact}</p>}{intro && <p className="ui-intro">{intro}</p>}</header>; }
export function Callout({ children }: { children: React.ReactNode }) { return <p className="ui-callout">{children}</p>; }
export function Closing({ children }: { children: React.ReactNode }) { return <p className="ui-closing">{children}</p>; }
export function Group({ label, children }: { label: string; heading?: boolean; children: React.ReactNode }) { return <section className="ui-group"><h2>{label}</h2>{children}</section>; }
export function Facts({ items }: { items: { label: string; value: string }[] }) { return <dl className="ui-facts">{items.map(i => <div key={i.label}><dt>{i.label}</dt><dd>{i.value}</dd></div>)}</dl>; }
// 이 브라우저(localStorage)에 저장한다. [값, 바꾸기, 저장됨 여부]
export type StoreBlock = { kind: 'corrupt'; raw: string; asideOk: boolean } | { kind: 'unreadable' };
export function useLocalState<T>(key: string, initial: T, validate?: (o: any) => string | null): [T, (v: T | ((p: T) => T)) => void, { ready: boolean; message: string; corrupt?: StoreBlock; reset: () => void; resetFailed: boolean; persist: (nv: T) => boolean }] {
    const [corrupt, setCorrupt] = useState<StoreBlock | undefined>(undefined);
    const corruptRef = useRef<StoreBlock | undefined>(undefined);
    const [resetFailed, setResetFailed] = useState(false);
    const blocked = useRef(false); // 정지 상태에서는 주 저장 원본에 쓰지 않는다(감지 시 별도 사본 보관 쓰기만 예외)
    const [v, setV] = useState<T>(() => {
        let s: string | null = null;
        try { s = localStorage.getItem(key); } catch {
            blocked.current = true; // 읽기 불가: 원본을 알 수 없으니 어떤 쓰기도 않고 정지
            corruptRef.current = { kind: 'unreadable' };
            return initial;
        }
        if (s) {
            let o: any = null; let bad: string | null = null;
            try { o = JSON.parse(s); } catch { bad = 'JSON 문법 오류'; } // 문법이 깨진 저장도 같은 보존·정지 경로
            if (!bad && validate) bad = validate(o);
            if (bad) {
                blocked.current = true;
                let asideOk = false;
                try { localStorage.setItem(key + '.corrupt-' + Date.now(), s); asideOk = true; } catch { } // 보관 실패(용량 등)면 원본만 그대로 둔다
                corruptRef.current = { kind: 'corrupt', raw: s, asideOk };
                return initial; // 표시용 값일 뿐, reset 전에는 주 저장 원본에 저장하지 않는다
            }
            const m: any = { ...initial, ...o }; for (const k of Object.keys(initial as any)) { const iv = (initial as any)[k], ov = o[k]; if (iv && typeof iv === 'object' && !Array.isArray(iv) && ov && typeof ov === 'object' && !Array.isArray(ov)) m[k] = { ...iv, ...ov }; } return m;
        }
        return initial;
    });
    const ok = useRef(true); // effect 실패 즉시 반영은 아래 okState가 담당
    const [okState, setOkState] = useState(true); // 주 저장 쓰기 결과: 경고 재렌더 보장용
    useEffect(() => { if (corruptRef.current) setCorrupt(corruptRef.current); }, []);
    useEffect(() => { if (blocked.current) return; try { localStorage.setItem(key, JSON.stringify(v)); ok.current = true; setOkState(true); } catch { ok.current = false; setOkState(false); } }, [key, v]);
    // 주 저장을 즉시 쓰고 실제 성공 여부를 돌려준다(복원처럼 성공 안내 전에 영속화 확인이 필요한 경로용)
    const persist = (nv: T): boolean => {
        if (blocked.current) return false;
        try { localStorage.setItem(key, JSON.stringify(nv)); ok.current = true; setOkState(true); return true; } catch { ok.current = false; setOkState(false); return false; }
    };
    const reset = () => { // 사용자 명시 선택 후에만 원본을 지우고 초기 상태로
        try { localStorage.removeItem(key); if (localStorage.getItem(key) !== null) throw new Error('removal not applied'); }
        catch { setResetFailed(true); return; } // 삭제 실패: 새 게임으로 진행하지 않고 정지 상태를 유지한다(원본 보존)
        blocked.current = false; corruptRef.current = undefined; setCorrupt(undefined); setResetFailed(false); setV(initial);
    };
    return [v, setV, { ready: true, message: okState ? '' : '이 브라우저에서는 저장이 막혀 있다. 창을 닫으면 진행이 사라진다.', corrupt, reset, resetFailed, persist }];
}
