import React, { useEffect, useRef, useState } from 'react';
export function FileCard({ children }: { children: React.ReactNode }) { return <main className="ui-card">{children}</main>; }
export function Header({ title, fact, intro }: { title: string; fact?: string; intro?: string }) { return <header><h1 className="ui-title">{title}</h1>{fact && <p className="ui-fact">{fact}</p>}{intro && <p className="ui-intro">{intro}</p>}</header>; }
export function Callout({ children }: { children: React.ReactNode }) { return <p className="ui-callout">{children}</p>; }
export function Closing({ children }: { children: React.ReactNode }) { return <p className="ui-closing">{children}</p>; }
export function Group({ label, children }: { label: string; heading?: boolean; children: React.ReactNode }) { return <section className="ui-group"><h2>{label}</h2>{children}</section>; }
export function Facts({ items }: { items: { label: string; value: string }[] }) { return <dl className="ui-facts">{items.map(i => <div key={i.label}><dt>{i.label}</dt><dd>{i.value}</dd></div>)}</dl>; }
// 이 브라우저(localStorage)에 저장한다. [값, 바꾸기, 저장됨 여부]
export function useLocalState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void, { ready: boolean; message: string }] {
    const [v, setV] = useState<T>(() => { try { const s = localStorage.getItem(key); if (s) { const o = JSON.parse(s); const m: any = { ...initial, ...o }; for (const k of Object.keys(initial as any)) { const iv = (initial as any)[k], ov = o[k]; if (iv && typeof iv === 'object' && !Array.isArray(iv) && ov && typeof ov === 'object' && !Array.isArray(ov)) m[k] = { ...iv, ...ov }; } return m; } } catch {} return initial; });
    const ok = useRef(true);
    useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); ok.current = true; } catch { ok.current = false; } }, [key, v]);
    return [v, setV, { ready: true, message: ok.current ? '' : '이 브라우저에서는 저장이 막혀 있다. 창을 닫으면 진행이 사라진다.' }];
}
