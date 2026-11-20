// @ts-nocheck
// Kenney 3번 캐릭터(characterMedium) 3D 모델 불러오기, 달리기/대기 동작, CMU 모션캡처 킥 동작 연결.
import * as T from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SU from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as fflate from 'fflate';
import zipUrl from './models/chars.zip?url';
import homeUrl from './models/skin_home.png?url';
import awayUrl from './models/skin_away.png?url';
import gkUrl from './models/skin_gk.png?url';

export const KF = [64, 67, 70, 73, 75, 77, 80, 83, 86, 90];
export { T };
async function skinTex(url: string) {
    const bm = await createImageBitmap(await (await fetch(url)).blob());
    const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d')!.drawImage(bm, 0, 0);
    const t = new T.CanvasTexture(c); t.flipY = true; t.colorSpace = T.SRGBColorSpace; return t;
}
export interface Assets { base: any; run: any; idle: any; frames: any[]; tex: any[]; ground: number }
export async function loadAssets(): Promise<Assets> {
    const files = fflate.unzipSync(new Uint8Array(await (await fetch(zipUrl)).arrayBuffer()));
    const ab = (n: string) => files[n].buffer.slice(files[n].byteOffset, files[n].byteOffset + files[n].byteLength);
    const ld = new FBXLoader();
    const base = ld.parse(ab('characterMedium.fbx'), '');
    const run = ld.parse(ab('run.fbx'), '').animations.find((a: any) => a.name.includes('Run')) || ld.parse(ab('run.fbx'), '').animations[0];
    const idle = ld.parse(ab('idle.fbx'), '').animations.find((a: any) => a.name.includes('Idle')) || ld.parse(ab('idle.fbx'), '').animations[0];
    const data = JSON.parse(new TextDecoder().decode(files['k05.json']));
    const frames = data.frames.map((f: any) => { const o: any = {}; const rt = f.root; for (const k in f) o[k] = [f[k][0] - rt[0], f[k][1], f[k][2] - rt[2]]; return o; });
    const tex = await Promise.all([skinTex(homeUrl), skinTex(awayUrl), skinTex(gkUrl)]);
    const a: Assets = { base, run, idle, frames, tex, ground: 0 };
    // 킥 동작의 발이 땅에 닿는 높이 계산
    const r = new Rig(a, 0); let g = 1e9; for (const i of KF) { r.pose(frames[i]); g = Math.min(g, r.wp('LeftFoot').y, r.wp('RightFoot').y, r.wp('LeftToes').y, r.wp('RightToes').y); } a.ground = g;
    return a;
}
const V = (a: number[]) => new T.Vector3(a[0], a[1], a[2]);
const dirOf = (a: number[], b: number[]) => V(b).sub(V(a));
export class Rig {
    holder: any; model: any; B: any = {}; rest: any = {}; mixer: any; runA: any; idleA: any; hips0: any; sc: number; a: Assets; mode = 'mix';
    constructor(a: Assets, texIndex: number) {
        this.a = a; this.model = SU.clone(a.base);
        this.model.traverse((m: any) => { if (m.isMesh) { m.material = new T.MeshStandardMaterial({ map: a.tex[texIndex], roughness: 0.85 }); m.frustumCulled = false; } if (m.isBone) this.B[m.name] = m; });
        this.holder = new T.Group(); this.holder.add(this.model);
        if (!Rig.k) { const bb = new T.Box3().setFromObject(a.base, true); Rig.k = 1.75 / (bb.max.y - bb.min.y); }
        this.model.scale.multiplyScalar(Rig.k); this.model.updateMatrixWorld(true);
        for (const n in this.B) this.rest[n] = { q: this.B[n].quaternion.clone(), p: this.B[n].position.clone() };
        this.hips0 = this.wp('Hips');
        const legR = this.wp('LeftUpLeg').distanceTo(this.wp('LeftLeg')) + this.wp('LeftLeg').distanceTo(this.wp('LeftFoot'));
        const f0 = a.frames[0]; const legC = V(f0.lhip).distanceTo(V(f0.lknee)) + V(f0.lknee).distanceTo(V(f0.lankle)); this.sc = legR / legC;
        this.mixer = new T.AnimationMixer(this.model); this.runA = this.mixer.clipAction(a.run); this.idleA = this.mixer.clipAction(a.idle); this.runA.play(); this.idleA.play(); this.runA.weight = 0; this.idleA.weight = 1;
        this.mixer.update(Math.random());
    }
    static k: number;
    wp(n: string) { const v = new T.Vector3(); this.B[n].getWorldPosition(v); return v; }
    resetRest() { this.holder.rotation.y = 0; this.holder.position.set(0, 0, 0); this.model.position.set(0, 0, 0); for (const n in this.B) { this.B[n].quaternion.copy(this.rest[n].q); this.B[n].position.copy(this.rest[n].p); } this.model.updateMatrixWorld(true); }
    aim(name: string, child: string, dd: any) {
        const b = this.B[name]; b.updateWorldMatrix(true, true);
        const cur = this.wp(child).sub(this.wp(name)).normalize(); const D = new T.Quaternion().setFromUnitVectors(cur, dd.clone().normalize());
        const pw = new T.Quaternion(); b.parent.getWorldQuaternion(pw); b.quaternion.premultiply(pw.clone().invert().multiply(D).multiply(pw)); b.updateMatrixWorld(true);
    }
    pose(fr: any) {
        this.resetRest(); const F0 = this.a.frames[0];
        const latC = this.wp('RightUpLeg').sub(this.wp('LeftUpLeg')).normalize(); const upC = this.wp('Spine').sub(this.wp('Hips'));
        const latD = dirOf(fr.lhip, fr.rhip).normalize(); const upD = dirOf(fr.root, fr.lowerback);
        const bas = (lat: any, up: any) => { const l = lat.clone().normalize(); const u = up.clone().sub(l.clone().multiplyScalar(up.dot(l))).normalize(); const f = new T.Vector3().crossVectors(l, u); return new T.Matrix4().makeBasis(l, u, f); };
        const Bc = bas(latC, upC), Bd = bas(latD, upD); const Dq = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().multiplyMatrices(Bd, Bc.clone().transpose()));
        const hb = this.B.Hips; const pw = new T.Quaternion(); hb.parent.getWorldQuaternion(pw); hb.quaternion.premultiply(pw.clone().invert().multiply(Dq).multiply(pw)); hb.updateMatrixWorld(true);
        const delta = V(fr.root).sub(V(F0.root)).multiplyScalar(this.sc); const target = this.hips0.clone().add(delta);
        hb.position.copy(hb.parent.worldToLocal(target.clone())); this.model.updateMatrixWorld(true);
        const A = [['Spine', 'Chest', fr.root, fr.lowerback], ['Chest', 'UpperChest', fr.lowerback, fr.upperback], ['UpperChest', 'Neck', fr.upperback, fr.thorax], ['Neck', 'Head', fr.lowerneck, fr.upperneck],
            ['LeftUpLeg', 'LeftLeg', fr.lhip, fr.lknee], ['LeftLeg', 'LeftFoot', fr.lknee, fr.lankle], ['LeftFoot', 'LeftToes', fr.lankle, fr.lball],
            ['RightUpLeg', 'RightLeg', fr.rhip, fr.rknee], ['RightLeg', 'RightFoot', fr.rknee, fr.rankle], ['RightFoot', 'RightToes', fr.rankle, fr.rball],
            ['LeftShoulder', 'LeftArm', fr.thorax, fr.lsh], ['LeftArm', 'LeftForeArm', fr.lsh, fr.lelb], ['LeftForeArm', 'LeftHand', fr.lelb, fr.lwr],
            ['RightShoulder', 'RightArm', fr.thorax, fr.rsh], ['RightArm', 'RightForeArm', fr.rsh, fr.relb], ['RightForeArm', 'RightHand', fr.relb, fr.rwr]];
        for (const [b, c, a1, a2] of A) this.aim(b, c, dirOf(a1, a2));
    }
    /** x,z 위치, h 방향(rad), 달리기 속도, 킥 진행도(0~1 또는 -1) */
    update(dt: number, x: number, z: number, h: number, speed: number, kickP: number) {
        if (kickP >= 0) {
            const fi = KF[0] + (KF[KF.length - 1] - KF[0]) * Math.min(1, kickP); this.pose(this.a.frames[Math.round(fi)]); this.model.position.y = -this.a.ground; this.mode = 'kick';
        } else {
            if (this.mode === 'kick') { this.resetRest(); this.model.position.y = 0; this.mode = 'mix'; }
            const w = Math.min(1, speed / 2.2); this.runA.weight = w; this.idleA.weight = 1 - w; this.runA.timeScale = Math.max(0.5, speed / 4.8); this.mixer.update(dt);
        }
        this.holder.position.set(x, 0, z); this.holder.rotation.y = Math.PI / 2 - h;
        this.holder.updateMatrixWorld(true);
    }
}
