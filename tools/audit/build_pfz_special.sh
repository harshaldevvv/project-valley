#!/bin/bash
# Special zombie archetypes from zombified Polyfork characters (zmb_pfz_<name>_a): same pipeline as build_pfz.sh plus an optional
# body scale (brute). Each: name:polyfork-id:scale:seed. Credited in CREDITS.md. Models already in D:/AI3D/polyfork/chars are reused.
cd /e/Documents/GitHub/project-valley
B="C:/Program Files/Blender Foundation/Blender 4.5/blender.exe"; P="$PWD"; mkdir -p assets/gen/pfzmb
for spec in brute:groundworker-083f5c:1.4:21 runner:surveyor-82e5c7:0.97:22 screamer:lake-angler-1c4740:0.95:23 crawler:scuba-diver-bdd1c8:0.95:24; do
  IFS=: read n id k i <<< "$spec"; out=zmb_pfz_${n}_a
  [ -f /d/AI3D/polyfork/chars/$id.glb ] || curl -sL -o /d/AI3D/polyfork/chars/$id.glb https://polyfork.dev/cdn/$id.glb
  "$B" --background --python tools/audit/zombify_pf.py -- /d/AI3D/polyfork/chars/$id.glb "$P/assets/gen/pfzmb/z_$id.glb" $i 2>&1 | grep -a "Traceback\|Error"
  r=$("$B" --background --python tools/audit/retarget_pf.py -- "$P/assets/gen/pfzmb/z_$id.glb" "$P/assets/gen/rig/shambler.glb" "$P/assets/gen/pfzmb/$out.glb" $out 2>&1 | grep -a "RETARGET_PF")
  echo "$r"; t=$(echo "$r" | sed -E 's/.*tris ([0-9]+) ([0-9]+) ([0-9]+).*/\1,\2,\3/')
  [ "$k" != "1" ] && node tools/audit/scale_zmb.mjs assets/gen/pfzmb/$out.glb assets/gen/pfzmb/$out.s.glb $k && mv assets/gen/pfzmb/$out.s.glb assets/gen/pfzmb/$out.glb
  npx gltf-transform meshopt assets/gen/pfzmb/$out.glb assets/gen/pfzmb/$out.mo.glb --level medium > /dev/null 2>&1
  node tools/audit/addmodel.mjs assets/gen/pfzmb/$out.mo.glb $out zmb $t
done
echo PFZ_SPECIAL_DONE
