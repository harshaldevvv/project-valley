import { Object3D, Quaternion, Vector3 } from 'three';

/** Shared two-bone IK in world space (TP hero arms; audit A13). */
const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _t = new Vector3(), _u = new Vector3(), _p = new Vector3(), _n = new Vector3(), _tip = new Vector3();
const _q1 = new Quaternion(), _q2 = new Quaternion(), _q3 = new Quaternion();

/** Swing `bone` so the direction to its `child` points at `to` (world), keeping its roll. */
export function aimBone(bone: Object3D, child: Object3D, to: Vector3) {
  bone.updateWorldMatrix(true, false);
  child.getWorldPosition(_n);
  bone.getWorldPosition(_u);
  _q1.setFromUnitVectors(_n.sub(_u).normalize(), _p.copy(to).sub(_u).normalize());
  bone.getWorldQuaternion(_q2);
  _q2.premultiply(_q1);
  (bone.parent ? bone.parent.getWorldQuaternion(_q3).invert() : _q3.identity()).multiply(_q2);
  bone.quaternion.copy(_q3);
  bone.updateWorldMatrix(false, true);
}

/**
 * Two-bone IK: upper `A`, lower `B`, end `C` reach `target` (world). The bend keeps the side it had, pulled toward
 * `pole` (world direction, its length is the pull weight) when given. `C` keeps its world orientation.
 */
export function reach(A: Object3D, B: Object3D, C: Object3D, target: Vector3, pole?: Vector3) {
  A.updateWorldMatrix(true, true);
  const endQ = C.getWorldQuaternion(new Quaternion());
  A.getWorldPosition(_a); B.getWorldPosition(_b); C.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  const d = Math.min(Math.max(_a.distanceTo(target), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
  _u.copy(target).sub(_a).normalize();
  _p.copy(_b).sub(_a);
  _p.addScaledVector(_u, -_p.dot(_u));
  if (_p.lengthSq() < 1e-8) _p.set(0, -1, 0);
  _p.normalize();
  if (pole) {
    _p.add(pole);
    _p.addScaledVector(_u, -_p.dot(_u));
    if (_p.lengthSq() < 1e-8) _p.set(0, -1, 0);
    _p.normalize();
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const elbow = _t.copy(_a).addScaledVector(_u, a).addScaledVector(_p, h).clone();
  _tip.copy(_a).addScaledVector(_u, d);
  aimBone(A, B, elbow);
  aimBone(B, C, _tip);
  B.getWorldQuaternion(_q3).invert();
  C.quaternion.copy(_q3.multiply(endQ));
  C.updateWorldMatrix(false, true);
}
