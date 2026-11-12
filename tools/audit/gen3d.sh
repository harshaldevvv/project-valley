#!/bin/bash
# Hunyuan3D-2.1 image -> textured GLB, one prop at a time via the hub (TRELLIS2's mesh stage needs ~20 GB RAM and was
# stopped by the hub guard on this PC). Output: assets/gen/glb/<name>/
cd /e/Documents/GitHub/project-valley
for d in assets/gen/props/*/; do
  n=$(basename "$d"); img=$(ls "$d"*.png | head -1)
  [ -n "$(ls assets/gen/glb/$n/*.glb 2>/dev/null)" ] && continue
  py -3.10 D:/AI3D/hub/hub.py run hunyuan3d-2.1 --label "valley-3d-$n" --wait 20 -- D:/AI3D/envs/hy21/Scripts/python.exe -I D:/AI3D/hub/runners/hunyuan3d.py --model hunyuan3d-2.1 --image "$img" --out "E:/Documents/GitHub/project-valley/assets/gen/glb/$n" --params '{"texture":true,"seed":7}'
done
echo ALL3DDONE
