/**
 * Short radio broadcasts played by the handheld radio, in order, then around again. The valley's one live frequency:
 * a tired voice at a relay station and a few recordings on a loop. Dry, practical, never cheerful.
 */
export const radioStation = 'RELAY 7 · 98.3';

export const radioLines: string[] = [
  'This is Relay Seven, still on the air. If you can hear this, you are not alone. Keep your noise down and your water boiled.',
  'Reminder from the county: the checkpoint on the south road is closed. It has been closed for some time. Do not go and look.',
  'Weather outlook: cold at night, rain by afternoon. A coat is not optional. Neither is a fire, if you can make one without being seen.',
  'To whoever keeps leaving cans on the fence by the old farm: thank you. We took the beans. The tuna is still there.',
  'Dispatch to any unit. Dispatch to any unit. Dispatch to any unit. ... Dispatch to any unit.',
  'Medical tip of the day: clean it before you wrap it. A dirty bandage kills slower than a bite, but it still kills.',
  'The diner at the crossroads is empty. The kitchen is not. Go in quietly, come out with what you can carry, and do not light the stove.',
  'If you find a green bottle at the camp, it is not water. If you already drank it, sit down. Antibiotics help if you are early.',
  'The ranger post sends its regards. The lookout can see everything and has run out of good news.',
  'We are not asking you to be brave. We are asking you to be careful. They are not the same thing, and one of them lasts longer.',
  '...three, two, one. Battery low. This is Relay Seven, signing off for the night. Light a fire if you have one. Sleep if you can.',
];

/**
 * Broadcasts that only come through at a place (the radio picks by the nearest point of interest, then falls back to the
 * general list). Keyed by poi id (data/pois.ts).
 */
export const radioAt: Record<string, string[]> = {
  fuel: ['Route Nine. The pumps give a little at a time. Do not be greedy and do not be seen, and the truck will start.'],
  maple: ['Maple Street. If a porch light is on, someone left it on for somebody. Do not take their light.'],
  farm: ['Hollow Creek. There is salt in the barn and tin in the cellar. Eat hot and eat quiet.'],
  camp: ['Pinewood. They kept a fire every night. If you can, keep it for them.'],
  crash: ['Medevac Two, this is Relay Seven. Medevac Two, this is Relay Seven. ...Nobody is going to answer. I know. I keep trying.'],
  ranger: ['Relay Seven, loud and clear. You made it up the ridge. I have been waiting weeks for a voice that was not mine. Stay on the air. We are building something from here.'],
  lake: ['...Loon Lake, this is nobody. The dock is the safest place in the valley: they do not swim. Bring a line and be patient.'],
  outpost: ['Harlan actual to any station. Harlan actual to any station. Convoy left north at dawn, day eleven. Gate is open. Medics went with it. The garrison stayed. Do not come for the garrison.'],
};
