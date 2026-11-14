#!/bin/bash
# Rebuild the wearables GLB for the base body and register it as chr_body_a_parts.
cd /e/Documents/GitHub/project-valley
"C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" --background --python tools/audit/build_gear.py -- "$PWD/assets/gen/hero/rigbase/hero_rigged.blend" "$PWD/assets/gen/hero/out/gear.glb" 2>&1 | grep -a "MEASURED\|GEAR_BUILT\|Traceback\|Error\|line "
npx gltf-transform meshopt assets/gen/hero/out/gear.glb assets/gen/hero/out/gear_c.glb --level medium 2>&1 | tail -1 | cut -c1-80
node tools/audit/addmodel.mjs assets/gen/hero/out/gear_c.glb chr_body_a_parts chr 0,0,0
