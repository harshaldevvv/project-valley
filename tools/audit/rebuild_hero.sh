#!/bin/bash
# Full hero rebuild from the generated T-pose mesh: fit + rig + skin, retarget the survivor clips, compress, register.
# usage: rebuild_hero.sh [tris]
cd /e/Documents/GitHub/project-valley
P="$PWD"; B="C:/Program Files/Blender Foundation/Blender 4.5/blender.exe"; T=${1:-16000}
M=$(ls assets/gen/hero/meshT/*.glb | head -1)
"$B" --background --python tools/audit/build_hero.py -- "$P/$M" "$P/assets/gen/hero/rig" $T 2>&1 | grep -a "UNWEIGHTED\|HERO_BUILT\|Traceback\|Error"
"$B" --background --python tools/audit/retarget_hero.py -- "$P/assets/gen/hero/rig/hero_rigged.glb" "$P/assets/gen/rig/survivor.glb" "$P/assets/gen/hero/out/chr_hero_a.glb" chr_hero_a 2>&1 | grep -a "RETARGET_HERO\|Traceback\|Error"
npx gltf-transform meshopt assets/gen/hero/out/chr_hero_a.glb public/assets/models/chr/chr_hero_a.glb --level medium 2>&1 | tail -1 | cut -c1-80
node tools/audit/addmodel.mjs public/assets/models/chr/chr_hero_a.glb chr_hero_a chr $T,$((T/2)),$((T/5))
