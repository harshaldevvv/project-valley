// Spike 2: bitECS vs Koota with our real archetype mix (principles §13).
// 5,000 static props (Position), 300 zombies (Position+Velocity+Health+AI), and churn:
// 20 short-lived entities (projectiles/decals) spawned + destroyed per tick.
// Each measured iteration = one sim tick. Run: npm run bench:ecs
import * as B from 'bitecs';
import { createWorld as kWorld, trait } from 'koota';

const PROPS = 5000;
const ZOMBIES = 300;
const CHURN = 20;
const DT = 1 / 60;

// ---------- bitECS: SoA typed arrays we own ----------
const CAP = 20000;
const bPos = { x: new Float32Array(CAP), y: new Float32Array(CAP), z: new Float32Array(CAP) };
const bVel = { x: new Float32Array(CAP), y: new Float32Array(CAP), z: new Float32Array(CAP) };
const bHp = { v: new Float32Array(CAP) };
const bAi = { state: new Uint8Array(CAP), timer: new Float32Array(CAP) };
const bProj = { life: new Float32Array(CAP) };
const bw = B.createWorld();
for (let i = 0; i < PROPS; i++) B.addComponent(bw, B.addEntity(bw), bPos);
for (let i = 0; i < ZOMBIES; i++) {
  const e = B.addEntity(bw);
  B.addComponents(bw, e, [bPos, bVel, bHp, bAi]);
  bVel.x[e] = 1;
  bHp.v[e] = 100;
}

function bitecsTick() {
  for (const e of B.query(bw, [bPos, bVel, bAi])) {
    bAi.timer[e] -= DT;
    if (bAi.timer[e] <= 0) {
      bAi.state[e] = (bAi.state[e] + 1) & 3;
      bAi.timer[e] = 0.5;
    }
    bPos.x[e] += bVel.x[e] * DT;
    bPos.y[e] += bVel.y[e] * DT;
    bPos.z[e] += bVel.z[e] * DT;
  }
  for (let i = 0; i < CHURN; i++) {
    const e = B.addEntity(bw);
    B.addComponents(bw, e, [bPos, bProj]);
    bProj.life[e] = 0;
  }
  for (const e of B.query(bw, [bProj])) B.removeEntity(bw, e);
}

// ---------- Koota: schema traits (SoA), fast path via useStores ----------
const KPos = trait({ x: 0, y: 0, z: 0 });
const KVel = trait({ x: 0, y: 0, z: 0 });
const KHp = trait({ v: 100 });
const KAi = trait({ state: 0, timer: 0 });
const KProj = trait({ life: 0 });
const kw = kWorld();
for (let i = 0; i < PROPS; i++) kw.spawn(KPos);
for (let i = 0; i < ZOMBIES; i++) kw.spawn(KPos, KVel({ x: 1, y: 0, z: 0 }), KHp, KAi);

function kootaTick() {
  kw.query(KPos, KVel, KAi).useStores(([p, v, ai], ents) => {
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i].id();
      ai.timer[e] -= DT;
      if (ai.timer[e] <= 0) {
        ai.state[e] = (ai.state[e] + 1) & 3;
        ai.timer[e] = 0.5;
      }
      p.x[e] += v.x[e] * DT;
      p.y[e] += v.y[e] * DT;
      p.z[e] += v.z[e] * DT;
    }
  });
  for (let i = 0; i < CHURN; i++) kw.spawn(KPos, KProj);
  kw.query(KProj).forEach((e) => e.destroy());
}

// Koota's ergonomic path, for reference (what most code would actually write).
function kootaEachTick() {
  kw.query(KPos, KVel, KAi).updateEach(([p, v, ai]) => {
    ai.timer -= DT;
    if (ai.timer <= 0) {
      ai.state = (ai.state + 1) & 3;
      ai.timer = 0.5;
    }
    p.x += v.x * DT;
    p.y += v.y * DT;
    p.z += v.z * DT;
  });
  for (let i = 0; i < CHURN; i++) kw.spawn(KPos, KProj);
  kw.query(KProj).forEach((e) => e.destroy());
}

function measure(name: string, tick: () => void) {
  for (let i = 0; i < 600; i++) tick(); // warm-up / JIT
  const rounds: number[] = [];
  for (let r = 0; r < 7; r++) {
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) tick();
    rounds.push(((performance.now() - t0) / 2000) * 1000);
  }
  rounds.sort((a, b) => a - b);
  console.log(`${name.padEnd(34)} ${rounds[3].toFixed(1).padStart(7)} us/tick (median of 7 x 2000 ticks; best ${rounds[0].toFixed(1)})`);
}

console.log(`sim tick: ${PROPS} props, ${ZOMBIES} zombies, ${CHURN} churn/tick`);
measure('bitECS (SoA typed arrays)', bitecsTick);
measure('Koota useStores (SoA fast path)', kootaTick);
measure('Koota updateEach (ergonomic)', kootaEachTick);
