#!/bin/bash
# Rebuild the wearable parts GLB from the hero's rigged blend and register it.
cd /e/Documents/GitHub/project-valley
"C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" --background --python tools/audit/build_parts.py -- "$PWD/assets/gen/hero/rig/hero_rigged.blend" "$PWD/assets/gen/hero/out/parts.glb" 2>&1 | grep -a "FACE_FRONT\|PARTS_BUILT\|Traceback\|Error"
npx gltf-transform meshopt assets/gen/hero/out/parts.glb assets/gen/hero/out/parts_c.glb --level medium 2>&1 | tail -1 | cut -c1-80
node tools/audit/addmodel.mjs assets/gen/hero/out/parts_c.glb chr_hero_a_parts chr 13000,0,0
