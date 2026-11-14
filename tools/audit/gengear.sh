#!/bin/bash
# Product-style picture of a single wearable (SDXL base, one at a time, on the hub). usage: gengear.sh <name> "<description>" <seed>
cd /e/Documents/GitHub/project-valley
mkdir -p assets/gen/gear/$1
py -3.10 D:/AI3D/hub/hub.py run sdxl-base --label "valley-gear-$1" --wait 20 -- D:/AI3D/envs/img/Scripts/python.exe -I D:/AI3D/hub/runners/sdxl.py --model sdxl-base --prompt "$2, single object, centered, isolated on a plain white background, product photo, 3d game asset reference, soft studio light, no person, no mannequin" --out "E:/Documents/GitHub/project-valley/assets/gen/gear/$1" --params "{\"width\":1024,\"height\":1024,\"steps\":30,\"seed\":$3}" 2>&1 | grep -a "RESULT\|rror" | cut -c1-200
