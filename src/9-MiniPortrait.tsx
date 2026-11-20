// @ts-nocheck
// Kenney Mini Characters(4번, CC0) 3D 모델을 작은 화면에 돌려 보여준다. 육성 화면용.
import { useEffect, useRef, useState } from 'react';
import * as T from './vendor/three.module.js';
import { FBXLoader } from './vendor/FBXLoader.js';
import * as SU from './vendor/SkeletonUtils.js';
import * as fflate from './vendor/fflate.module.js';
import zipUrl from './models/mini.zip?url';

export const LOOKS = ['male-a', 'male-c', 'male-e', 'female-a', 'female-c', 'female-e'];
let cache: Promise<any> | null = null;
function load() {
    if (!cache) cache = (async () => {
        const files = fflate.unzipSync(new Uint8Array(await (await fetch(zipUrl)).arrayBuffer()));
        const bm = await createImageBitmap(new Blob([files['colormap.png']], { type: 'image/png' }));
        const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d')!.drawImage(bm, 0, 0);
        const tex = new T.CanvasTexture(c); tex.flipY = true; tex.colorSpace = T.SRGBColorSpace; tex.magFilter = T.NearestFilter;
        const ld = new FBXLoader(); const models: any = {};
        for (const n of LOOKS) { const f = files[n + '.fbx']; models[n] = ld.parse(f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength), ''); }
        return { tex, models };
    })();
    return cache;
}
export function MiniPortrait({ look, size = 160 }: { look: number; size?: number }) {
    const ref = useRef<HTMLCanvasElement>(null); const [err, setErr] = useState('');
    useEffect(() => {
        let dead = false, raf = 0; const cv = ref.current!;
        const r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(size, size * 1.25, false);
        const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xffffff, 0x998877, 2.2)); const dl = new T.DirectionalLight(0xffffff, 1.4); dl.position.set(2, 4, 3); sc.add(dl);
        const cam = new T.PerspectiveCamera(30, 1 / 1.25, 0.1, 50);
        load().then(({ tex, models }) => {
            if (dead) return; const m = SU.clone(models[LOOKS[look]]);
            m.traverse((o: any) => { if (o.isMesh) { o.material = new T.MeshStandardMaterial({ map: tex, roughness: 0.9 }); o.frustumCulled = false; } });
            const bb = new T.Box3().setFromObject(m, true); const h = bb.max.y - bb.min.y; const k = 1.8 / h; m.scale.multiplyScalar(k); m.updateMatrixWorld(true);
            const bb2 = new T.Box3().setFromObject(m, true); m.position.y -= bb2.min.y; m.position.x -= (bb2.min.x + bb2.max.x) / 2; sc.add(m);
            cam.position.set(0, 1.0, 5.2); cam.lookAt(0, 0.9, 0);
            const t0 = performance.now(); const tick = () => { if (dead) return; m.rotation.y = 0.5 + Math.sin((performance.now() - t0) / 900) * 0.6; r.render(sc, cam); raf = requestAnimationFrame(tick); }; tick();
        }).catch((e: any) => { cache = null; setErr(String(e && e.message || e)); });
        return () => { dead = true; cancelAnimationFrame(raf); r.dispose(); };
    }, [look, size]);
    if (err) return <p className="rs-hint">캐릭터 미리보기를 불러오지 못했다: {err}</p>;
    return <canvas ref={ref} className="rs-portrait" style={{ width: size, height: size * 1.25 }} />;
}
