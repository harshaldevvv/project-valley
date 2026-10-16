/** Player-facing item text, keyed by item id. `short` is the grid-tile label (max 8 chars). */
export const itemText: Record<string, { name: string; short: string; description: string }> = {
  pistol_a: {
    name: '9 mm Service Pistol',
    short: 'Pistol',
    description: 'Standard sidearm, county sheriff issue. Still has the evidence tag on the trigger guard.',
  },
  rifle_a: {
    name: 'AK-Pattern Rifle',
    short: 'AK',
    description: 'Loud, heavy, forgiving. It will keep firing long after you stop cleaning it.',
  },
  mag_pistol_a: {
    name: '9 mm Magazine (15)',
    short: 'Mag 9',
    description: 'Fifteen-round pistol magazine. Someone scratched a tally into the base plate and stopped at 31.',
  },
  mag_rifle_a: {
    name: '7.62 Magazine (30)',
    short: 'Mag 7.62',
    description: 'Thirty-round steel magazine. Dented, but the spring still argues back.',
  },
  ammo_9mm: {
    name: '9 mm Rounds',
    short: '9mm',
    description: 'Loose pistol ammunition. The closest thing the valley has to money.',
  },
  ammo_762: {
    name: '7.62x39 Rounds',
    short: '7.62',
    description: 'Rifle ammunition, mixed headstamps. Every shot tells someone where you are.',
  },
  knife_a: {
    name: 'Fixed-Blade Knife',
    short: 'Knife',
    description: 'Quiet, never jams, needs you uncomfortably close.',
  },
  bandage: {
    name: 'Bandage',
    short: 'Bandage',
    description: 'Sterile, still sealed. Stops bleeding, not bad decisions.',
  },
  canned_beans: {
    name: 'Canned Beans',
    short: 'Beans',
    description: 'Best before three summers ago. The can has not been told.',
  },
  water_bottle: {
    name: 'Bottle of Water',
    short: 'Water',
    description: 'Clear plastic, clear water. Rarer than it should be in a valley with a river.',
  },
  wood_planks: {
    name: 'Wood Planks',
    short: 'Planks',
    description: 'Pulled off a fence that no longer has anything to keep in.',
  },
  nails: {
    name: 'Box of Nails',
    short: 'Nails',
    description: 'Half full and rattling. Turns planks into a wall.',
  },
  scrap_metal: {
    name: 'Scrap Metal',
    short: 'Scrap',
    description: 'Car door, road sign, shelf. Ugly, heavy, and better than wood.',
  },
  backpack_small: {
    name: 'Small Backpack',
    short: 'Pack',
    description: 'School daypack, a name written inside the flap. More room, same shoulders.',
  },
  jacket_field: {
    name: 'Field Jacket',
    short: 'Jacket',
    description: 'Surplus olive drab with deep pockets. The name tape has been cut off.',
  },
  cloth_rag: {
    name: 'Cloth Rag',
    short: 'Rag',
    description: 'Half a flannel shirt. Bandage in a pinch, gun rag the rest of the time.',
  },
  medkit: {
    name: 'Field Medkit',
    short: 'Medkit',
    description: 'Gauze, clotting powder, a suture kit nobody here knows how to use. Puts a lot of you back together.',
  },
  splint: {
    name: 'Splint',
    short: 'Splint',
    description: 'Two slats and a roll of tape. Walks a broken leg home.',
  },
  antibiotics: {
    name: 'Antibiotics',
    short: 'Antibio',
    description: 'Half a blister pack, expired last spring. Works on an early infection, if you catch it early.',
  },
  antiviral: {
    name: 'Antiviral',
    short: 'Antivir',
    description: 'A sealed autoinjector with a lab barcode. The only thing anyone has seen stop a late bite.',
  },
  energy_bar: {
    name: 'Energy Bar',
    short: 'Bar',
    description: 'Chocolate-ish. Two hundred calories of optimism.',
  },
  secure_pouch: {
    name: 'Secure Pouch',
    short: 'Pouch',
    description: 'A small zipped pouch strapped under the jacket. Whatever is in it stays with you.',
  },
  lockpick: {
    name: 'Lockpick',
    short: 'Pick',
    description: 'A bent tension wrench and a filed-down hair pin. Patience sold separately.',
  },
  repair_kit: {
    name: 'Repair Kit',
    short: 'Repair',
    description: 'Hose clamps, wire, a roll of tape and a wrench that fits nothing exactly. Enough to keep a truck limping.',
  },
  crowbar_a: {
    name: "Crowbar",
    short: "Crowbar",
    description: "A yard of hooked steel. Opens doors, crates and arguments.",
  },
  hammer_a: {
    name: "Claw Hammer",
    short: "Hammer",
    description: "For nails, mostly. Mostly.",
  },
  ammo_9mm_box: {
    name: "Box of 9 mm (50)",
    short: "9mm Box",
    description: "A sealed cardboard box of fifty rounds. Unpack it to load magazines.",
  },
  ifak: {
    name: "IFAK",
    short: "IFAK",
    description: "Individual first aid kit: tourniquet, gauze, a pressure dressing. Stops bad bleeding fast.",
  },
  painkillers: {
    name: "Painkillers",
    short: "Pills",
    description: "Ibuprofen by the handful. Takes the edge off and puts a little spring back in your step.",
  },
  canned_soup: {
    name: "Canned Soup",
    short: "Soup",
    description: "Chicken noodle, mostly noodle. Eats and drinks at the same time.",
  },
  canned_tuna: {
    name: "Canned Tuna",
    short: "Tuna",
    description: "Packed in oil. Pull tab, no opener needed, small mercies.",
  },
  mre: {
    name: "MRE",
    short: "MRE",
    description: "Meal, ready to eat. Twelve hundred calories, a flameless heater and a sense of being looked after.",
  },
  energy_drink: {
    name: "Energy Drink",
    short: "Energy",
    description: "Neon green and fizzy. Your heart will thank you later, or not.",
  },
  canteen: {
    name: "Canteen",
    short: "Canteen",
    description: "Dented steel canteen, full. Somebody will want to refill this.",
  },
  cloth: {
    name: "Cloth",
    short: "Cloth",
    description: "Folded fabric scraps. Bandages, patches, wicks: it all starts here.",
  },
  duct_tape: {
    name: "Duct Tape",
    short: "Tape",
    description: "Half a roll. Holds the valley together.",
  },
  rope: {
    name: "Rope",
    short: "Rope",
    description: "Ten metres of nylon rope, coiled tight.",
  },
  electronic_parts: {
    name: "Electronic Parts",
    short: "Electro",
    description: "Circuit boards and wire salvaged from dead appliances.",
  },
  gunpowder: {
    name: "Gunpowder",
    short: "Powder",
    description: "Smokeless powder in a screw-top tin. Keep it dry and away from the stove.",
  },
  metal_pipe: {
    name: "Metal Pipe",
    short: "Pipe",
    description: "A length of steel pipe. Builders want it; so does anyone without a weapon.",
  },
  wrench: {
    name: "Wrench",
    short: "Wrench",
    description: "Adjustable wrench, rusted at the worm screw but still turning.",
  },
  flashlight_a: {
    name: "Flashlight",
    short: "Torch",
    description: "Heavy aluminium flashlight. The batteries rattle when you shake it.",
  },
  cash: {
    name: "Cash",
    short: "Cash",
    description: "Folded bills. The traders still take it, and nobody asks why.",
  },
  wallet: {
    name: "Wallet",
    short: "Wallet",
    description: "A worn leather wallet. Room for cash, cards and a lockpick or two.",
  },
  lunchbox: {
    name: "Lunchbox",
    short: "Lunch",
    description: "A tin lunchbox with a faded cartoon on the lid. Food and drink only.",
  },
  medical_bag: {
    name: "Medical Bag",
    short: "Med Bag",
    description: "A red zip bag with elastic loops inside. Keeps medicine sorted and together.",
  },
  ammo_tin: {
    name: "Ammo Tin",
    short: "Ammo Tin",
    description: "Military surplus can with a rubber seal. Ammunition and magazines only.",
  },
  hoodie: {
    name: "Hoodie",
    short: "Hoodie",
    description: "Grey cotton hoodie with a deep front pocket on each side.",
  },
  military_jacket: {
    name: "Military Jacket",
    short: "Mil Jkt",
    description: "Woodland field jacket with four bellows pockets that actually close.",
  },
  cargo_pants: {
    name: "Cargo Pants",
    short: "Cargos",
    description: "Ripstop trousers with a big thigh pocket on each leg.",
  },
  tactical_vest: {
    name: "Tactical Vest",
    short: "Vest",
    description: "Plate carrier with four magazine pouches and an admin pocket. Pouches take magazines only.",
  },
  beanie: {
    name: "Beanie",
    short: "Beanie",
    description: "Knitted wool hat. Warm, at least.",
  },
  cap: {
    name: "Baseball Cap",
    short: "Cap",
    description: "A feed-store cap, sun-bleached at the brim.",
  },
  helmet_military: {
    name: "Military Helmet",
    short: "Helmet",
    description: "Kevlar combat helmet. Teeth do not get through it.",
  },
  gas_mask: {
    name: "Gas Mask",
    short: "Gas Mask",
    description: "Full-face respirator with one filter. Fit it before you need it.",
  },
  glasses: {
    name: "Glasses",
    short: "Glasses",
    description: "Wire-rimmed glasses. Not your prescription, but the world is sharper anyway.",
  },
  school_bag: {
    name: "School Bag",
    short: "School",
    description: "A kid’s backpack with a broken keychain on the zip. Small, but every bit counts.",
  },
  hiking_pack: {
    name: "Hiking Pack",
    short: "Hiking",
    description: "Day-hiking pack with a hip belt. Carries more than it looks.",
  },
  military_pack: {
    name: "Military Pack",
    short: "Mil Pack",
    description: "MOLLE assault pack in olive drab. Built to be overloaded.",
  },
  alice_pack: {
    name: "ALICE Pack",
    short: "ALICE",
    description: "Old army frame pack: a big main bag and two side pouches.",
  },
  large_hiking_pack: {
    name: "Large Hiking Pack",
    short: "Lg Hike",
    description: "Expedition pack with an internal frame. Room for a week, or a month if you are careful.",
  },
  laboratory_pack: {
    name: "Laboratory Pack",
    short: "Lab Pack",
    description: "A sealed, oversized field-lab pack. Nobody hauls one of these without a reason.",
  },
};
