/**
 * The Gate Checkpoint trader (principles §9). Currency is the `cash` item. Prices come from item `value`:
 *   you pay   ceil(value x buyMargin)   (a markup over trader value)
 *   you get   floor(value x sellMargin) (a lot less), scaled by a weapon's durability
 * so every round trip loses money (a sink), and the trader only has `cashPerDay` to pay out before tomorrow (so selling
 * junk is not a faucet). Stock is rolled from loot tables once per in-game day; what you sell is added to the stock and
 * can be bought back at the buy price.
 */
export const TRADER = {
  npc: 'odell',
  buyMargin: 1.35,
  sellMargin: 0.4,
  /** Cash the trader can pay for what you sell, per in-game day (resets at the new day, never stacks up). */
  cashPerDay: 350,
  /** Loot tables the daily stock is rolled from, with how many times each is rolled. */
  stock: [
    { table: 'food_cupboard', rolls: 2 },
    { table: 'medical_cabinet', rolls: 2 },
    { table: 'tool_box', rolls: 2 },
    { table: 'garage_shelf', rolls: 1 },
    { table: 'camp_stash', rolls: 1 },
    { table: 'civilian_wardrobe', rolls: 1 },
    { table: 'military_crate', rolls: 1 },
    { table: 'police_locker', rolls: 1 },
  ],
  /** Rarity tier used when rolling stock (principles §9: 2 = a moderately stocked shop). */
  tier: 2,
  /** Items the trader never buys or sells (quest notes, cash itself, anything without value). */
  never: ['cash', 'secure_pouch'],
  neverPrefix: ['note_'],
  /** Stock list is capped (oldest bought-back items fall off first). */
  maxStock: 60,
  /** Sell prices below this are rounded up to it (a 1-cash floor so cheap things still sell). */
  minPrice: 1,
};
