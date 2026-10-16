import { difficulty } from '../content/data/difficulty';
import { SURVIVAL, WOUNDS, ZOMBIE_HIT } from '../content/data/survival';
import type { ItemDef } from '../content/data/types';
import type { StatusId, SurvivalApi } from '../core/contracts';
import type { Rng } from '../engine/rng';

/**
 * Survival needs + status effects (principles §7). Pure: the world is reached through `SurvivalHost`
 * (player HP, night, status events), so this runs in tests and serializes as plain data.
 */
export interface SurvivalHost {
  maxHp(): number;
  hurt(amount: number, cause: string): void;
  heal(amount: number): void;
  isNight(): boolean;
  statusChanged(id: StatusId, active: boolean, stage?: number): void;
}

interface StatusState {
  stage?: number;
  timeLeft: number | null;
  /** Seconds to the next damage tick (bleeds) / stage advance (infection). */
  tick: number;
}

export interface SurvivalSave {
  hunger: number;
  thirst: number;
  fatigue: number;
  /** Real seconds played (game-day clock for infection and death bags until the engine runs time). */
  clock: number;
  statuses: [StatusId, StatusState][];
}

const DERIVED: StatusId[] = ['well_fed', 'starving', 'dehydrated', 'exhausted'];

export class Survival implements SurvivalApi {
  hunger = 100;
  thirst = 100;
  fatigue = 100;
  clock = 0;
  private map = new Map<StatusId, StatusState>();
  private starveT = 0;
  private thirstT = 0;
  private infectT = 0;

  constructor(private rng: Rng, private host: SurvivalHost) {}

  get statuses(): ReadonlyMap<StatusId, { stage?: number; timeLeft: number | null }> {
    return this.map;
  }

  get gameDay() {
    return Math.floor(this.clock / SURVIVAL.gameDaySeconds) + 1;
  }

  get mods() {
    let moveSpeed = 1;
    let staminaRegen = 1;
    let staminaCost = 1;
    let aimSway = 1;
    let sprintAllowed = true;
    if (this.map.has('well_fed')) staminaRegen *= SURVIVAL.wellFedStaminaRegen;
    if (this.hunger < SURVIVAL.lowBelow || this.thirst < SURVIVAL.lowBelow) (staminaRegen *= SURVIVAL.lowStaminaMul), (staminaCost /= SURVIVAL.lowStaminaMul);
    if (this.map.has('exhausted')) aimSway *= SURVIVAL.exhaustedAimSway;
    if (this.map.has('fracture')) (moveSpeed *= WOUNDS.fracture.moveSpeed), (sprintAllowed = false);
    const inf = this.map.get('infection');
    if (inf) {
      const st = WOUNDS.infection.stages[(inf.stage ?? 1) - 1];
      staminaRegen *= st.staminaRegen;
      aimSway *= st.aimSway;
      moveSpeed *= st.moveSpeed;
    }
    return { moveSpeed, sprintAllowed, staminaRegen, staminaCost, aimSway };
  }

  private range([a, b]: [number, number]) {
    return this.rng.range(a, b);
  }

  addStatus(id: StatusId, opts: { stage?: number; seconds?: number } = {}) {
    if (id === 'infection' && !difficulty.infection) return;
    const had = this.map.get(id);
    let s: StatusState;
    if (id === 'bleeding' || id === 'heavy_bleeding') {
      if (id === 'bleeding' && this.map.has('heavy_bleeding')) return; // heavy already covers it
      const w = WOUNDS[id];
      s = { timeLeft: opts.seconds ?? this.range(w.seconds), tick: this.range(w.every) };
      if (id === 'heavy_bleeding') this.drop('bleeding');
    } else if (id === 'fracture') s = { timeLeft: opts.seconds ?? WOUNDS.fracture.healSeconds, tick: 0 };
    else if (id === 'infection') {
      if (had) return; // a new bite doesn't restart it
      s = { stage: opts.stage ?? 1, timeLeft: null, tick: this.stageSeconds() };
    } else s = { timeLeft: opts.seconds ?? null, tick: 0, stage: opts.stage };
    this.map.set(id, s);
    if (!had) this.host.statusChanged(id, true, s.stage);
  }

  private stageSeconds() {
    return (WOUNDS.infection.totalGameDays * SURVIVAL.gameDaySeconds) / WOUNDS.infection.stages.length;
  }

  private drop(id: StatusId) {
    if (this.map.delete(id)) this.host.statusChanged(id, false);
  }

  cure(id: StatusId) {
    this.drop(id);
  }

  onZombieHit(info: { damage: number; zone: 'head' | 'body' | 'limb'; armour: number }) {
    if (this.rng.next() < ZOMBIE_HIT.bleedChance[info.zone]) this.addStatus(info.damage >= ZOMBIE_HIT.heavyBleedDamage ? 'heavy_bleeding' : 'bleeding');
    if (this.rng.next() < ZOMBIE_HIT.fractureChance[info.zone]) this.addStatus('fracture');
    if (info.armour < WOUNDS.infection.armourImmune && this.rng.next() < WOUNDS.infection.chance) this.addStatus('infection');
  }

  /** Unrecovered death bags; replaced by installSurvival once the bag system exists. */
  deathBags(): { id: string; x: number; y: number; z: number }[] {
    return [];
  }

  adjust(d: { hunger?: number; thirst?: number; fatigue?: number }) {
    const c = (v: number) => Math.min(100, Math.max(0, v));
    if (d.hunger) this.hunger = c(this.hunger + d.hunger);
    if (d.thirst) this.thirst = c(this.thirst + d.thirst);
    if (d.fatigue) this.fatigue = c(this.fatigue + d.fatigue);
  }

  /** Apply a consumable's effects (called when its use timer completes). */
  applyUse(use: NonNullable<ItemDef['use']>) {
    this.adjust({ hunger: use.food, thirst: use.water });
    if (use.heal) this.host.heal(use.heal);
    for (const id of (use.cures ?? []) as StatusId[]) {
      const s = this.map.get(id);
      if (!s) continue;
      if (id === 'infection' && use.infectionMaxStage !== undefined && (s.stage ?? 1) > use.infectionMaxStage) continue;
      this.drop(id);
    }
  }

  step(dt: number) {
    this.clock += dt;
    const k = SURVIVAL.debugDrainMul;
    this.adjust({
      hunger: (-100 / (SURVIVAL.hungerMinutes * 60)) * dt * difficulty.hungerDrain * k,
      thirst: (-100 / (SURVIVAL.thirstMinutes * 60)) * dt * difficulty.thirstDrain * k,
      fatigue: (this.host.isNight() ? -SURVIVAL.fatigueNightPerMin * difficulty.fatigueDrain * k : SURVIVAL.fatigueDayRecoverPerMin) * (dt / 60),
    });

    // Empty needs hurt slowly (never instantly).
    if (difficulty.starvationDamage && this.hunger <= 0) {
      if ((this.starveT += dt) >= SURVIVAL.starveEvery) (this.starveT = 0), this.host.hurt(SURVIVAL.starveDamage, 'starvation');
    } else this.starveT = 0;
    if (difficulty.starvationDamage && this.thirst <= 0) {
      if ((this.thirstT += dt) >= SURVIVAL.dehydrateEvery) (this.thirstT = 0), this.host.hurt(SURVIVAL.dehydrateDamage, 'dehydration');
    } else this.thirstT = 0;

    for (const [id, s] of [...this.map]) {
      if (id === 'bleeding' || id === 'heavy_bleeding') {
        const w = WOUNDS[id];
        if ((s.tick -= dt) <= 0) {
          s.tick = this.range(w.every);
          this.host.hurt((this.range(w.pct) / 100) * this.host.maxHp(), id);
        }
      } else if (id === 'infection') {
        const st = WOUNDS.infection.stages[(s.stage ?? 1) - 1];
        if (st.hpPerMin > 0 && (this.infectT += dt) >= 60 / st.hpPerMin) (this.infectT = 0), this.host.hurt(1, 'infection');
        if ((s.tick -= dt) <= 0 && (s.stage ?? 1) < WOUNDS.infection.stages.length) {
          s.stage = (s.stage ?? 1) + 1;
          s.tick = this.stageSeconds();
          this.host.statusChanged(id, true, s.stage);
        }
      }
      if (s.timeLeft !== null && (s.timeLeft -= dt) <= 0 && !DERIVED.includes(id)) this.drop(id);
    }

    this.derive('well_fed', this.hunger > SURVIVAL.wellFedAbove && this.thirst > SURVIVAL.wellFedAbove);
    this.derive('starving', this.hunger <= 0);
    this.derive('dehydrated', this.thirst <= 0);
    this.derive('exhausted', this.fatigue < SURVIVAL.exhaustedBelow);
  }

  private derive(id: StatusId, on: boolean) {
    if (on && !this.map.has(id)) this.addStatus(id);
    else if (!on && this.map.has(id)) this.drop(id);
  }

  /** Respawn: needs refill to a safe level, wounds clear (infection stays: it is in the blood). */
  respawn() {
    this.hunger = Math.max(this.hunger, 50);
    this.thirst = Math.max(this.thirst, 50);
    for (const id of ['bleeding', 'heavy_bleeding', 'fracture'] as StatusId[]) this.drop(id);
  }

  serialize(): SurvivalSave {
    return structuredClone({ hunger: this.hunger, thirst: this.thirst, fatigue: this.fatigue, clock: this.clock, statuses: [...this.map] });
  }

  load(s: SurvivalSave) {
    for (const id of [...this.map.keys()]) this.drop(id);
    Object.assign(this, { hunger: s.hunger, thirst: s.thirst, fatigue: s.fatigue, clock: s.clock });
    for (const [id, st] of s.statuses) {
      this.map.set(id, { ...st });
      this.host.statusChanged(id, true, st.stage);
    }
  }
}
