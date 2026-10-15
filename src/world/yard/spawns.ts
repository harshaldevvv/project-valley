import { yard } from '../../content/data/yard';

/**
 * Yard spawn points (plain data, no three.js: safe for sim code).
 * yaw: radians about +Y; yaw 0 faces north (-Z); forward = (-sin yaw, 0, -cos yaw).
 */
const { track, pen } = yard.stations;

/** Track centreline: rounded rectangle inset from the track station rect. Road is `width` m wide. */
export const trackLoop = {
  cx: track.x,
  cz: track.z,
  hx: track.w / 2 - 6, // half extents of the centreline
  hz: track.d / 2 - 6,
  r: 12, // corner radius
  width: 8,
};

export const yardSpawns = {
  player: { x: yard.spawn.x, y: 0, z: yard.spawn.z, yaw: yard.spawn.yaw },
  /** On the start box of the west straight, facing north (drive clockwise seen from above). */
  car: { x: trackLoop.cx - trackLoop.hx, y: 0.1, z: trackLoop.cz + 6, yaw: 0 },
  /** Spawn zombies uniformly inside this circle (fence is 12 m from the centre). */
  penZombies: { x: pen.x, z: pen.z, radius: 8 },
};
