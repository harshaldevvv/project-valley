#!/bin/bash
# Character concept pictures for image-to-3D: full body, front view, A-pose (so the mesh matches the rig's rest pose).
cd /e/Documents/GitHub/project-valley
PY=C:/AI/ComfyUI/.venv/Scripts/python.exe
STYLE="full body front view, standing straight in a relaxed A-pose with arms slightly away from the body and legs slightly apart, feet visible, symmetrical, isolated on a plain white background, stylized hand-painted low-poly game character, muted post-apocalyptic colors, soft even lighting"
i=0
while IFS='|' read -r name prompt; do
  i=$((i+1))
  "$PY" -I D:/AI3D/hub/runners/comfy_image.py --model z-image-turbo --prompt "$prompt, $STYLE" --out "E:/Documents/GitHub/project-valley/assets/gen/chars/$name" --params "{\"width\":768,\"height\":1280,\"steps\":8,\"seed\":$((700+i))}"
done <<'LIST'
zombie_civilian|male zombie civilian with grey-green rotting skin, torn dirty plaid shirt and jeans, bare feet, sunken eyes, blood stains
zombie_hazmat|zombie in a torn yellow hazmat suit with cracked gas mask pushed up, grey skin, stained
zombie_soldier|zombie soldier in tattered olive camouflage uniform and helmet, pale grey skin, blood on vest
zombie_nurse|female zombie in a bloodstained torn nurse uniform, pale grey-green skin, messy hair
LIST
