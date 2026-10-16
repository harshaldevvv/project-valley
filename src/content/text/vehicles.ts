/** Vehicle prompts, toasts and HUD strings (QA-076). */
export const vehicleText = {
  drive: 'Drive',
  openTrunk: 'Open trunk',
  trunkUnavailable: 'Trunk: inventory not installed yet',
  repairWithKit: 'Repair car (repair kit)',
  repairNeedsKit: 'Repair car: needs a repair kit',
  needsKit: 'Needs a repair kit',
  repaired: 'Car repaired',
  engineDestroyed: 'Engine destroyed',
  draggedOut: 'Dragged out!',
  hudEngineDead: 'ENGINE DEAD · F/E get out',
  hudCar: (pct: number) => `CAR ${pct}% · F/E get out`,
  hudFlip: ' · R flip',
};
