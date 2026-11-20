#!/bin/bash
# Zombified Polyfork civilians (zmb_pfz_<name>_a): download, zombify vertex colours, retarget our 23 zombie clips, compress, register.
cd /e/Documents/GitHub/project-valley
B="C:/Program Files/Blender Foundation/Blender 4.5/blender.exe"; P="$PWD"; mkdir -p assets/gen/pfzmb
i=0
for pair in farmer:farmer-304a43 trucker:trucker-9266a8 police:police-officer-1cc379 worker:construction-worker-c1ad8c nurse:ward-nurse-84b61d hiker:hiker-3d1a41 resident:suburban-resident-a9db9c waitress:diner-waitress-60f6a1 soldier:infantry-rifleman-c1c0a5 patient:patient-in-gown-fdab75 hoodie:student-in-a-hoodie-7c8223 firefighter:firefighter-b13b36; do
  n=${pair%%:*}; id=${pair#*:}; i=$((i+1)); out=zmb_pfz_${n}_a
  [ -f /d/AI3D/polyfork/chars/$id.glb ] || curl -sL -o /d/AI3D/polyfork/chars/$id.glb https://polyfork.dev/cdn/$id.glb
  "$B" --background --python tools/audit/zombify_pf.py -- /d/AI3D/polyfork/chars/$id.glb "$P/assets/gen/pfzmb/z_$id.glb" $i 2>&1 | grep -a "Traceback\|Error"
  r=$("$B" --background --python tools/audit/retarget_pf.py -- "$P/assets/gen/pfzmb/z_$id.glb" "$P/assets/gen/rig/shambler.glb" "$P/assets/gen/pfzmb/$out.glb" $out 2>&1 | grep -a "RETARGET_PF")
  echo "$r"; t=$(echo "$r" | sed -E 's/.*tris ([0-9]+) ([0-9]+) ([0-9]+).*/\1,\2,\3/')
  npx gltf-transform meshopt assets/gen/pfzmb/$out.glb assets/gen/pfzmb/$out.mo.glb --level medium > /dev/null 2>&1
  node tools/audit/addmodel.mjs assets/gen/pfzmb/$out.mo.glb $out zmb $t
done
echo PFZ_DONE
