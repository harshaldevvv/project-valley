#!/bin/bash
# TRELLIS2 (MIT) image -> textured GLB, one prop at a time via the hub. Output: assets/gen/glb/<name>/
cd /e/Documents/GitHub/project-valley
for d in assets/gen/props/*/; do
  n=$(basename "$d"); img=$(ls "$d"*.png | head -1)
  [ -n "$(ls assets/gen/glb/$n 2>/dev/null)" ] && continue
  py -3.10 D:/AI3D/hub/hub.py run trellis2 --label "valley-3d-$n" --wait 30 -- D:/AI3D/envs/trellis2/Scripts/python.exe -I D:/AI3D/hub/runners/trellis2.py --model trellis2 --image "$img" --out "E:/Documents/GitHub/project-valley/assets/gen/glb/$n" --params '{"type":"1024_cascade","faces":30000,"tex":1024,"seed":7}'
done
echo ALL3DDONE
