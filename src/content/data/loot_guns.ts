/**
 * Where the M4 guns turn up: extra entries merged into the themed tables of data/loot.ts by table id (same shape as
 * LootTable.entries; weights compare with the entries already in each table). Magazines spawn partly filled.
 * Themes: police lockers and house closets hold the pistol-calibre guns, barns and camps the hunting guns, military the SMG.
 */
type E = { item: string; weight: number; count: [number, number] };
const e = (item: string, weight: number, lo = 1, hi = 1): E => ({ item, weight, count: [lo, hi] });

export const GUN_LOOT: Record<string, E[]> = {
  police_locker: [e('revolver_a', 2), e('mag_revolver_a', 4), e('ammo_357', 8, 6, 18), e('shotgun_a', 3), e('mag_shotgun_a', 5), e('ammo_12ga', 8, 4, 12), e('smg_a', 1), e('mag_smg_a', 3)],
  house_bedroom: [e('revolver_a', 1), e('ammo_357', 3, 6, 12), e('shotgun_a', 1), e('ammo_12ga', 3, 4, 10)],
  car_trunk: [e('revolver_a', 1), e('ammo_357', 2, 6, 12), e('ammo_12ga', 2, 4, 10)],
  body_survivor: [e('revolver_a', 1), e('mag_revolver_a', 2), e('ammo_357', 3, 6, 12), e('mag_shotgun_a', 2)],
  farm_barn: [e('shotgun_a', 4), e('mag_shotgun_a', 6), e('ammo_12ga', 10, 4, 16), e('bolt_a', 3), e('mag_bolt_a', 5), e('ammo_308', 8, 5, 15)],
  camp_stash: [e('bolt_a', 3), e('mag_bolt_a', 5), e('ammo_308', 8, 5, 15), e('revolver_a', 2), e('ammo_357', 6, 6, 18), e('shotgun_a', 2), e('ammo_12ga', 6, 4, 12)],
  garage_shelf: [e('ammo_12ga', 3, 4, 8), e('ammo_357', 2, 6, 12)],
  military_crate: [e('smg_a', 4), e('mag_smg_a', 8), e('shotgun_a', 3), e('mag_shotgun_a', 5), e('ammo_12ga', 8, 6, 18), e('bolt_a', 2), e('mag_bolt_a', 4), e('ammo_308', 8, 5, 20)],
  military_footlocker: [e('mag_smg_a', 3), e('ammo_12ga', 3, 4, 10), e('ammo_308', 3, 5, 10)],
  body_zombie_soldier: [e('mag_smg_a', 3), e('mag_shotgun_a', 2)],
};
