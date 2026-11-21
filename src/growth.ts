import type { Pos, Stats } from './engine';
export const clampG = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const POS: { id: Pos; name: string; base: Stats; key: (keyof Stats)[] }[] = [
    { id: 'FW', name: '공격수', base: { shoot: 58, pass: 50, dribble: 54, defense: 42, speed: 52 }, key: ['shoot', 'dribble', 'speed'] },
    { id: 'MF', name: '미드필더', base: { shoot: 48, pass: 58, dribble: 54, defense: 50, speed: 50 }, key: ['pass', 'dribble', 'defense'] },
    { id: 'DF', name: '수비수', base: { shoot: 40, pass: 50, dribble: 46, defense: 60, speed: 52 }, key: ['defense', 'speed', 'pass'] },
];
export const avgKeyOf = (s: Stats, pos: Pos) => { const k = (POS.find(p => p.id === pos) || POS[0]).key; return k.reduce((a, c) => a + s[c], 0) / k.length; };
export const abilityScore = (s: Stats, pos: Pos) => Math.round(clampG((avgKeyOf(s, pos) - 45) / 25, 0, 1) * 40);
export const perfScore = (ratings: number[]) => { const avgR = ratings.reduce((a, c) => a + c, 0) / Math.max(1, ratings.length); return Math.round(clampG((avgR - 5) / 3, 0, 1) * 35); };
export const trustScore = (trust: number) => Math.round(trust / 100 * 25);
export const trustDelta = (rating: number) => Math.round((rating - 6.5) * 6 + 2);
export const needFor = (season: number, seasons: number) => season >= seasons ? 65 : 80;
