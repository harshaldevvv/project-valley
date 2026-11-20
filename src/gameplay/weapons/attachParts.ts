import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, type BufferGeometry, type Object3D } from 'three';
import type { WeaponModel } from './models';

/**
 * Simple low-poly attachment parts on a gun model, placed at the model's own SOCKET_sight / SOCKET_muzzle (every gun model
 * has both; sockets are in the model root's space). Rebuilt whenever the gun's `attach` record changes.
 */
const dark = new MeshStandardMaterial({ color: '#2a2d31', roughness: 0.55, metalness: 0.3, flatShading: true });
const black = new MeshStandardMaterial({ color: '#16181a', roughness: 0.7, metalness: 0.2, flatShading: true });
const lens = new MeshStandardMaterial({ color: '#7a1010', roughness: 0.2, metalness: 0.1, emissive: '#aa1818', emissiveIntensity: 0.8 });
const glass = new MeshStandardMaterial({ color: '#2a4a60', roughness: 0.15, metalness: 0.2, emissive: '#10202c', emissiveIntensity: 0.5 });

function part(g: Group, geo: BufferGeometry, m: MeshStandardMaterial, x: number, y: number, z: number) {
  const o = new Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = false;
  g.add(o);
  return o;
}
/** Cylinder lying along Z. */
const tube = (r: number, len: number, r2 = r) => new CylinderGeometry(r2, r, len, 10).rotateX(Math.PI / 2);

export function buildOptic(id: string): Group {
  const g = new Group();
  g.name = 'ATT_optic';
  if (id === 'scope_4x') {
    part(g, tube(0.02, 0.26), dark, 0, 0.035, 0);
    part(g, tube(0.029, 0.06, 0.02), black, 0, 0.035, -0.15); // objective bell
    part(g, tube(0.024, 0.045, 0.02), black, 0, 0.035, 0.145); // eyepiece
    part(g, new BoxGeometry(0.02, 0.03, 0.02), black, 0, 0.01, -0.07); // rings
    part(g, new BoxGeometry(0.02, 0.03, 0.02), black, 0, 0.01, 0.07);
    part(g, new BoxGeometry(0.012, 0.012, 0.01), glass, 0, 0.035, -0.182);
  } else {
    part(g, new BoxGeometry(0.03, 0.01, 0.065), black, 0, 0.003, 0); // base
    part(g, new BoxGeometry(0.026, 0.03, 0.05), dark, 0, 0.022, 0); // housing
    part(g, new BoxGeometry(0.03, 0.006, 0.054), black, 0, 0.04, 0.004); // hood
    part(g, new BoxGeometry(0.018, 0.016, 0.004), lens, 0, 0.024, -0.026); // lens
  }
  return g;
}

export function buildMuzzle(id: string, radius: number): Group {
  const g = new Group();
  g.name = 'ATT_muzzle';
  if (id === 'suppressor') {
    part(g, tube(radius, 0.19), black, 0, 0, -0.095);
    part(g, tube(radius * 1.12, 0.02), dark, 0, 0, -0.012); // collar
    part(g, tube(radius * 0.55, 0.004), new MeshStandardMaterial({ color: '#000000' }), 0, 0, -0.192);
  }
  return g;
}

const radiusOf = (cls: string) => (cls === 'pistol' ? 0.017 : 0.021);

/** Put the current attachments on one model copy (removes the previous parts). */
export function syncParts(model: WeaponModel, attach: Record<string, string> | undefined, cls: string) {
  const old = model.root.userData.attParts as Object3D[] | undefined;
  if (old) for (const o of old) o.removeFromParent();
  const parts: Object3D[] = [];
  const place = (sock: Object3D | undefined, obj: Group) => {
    if (!sock?.parent) return;
    obj.position.copy(sock.position);
    sock.parent.add(obj);
    parts.push(obj);
  };
  const sockets = model.sockets;
  if (attach?.optic) place(sockets?.get('sight'), buildOptic(attach.optic));
  if (attach?.muzzle) place(sockets?.get('muzzle'), buildMuzzle(attach.muzzle, radiusOf(cls)));
  model.root.userData.attParts = parts;
}
