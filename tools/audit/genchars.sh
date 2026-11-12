#!/bin/bash
# Character concept pictures for image-to-3D: full body, front view, A-pose (so the mesh matches the rig's rest pose).
cd /e/Documents/GitHub/project-valley
PY=C:/AI/ComfyUI/.venv/Scripts/python.exe
STYLE="full body front view, standing straight in a relaxed A-pose with arms slightly away from the body and legs slightly apart, feet visible, symmetrical, isolated on a plain white background, stylized hand-painted low-poly game character, muted post-apocalyptic colors, soft even lighting"
i=0
while IFS='|' read -r name prompt; do
  i=$((i+1))
  "$PY" -I D:/AI3D/hub/runners/comfy_image.py --model z-image-turbo --prompt "$prompt, $STYLE" --out "E:/Documents/GitHub/project-valley/assets/gen/chars/$name" --params "{\"width\":768,\"height\":1280,\"steps\":8,\"seed\":$((900+i))}"
done <<'LIST'
zombie_worker|zombie construction worker in a torn orange high-visibility vest, dirty white hard hat, dark work pants and boots, grey-green skin, blood stains
zombie_police|zombie police officer in a torn dark blue uniform shirt with a badge and duty belt, grey skin, blood stains
zombie_hoodie|female zombie teenager in a torn grey hoodie and ripped jeans and sneakers, grey-green skin, messy hair, blood stains
zombie_suit|zombie office worker in a torn grey business suit with a loosened red tie and dress shoes, pale grey skin, blood stains
LIST
