/** Build-mode text (systems-builder; narrative may reword). Piece names keyed by build piece id. */
export const buildText = {
  pieces: {
    wood_foundation: 'Foundation',
    wood_wall: 'Wall',
    wood_doorway: 'Doorway',
    wood_door: 'Door',
    wood_window: 'Window',
    wood_floor: 'Floor',
    wood_stairs: 'Stairs',
    wood_gable: 'Gable',
    wood_roof: 'Roof',
  } as Record<string, string>,
  title: 'Build mode',
  hint: '<kbd>LMB</kbd> place <kbd>R</kbd> rotate <kbd>X</kbd> remove <kbd>Wheel</kbd>/<kbd>1–9</kbd> piece <kbd>B</kbd> exit',
  free: 'Free building',
  area: 'Build here only (build pad)',
  occupied: 'Something is already there',
  support: 'Needs support',
  need: 'Need',
  holds: 'Remove what rests on it first',
  /** {piece} = blocking piece name. */
  holdsAbove: 'Remove the {piece} above first',
  holdsOn: 'Remove the {piece} first',
  refund: 'Salvaged',
  /** One salvaged stack: {item} name, {n} count. */
  refundItem: '{item} ×{n}',
  open: 'Open door',
  close: 'Close door',
};
