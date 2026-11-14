#!/bin/bash
# Base body (underwear, fingers): fit + rig + skin, retarget clips with finger grips, compress, register as chr_body_a.
# usage: rebuild_body.sh <mesh.glb> [tris]
cd /e/Documents/GitHub/project-valley
P="$PWD"; B="C:/Program Files/Blender Foundation/Blender 4.5/blender.exe"; T=${2:-30000}
"$B" --background --python tools/audit/build_body.py -- "$P/$1" "$P/assets/gen/hero/rigbase" $T 2>&1 | grep -a "UNWEIGHTED\|HERO_BUILT\|Traceback\|Error"
"$B" --background --python tools/audit/retarget_body.py -- "$P/assets/gen/hero/rigbase/hero_rigged.glb" "$P/assets/gen/rig/survivor.glb" "$P/assets/gen/hero/out/chr_body_a.glb" chr_body_a 2>&1 | grep -a "RETARGET_HERO\|Traceback\|Error"
npx gltf-transform meshopt assets/gen/hero/out/chr_body_a.glb assets/gen/hero/out/chr_body_a_c.glb --level medium 2>&1 | tail -1 | cut -c1-80
node tools/audit/addmodel.mjs assets/gen/hero/out/chr_body_a_c.glb chr_body_a chr $T,$((T/2)),$((T/5))
