#!/bin/bash
# TRELLIS.2 mesh for each gear picture (sequential, one generator at a time). usage: gen3dgear.sh name...
cd /e/Documents/GitHub/project-valley
for n in "$@"; do
  mkdir -p assets/gen/gear/${n}_3d
  py -3.10 D:/AI3D/hub/hub.py run trellis2 --label "valley-gear3d-$n" --wait 30 -- D:/AI3D/envs/trellis2/Scripts/python.exe -I D:/AI3D/hub/runners/trellis2.py --model trellis2 --image "$(ls E:/Documents/GitHub/project-valley/assets/gen/gear/$n/*.png | head -1)" --out "E:/Documents/GitHub/project-valley/assets/gen/gear/${n}_3d" --params '{"type":"1024","faces":12000,"tex":1024,"seed":3}' 2>&1 | grep -a "RESULT\|STOPPED" | cut -c1-160
done
