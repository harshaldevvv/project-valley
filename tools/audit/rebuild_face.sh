#!/bin/bash
# Re-bake the base body's face texture (reference projection + painted irises) and rebuild chr_body_a from the rig. EYES="x,z,r"
cd /e/Documents/GitHub/project-valley
P="$PWD"; B="C:/Program Files/Blender Foundation/Blender 4.5/blender.exe"
NORED=1 EYES=${EYES:-0.034,1.648,0.0085} "$B" --background --python tools/audit/bake_face.py -- "$P/assets/gen/hero/rigbase/hero_rigged.blend" "$P/assets/gen/hero/base_tpose.png" "$P/assets/gen/hero/rigfb" 503 507 60 2>&1 | grep -a "FACE_BAKED\|Traceback\|Error"
"$B" --background --python tools/audit/retarget_body.py -- "$P/assets/gen/hero/rigfb/hero_rigged.glb" "$P/assets/gen/rig/survivor.glb" "$P/assets/gen/hero/out/chr_body_a.glb" chr_body_a 2>&1 | grep -a "RETARGET_HERO\|Traceback"
npx gltf-transform meshopt assets/gen/hero/out/chr_body_a.glb assets/gen/hero/out/chr_body_a_c.glb --level medium 2>&1 | tail -1 | cut -c1-70
node tools/audit/addmodel.mjs assets/gen/hero/out/chr_body_a_c.glb chr_body_a chr 30000,15000,6000
