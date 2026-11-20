/**
 * Where throwables turn up: extra entries merged into the themed tables of data/loot.ts by table id (same shape as
 * LootTable.entries). Glass bottles and fuel are everyday junk; grenades and flares come from police and military kit.
 */
type E = { item: string; weight: number; count: [number, number] };
const e = (item: string, weight: number, lo = 1, hi = 1): E => ({ item, weight, count: [lo, hi] });

export const THROW_LOOT: Record<string, E[]> = {
  military_crate: [e('frag_grenade', 6, 1, 2), e('flare', 5, 1, 2)],
  military_footlocker: [e('frag_grenade', 3), e('flare', 4)],
  body_zombie_soldier: [e('frag_grenade', 3), e('flare', 2)],
  police_locker: [e('flare', 5, 1, 2), e('molotov', 1)],
  garage_shelf: [e('fuel_can', 6), e('flare', 3), e('glass_bottle', 5, 1, 3), e('molotov', 2)],
  car_trunk: [e('flare', 5), e('fuel_can', 3), e('glass_bottle', 3, 1, 2)],
  gas_station_shelf: [e('fuel_can', 6), e('flare', 3), e('glass_bottle', 6, 1, 3)],
  farm_barn: [e('fuel_can', 5), e('glass_bottle', 4, 1, 3), e('molotov', 2)],
  house_kitchen: [e('glass_bottle', 8, 1, 3)],
  camp_stash: [e('flare', 4), e('molotov', 2), e('glass_bottle', 3)],
  body_survivor: [e('molotov', 2), e('glass_bottle', 3), e('flare', 2)],
  tool_box: [e('fuel_can', 2)],
};
