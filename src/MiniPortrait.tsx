// @ts-nocheck
// Kenney Mini Characters(4번, CC0, GLB) 3D 모델을 작은 화면에 돌려 보여준다. 육성 화면용.
import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SU from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as fflate from 'fflate';
import zipUrl from './models/mini.zip?url';
const ORIG = typeof location !== 'undefined' && location.search.includes('orig=1');
declare const __TEST_HOOKS__: boolean;
const PROT_ON = typeof __TEST_HOOKS__ !== 'undefined' && __TEST_HOOKS__;

export const LOOKS = ['male-a', 'male-c', 'male-e', 'female-a', 'female-c', 'female-e'];
let cache: Promise<any> | null = null;
function load() {
    if (!cache) cache = (async () => {
        const files = fflate.unzipSync(new Uint8Array(await (await fetch(zipUrl)).arrayBuffer()));
        const bm = await createImageBitmap(new Blob([files['colormap.png']], { type: 'image/png' }));
        const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d')!.drawImage(bm, 0, 0);
        if (!ORIG) { // 승격 목업의 빨간 유니폼에 맞춰 셔츠에 쓰인 보라, 초록 계열 색(채도 높은 것, 음영 유지)만 빨강으로 바꾼다. 피부, 머리, 바지는 그대로.
            const cx2 = c.getContext('2d')!; const id = cx2.getImageData(0, 0, c.width, c.height); const d = id.data;
            for (let i = 0; i < d.length; i += 4) {
                const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn; if (mx < 0.1 || df / mx < 0.38) continue;
                let h = mx === r ? ((g - b) / df) % 6 : mx === g ? (b - r) / df + 2 : (r - g) / df + 4; h *= 60; if (h < 0) h += 360;
                if ((h >= 250 && h <= 290) || (h >= 130 && h <= 175)) { const k = mx / 0.9; d[i] = Math.min(255, 207 * k * 0.95 + 20 * k); d[i + 1] = Math.min(255, 83 * k); d[i + 2] = Math.min(255, 79 * k); }
            }
            cx2.putImageData(id, 0, 0); }
        const tex = new T.CanvasTexture(c); tex.flipY = false; tex.colorSpace = T.SRGBColorSpace; tex.magFilter = T.NearestFilter;
        const ld = new GLTFLoader(); ld.manager.setURLModifier((u: string) => u.endsWith('colormap.png') ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' : u); const models: any = {};
        for (const n of LOOKS) { const f = files[n + '.glb']; models[n] = await ld.parseAsync(f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength), ''); }
        return { models, tex, base: c };
    })();
    return cache;
}

// 2, 3, 5, 6번 룩: 원래 직업복의 몸통, 소매에서 채도 높거나 밝은 면(파랑 셔츠, 흰 가운)만 빨간 셔츠로 바꾼다. 피부, 머리, 바지, 신발, 벨트처럼 어두운 면은 그대로. 단순 재색칠이라 축구복 완성은 아니다.
const KIT = [0, 1, 2, 3, 4, 5];
const RED = new T.MeshStandardMaterial({ color: 0xcf534f, roughness: 0.9 });
const key = (x: number[]) => x.map(v => Math.round(v * 40)).join(',');
function headTex(m: any, base: HTMLCanvasElement) { // 머리 메쉬가 쓰는 색(피부, 머리카락)
    const set = new Set<string>(); const W = base.width, H = base.height; const px = base.getContext('2d')!.getImageData(0, 0, W, H).data;
    m.traverse((o: any) => { if (o.isMesh && o.name === 'head-mesh') { const uv = o.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) { const k = (Math.min(W - 1, Math.max(0, Math.floor(uv.getX(i) * W))) + Math.min(H - 1, Math.max(0, Math.floor(uv.getY(i) * H))) * W) * 4; set.add(key([px[k] / 255, px[k + 1] / 255, px[k + 2] / 255])); } } });
    return set;
}
const SHORTS = new T.MeshStandardMaterial({ color: 0x1f2f55, roughness: 0.9 });
const HAIR = new T.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.9 });
function capToHair(o: any, base: HTMLCanvasElement) {
    const g = o.geometry; const uv = g.attributes.uv; const idx = g.index; if (!uv || !idx) return;
    const bx = base.getContext('2d')!; const W = base.width, H = base.height; const px = bx.getImageData(0, 0, W, H).data;
    const A: number[] = [], B: number[] = [];
    for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
        const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3, v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
        const k = (Math.min(W - 1, Math.max(0, Math.floor(u * W))) + Math.min(H - 1, Math.max(0, Math.floor(v * H))) * W) * 4;
        const r = px[k] / 255, gg = px[k + 1] / 255, bl = px[k + 2] / 255; const mx = Math.max(r, gg, bl), mn = Math.min(r, gg, bl);
        const blue = bl === mx && mx > 0.3 && (mx - mn) / mx > 0.35 && bl - r > 0.2;
        (blue ? B : A).push(a, b, c); }
    if (!B.length) return;
    const ng = g.clone(); ng.setIndex([...A, ...B]); ng.clearGroups(); ng.addGroup(0, A.length, 0); ng.addGroup(A.length, B.length, 1); o.geometry = ng; o.material = [o.material, HAIR];
}
function kitGroups(o: any, base: HTMLCanvasElement, headSet: Set<string>) {
    const g = o.geometry; const p = g.attributes.position, uv = g.attributes.uv; if (!uv) return; const idx = g.index; if (!idx) return;
    const bx = base.getContext('2d')!; const px = bx.getImageData(0, 0, base.width, base.height).data; const W = base.width, H = base.height;
    let y0 = 1e9, y1 = -1e9; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const hh = y1 - y0;
    const col = (a: number, b: number, c: number) => { const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3, v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3; const k = (Math.min(W - 1, Math.max(0, Math.floor(u * W))) + Math.min(H - 1, Math.max(0, Math.floor(v * H))) * W) * 4; return [px[k] / 255, px[k + 1] / 255, px[k + 2] / 255]; };
    // 이 룩의 피부색: 머리 메쉬가 쓰는 색 중 피부 계열의 평균. 없으면 기본 피부색.
    let sr = 0, sg = 0, sb = 0, sn = 0; const skc: number[][] = [];
    for (const k of headSet) { const [rr, gg, bb] = k.split(',').map((v: string) => Number(v) / 40); const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb), df = mx - mn, sat = mx ? df / mx : 0; let hu = df ? (mx === rr ? ((gg - bb) / df + 6) % 6 : mx === gg ? (bb - rr) / df + 2 : (rr - gg) / df + 4) * 60 : 0; if (hu >= 5 && hu <= 50 && sat >= 0.15 && sat < 0.7 && mx > 0.35) { skc.push([rr, gg, bb]); } }
    if (skc.length) { skc.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2])); const m = skc[Math.floor((skc.length - 1) * 0.8)]; sr = m[0]; sg = m[1]; sb = m[2]; sn = 1; } else { sr = 0.85; sg = 0.6; sb = 0.45; }
    const SKINM = new T.MeshStandardMaterial({ color: new T.Color().setRGB(sr, sg, sb, T.SRGBColorSpace), roughness: 0.9 });
    // 팔 뼈 위치(장갑·긴소매 룩의 손을 뼈 가중치와 거리로 찾는다)
    const si = g.attributes.skinIndex, swt = g.attributes.skinWeight;
    let armPos: any = null;
    if (si && swt && o.skeleton) { armPos = {}; for (const bn of o.skeleton.bones) if (bn.name === 'arm-left' || bn.name === 'arm-right') armPos[bn.name] = bn.position; }
    const domBone = (a: number, b: number, c: number) => { if (!si || !swt || !o.skeleton) return ''; const w: any = {}; for (const v of [a, b, c]) for (let j = 0; j < 4; j++) { const ji = j === 0 ? si.getX(v) : j === 1 ? si.getY(v) : j === 2 ? si.getZ(v) : si.getW(v); const wv = j === 0 ? swt.getX(v) : j === 1 ? swt.getY(v) : j === 2 ? swt.getZ(v) : swt.getW(v); w[ji] = (w[ji] || 0) + wv; } let bi = -1, bw = -1; for (const k2 of Object.keys(w)) if (w[k2] > bw) { bw = w[k2]; bi = Number(k2); } return bi >= 0 ? o.skeleton.bones[bi].name : ''; };
    const tris: any[] = [];
    for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2); const y = ((p.getY(a) + p.getY(b) + p.getY(c)) / 3 - y0) / hh; const cl = col(a, b, c); const db = domBone(a, b, c); let d = -1; if (armPos && (db === 'arm-left' || db === 'arm-right')) { const ap = armPos[db]; d = Math.hypot((p.getX(a) + p.getX(b) + p.getX(c)) / 3 - ap.x, (p.getY(a) + p.getY(b) + p.getY(c)) / 3 - ap.y, (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3 - ap.z); } tris.push({ a, b, c, y, cl, db, d }); }
    // 손 구간: 이 룩의 팔 삼각형 중 피부색이 닿는 가장 먼 거리에 맞춘다(소매 길이가 룩마다 달라서). 피부색이 하나도 없는 장갑 룩(3, 6)은 고정 구간.
    let dskin = 0;
    for (const t of tris) { if (t.d < 0) continue; const [r, gg, bl] = t.cl; const mx = Math.max(r, gg, bl), mn = Math.min(r, gg, bl), df = mx - mn, sat = mx ? df / mx : 0; let hu = df ? (mx === r ? ((gg - bl) / df + 6) % 6 : mx === gg ? (bl - r) / df + 2 : (r - gg) / df + 4) * 60 : 0; if (hu >= 5 && hu <= 45 && sat >= 0.15 && sat < 0.7 && mx > 0.35 && r > bl && t.d > dskin) dskin = t.d; }
    const armCount = tris.filter((t: any) => t.d >= 0).length;
    const puffy = armCount > 250; // female-a처럼 부푼 소매는 소매와 손이 뒤섞여 팔 전체를 피부로(민소매)
    const handLo = puffy ? -1 : dskin ? Math.max(0.20, dskin - 0.10) : 0.28;
    const A: number[] = [], B: number[] = [], C: number[] = [], D: number[] = [];
    for (const t of tris) { const [r, gg, bl] = t.cl; const mx = Math.max(r, gg, bl), mn = Math.min(r, gg, bl); const sat = mx ? (mx - mn) / mx : 0; const df = mx - mn; let hu = df ? (mx === r ? ((gg - bl) / df + 6) % 6 : mx === gg ? (bl - r) / df + 2 : (r - gg) / df + 4) * 60 : 0;
        // 팔 뼈가 짊어진 삼각형: 팔 관절에서 먼 끝(손)은 룩의 피부색으로, 손보다 더 나간 긴 소매 자락(female-a)은 셔츠색으로. 장갑이 원래 디자인인 룩 3, 6도 손이 피부가 된다.
        if (t.d >= 0) {
            if (puffy) { // 부푼 소매: 거리 대신 원본 색으로 손(피부색·어두운 장갑)과 소매(그 외 색)를 가른다. 모델·텍스처는 그대로, 색 배정만 변경.
                const skinT = hu >= 5 && hu <= 45 && sat >= 0.15 && sat < 0.7 && mx > 0.35 && r > bl;
                (skinT ? D : mx < 0.35 ? A : B).push(t.a, t.b, t.c); continue;
            }
            if (t.d >= handLo) { D.push(t.a, t.b, t.c); continue; }
            if (t.d >= 0.18 && mx < 0.35) { D.push(t.a, t.b, t.c); continue; } // 손목 아래 어두운 장갑 조각도 손으로
        }
        const isSkin = (headSet.has(key(t.cl)) && hu >= 5 && hu <= 50 && sat < 0.68) || (t.y < 0.62 && Math.abs(p.getX(t.a) + p.getX(t.b) + p.getX(t.c)) / 3 > 0.12 && hu >= 14 && hu <= 30 && sat < 0.64 && mx > 0.6);
        const shirt = t.y > 0.4 && !isSkin && ((sat > 0.25 || mx > 0.8) && mx > 0.25 || t.y > 0.46 && mx > 0.05); const pants = !shirt && !isSkin && t.y > 0.14 && t.y <= 0.4; (shirt ? B : pants ? C : A).push(t.a, t.b, t.c); }
    if (!B.length) return;
    const ng = g.clone(); ng.setIndex([...A, ...B, ...C, ...D]); ng.clearGroups(); ng.addGroup(0, A.length, 0); ng.addGroup(A.length, B.length, 1); let off = A.length + B.length; if (C.length) { ng.addGroup(off, C.length, 2); off += C.length; } if (D.length) ng.addGroup(off, D.length, 3); o.geometry = ng; o.material = [o.material, RED, SHORTS, SKINM];
}
export function MiniPortrait({ look, size = 160 }: { look: number; size?: number }) {
    const ref = useRef<HTMLCanvasElement>(null); const [err, setErr] = useState('');
    useEffect(() => {
        let dead = false, raf = 0; const cv = ref.current!;
        let r: any;
        try { r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e: any) { setErr(String(e && e.message || e)); return; } // WebGL 불가 기기에서는 빈칸 대신 안내 문구를 보여 준다
        r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(size, size * 1.25, false);
        const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xffffff, 0x998877, 2.2)); const dl = new T.DirectionalLight(0xffffff, 1.4); dl.position.set(2, 4, 3); sc.add(dl);
        const cam = new T.PerspectiveCamera(30, 1 / 1.25, 0.1, 50);
        load().then(({ models, tex, base }) => {
            if (dead) return; const src = models[LOOKS[look]]; const m = SU.clone(src.scene);
            if (look === 3) { const dn = models['female-e'].scene.getObjectByName('body-mesh') as any; if (dn) m.traverse((o: any) => { if (o.isMesh && o.name === 'body-mesh') o.geometry = dn.geometry; }); } // 4번 룩: 부푼 소매·막대 팔의 female-a 몸통을 같은 스켈레톤의 female-e 몸통으로 교체(얼굴·머리·애니메이션은 female-a 유지)
            m.traverse((o: any) => { if (o.isMesh) { const TH = 0.45; // female-a 팔 바깥 가는 막대(폭 0.45 초과)만 숨김, 원래 외형은 유지
 if (o.name === 'body-mesh') { const g = o.geometry.clone(); const px = g.attributes.position; const idx = g.index!; const keep: number[] = []; for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2); if (Math.max(Math.abs(px.getX(a)), Math.abs(px.getX(b)), Math.abs(px.getX(c))) <= TH) keep.push(a, b, c); } g.setIndex(keep); o.geometry = g; } o.frustumCulled = false; o.material = new T.MeshStandardMaterial({ map: tex, roughness: 0.9 }); if (look === 1 && o.name === 'head-mesh') capToHair(o, base); if (!ORIG && KIT.includes(look) && o.name === 'body-mesh') kitGroups(o, base, headTex(m, base)); } });
            const bb = new T.Box3().setFromObject(m, true); const h = bb.max.y - bb.min.y; const k = 1.8 / h; m.scale.multiplyScalar(k); m.updateMatrixWorld(true);
            const bb2 = new T.Box3().setFromObject(m, true); m.position.y -= bb2.min.y; m.position.x -= (bb2.min.x + bb2.max.x) / 2; sc.add(m);
            cam.position.set(0, 1.0, 5.2); cam.lookAt(0, 0.9, 0);
            const clip = (src.animations || []).find((a: any) => a.name === 'idle'); const mixer = new T.AnimationMixer(m); if (clip) mixer.clipAction(clip).play(); mixer.update(0.01); let last = performance.now();
            const t0 = performance.now(); const tick = () => { if (dead) return; const nw = performance.now(); mixer.update((nw - last) / 1000); last = nw; m.rotation.y = 0.25 + Math.sin((performance.now() - t0) / 1100) * 0.3;
                if (PROT_ON) { const pv = parseFloat(new URLSearchParams(location.search).get('prot') || 'NaN'); if (pv === pv) m.rotation.y = pv; } r.render(sc, cam); raf = requestAnimationFrame(tick); }; tick();
        }).catch((e: any) => { cache = null; setErr(String(e && e.message || e)); });
        return () => { dead = true; cancelAnimationFrame(raf); r.dispose(); };
    }, [look, size]);
    if (err) return <p className="rs-hint">캐릭터 미리보기를 불러오지 못했다: {err}</p>;
    return <canvas ref={ref} className="rs-portrait" style={{ width: size, height: size * 1.25 }} />;
}
