#!/bin/bash
# Direct runner call (no hub gate) for a batch where ComfyUI is already up and ours. usage: genview.sh <name> <input.png> "<instruction>" <seed> [w] [h]
cd /e/Documents/GitHub/project-valley
PY=C:/AI/ComfyUI/.venv/Scripts/python.exe
"$PY" -I D:/AI3D/hub/runners/comfy_image.py --model qwen-image-edit-2511 --prompt "$3" --image "$2" --out "E:/Documents/GitHub/project-valley/assets/gen/hero/$1" --params "{\"steps\":4,\"seed\":$4}" 2>&1 | grep -a "RESULT" | cut -c1-120
