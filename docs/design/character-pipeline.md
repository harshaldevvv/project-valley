# Main character: pipeline, rig and customization plan (2026-11-14)

Owner brief: take the hero from the loading-screen poster, generate front/side/back views, build a 3D model, rig it,
animate it (rifle, pistol, melee, items, reactions), check every pose in the viewer, then make everything equippable
(clothes, armour, headgear, eyewear, gloves, shoes, pants, backpacks). The environment is secondary.

## Pipeline (each step has a screenshot gate before the next)
1. **Views.** Crop the poster hero (`assets/gen/hero/crop_back.png`), turn him around with qwen-image-edit-2511 (Apache-2.0):
   front first, then side and back from the front view, so the three agree. Gate: three clean views, same clothes and face.
2. **Mesh.** Hunyuan3D-2mv (shape from front/left/back/right) and/or Hunyuan3D-2.1 (shape + paint). The owner asked for
   local generation of this one character, which overrides the earlier "no Hunyuan until the licence answer" note.
   Licence caveat stays: the Tencent licence is not valid in the EU, UK and South Korea (see CREDITS.md).
3. **Fit.** Blender: decimate to about 6-8k triangles, feet on z = 0, 1.80 m tall, T-pose or A-pose matching the rig, head
   at normal proportions (fix the oversized AI head by scaling the head group, as done for the zombies).
4. **Rig.** Skin to a rig, one skeleton for every character (our 24-bone survivor rig: hips, spine, chest, neck, head,
   shoulders, arms, forearms, hands, legs, feet, toes, plus SOCKET_hand_R / SOCKET_hand_L). Weights: transfer from a clean
   body template mesh, then hand-check shoulders, elbows, hips and knees at extreme poses in the viewer.
5. **Animation.** The 40 existing survivor clips are authored for that skeleton, so they play unchanged on any mesh
   skinned to it. Gate: every clip in the viewer from front, side and back (locomotion, aim, fire, reload, draw, holster,
   melee, shove, use items, hit, death), with and without the held item.
6. **Game integration.** Replace `chr_survivor_a.glb`; check third person, first person arms, vehicles, death.

## Customization system (slots, parts, masks)
Slots already exist in the game's loadout (head, face, eyes, ears, armor, legs, gloves, feet, jacket, pack, pouch, hands).
Visual layer to add (`src/gameplay/outfit/`):
- **Base body** split into named regions: `head`, `torso`, `arms`, `hands`, `legs`, `feet` (separate meshes, one skeleton).
- **Part** = `{ id, slot, kind: 'skinned' | 'rigid', bone?, hides: Region[], model }`.
  - skinned parts (jacket, shirt, trousers, boots, gloves, vest) share the skeleton and hide the base regions they cover;
  - rigid parts (helmet, cap, glasses, mask, backpack, belt pouches, holster) parent to a bone with an offset.
- **Data**: parts live in `src/content/data/outfit.ts` keyed by item id; the equipped item in a slot picks the part.
  Colour variants through a tint per part (palette swatch), so a few meshes give many looks.
- **Viewer**: a Wardrobe panel in `/viewer.html` to equip any part in any slot and see it animated.
- **Build**: parts are made in Blender from the same template (scripted) or from Polyfork clothing/gear props where they fit.

## Status
- [x] Viewer page (`/viewer.html`): model picker, every clip, held items, camera presets, headless screenshot driver.
- [ ] Step 1 views (blocked on the GPU: a ComfyUI server owned by another session holds VRAM; asked the parent session).
- [ ] Steps 2-6, then the outfit system.
