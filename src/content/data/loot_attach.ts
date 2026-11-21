/**
 * Where attachments and extended magazines turn up: extra entries merged into the themed tables of data/loot.ts by table
 * id. Police kit carries red dots, suppressors and pistol mags; military crates the scopes and long mags; barns and camps
 * the hunting scope, the long shotgun tube and the rifle box magazine.
 */
type E = { item: string; weight: number; count: [number, number] };
const e = (item: string, weight: number, lo = 1, hi = 1): E => ({ item, weight, count: [lo, hi] });

export const ATTACH_LOOT: Record<string, E[]> = {
  police_locker: [e('red_dot', 3), e('suppressor', 1), e('mag_pistol_ext', 3), e('mag_smg_ext', 1), e('mag_shotgun_ext', 2)],
  military_crate: [e('red_dot', 4), e('scope_4x', 4), e('suppressor', 3), e('mag_rifle_ext', 5), e('mag_smg_ext', 3), e('mag_pistol_ext', 2), e('mag_shotgun_ext', 2), e('mag_bolt_ext', 2)],
  military_footlocker: [e('red_dot', 2), e('scope_4x', 2), e('mag_rifle_ext', 3), e('suppressor', 1)],
  body_zombie_soldier: [e('mag_rifle_ext', 2), e('red_dot', 1), e('suppressor', 1)],
  farm_barn: [e('scope_4x', 2), e('mag_bolt_ext', 1), e('mag_shotgun_ext', 1)],
  camp_stash: [e('scope_4x', 2), e('red_dot', 1), e('suppressor', 1), e('mag_bolt_ext', 1)],
  body_survivor: [e('mag_pistol_ext', 1), e('red_dot', 1)],
  car_trunk: [e('red_dot', 1), e('mag_rifle_ext', 1)],
};
