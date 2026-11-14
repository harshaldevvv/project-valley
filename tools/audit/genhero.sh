#!/bin/bash
# Hero character views with qwen-image-edit-2511 (Apache-2.0) from the key-art crop. usage: genhero.sh <name> <input.png> "<instruction>" <seed>
cd /e/Documents/GitHub/project-valley
PY=C:/AI/ComfyUI/.venv/Scripts/python.exe
py -3.10 D:/AI3D/hub/hub.py run qwen-image-edit-2511 --label "valley-hero-$1" --wait 20 -- "$PY" -I D:/AI3D/hub/runners/comfy_image.py --model qwen-image-edit-2511 --prompt "$3" --image "$2" --out "E:/Documents/GitHub/project-valley/assets/gen/hero/$1" --params "{\"steps\":4,\"seed\":$4}"
