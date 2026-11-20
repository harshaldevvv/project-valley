import { POI_SIGNS } from '../../content/data/outskirts';
import { poiById } from '../../content/data/pois';
import { poiText, tierLabel } from '../../content/text/pois';
import { faceToward, type Kit } from '../yard/kit';
import { text, type Card } from '../yard/signs';

/** Entrance signs: two posts and a painted board with the POI name, a danger label (tier) and its hook, readable both ways. */
export function buildPoiSigns(kit: Kit) {
  const BG: Record<number, string> = { 1: '#41553b', 2: '#6b5a2a', 3: '#6a2c2a' };
  for (const s of POI_SIGNS) {
    const poi = poiById[s.poi], t = poiText[s.poi];
    if (!poi || !t) continue;
    const yaw = faceToward(s.x, s.z, s.toward[0], s.toward[1]);
    const card: Card = { title: t.name, sub: tierLabel[poi.tier], body: t.hook, bg: BG[poi.tier], fg: '#ece8dc' };
    const ax = Math.cos(yaw), az = -Math.sin(yaw); // board's long axis
    for (const d of [-1.25, 1.25]) kit.box(0.14, 2.7, 0.14, 'wood_dark', s.x + ax * d, 0, s.z + az * d, yaw, true, 0.55);
    kit.box(3.2, 1.35, 0.12, 'wood_weathered', s.x, 1.25, s.z, yaw, false, 0.6);
    text(card, 3.0, 1.2, s.x, 1.35, s.z, yaw, -0.075);
    text(card, 3.0, 1.2, s.x, 1.35, s.z, yaw + Math.PI, -0.075);
  }
}
