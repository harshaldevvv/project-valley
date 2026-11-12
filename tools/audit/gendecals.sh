#!/bin/bash
# z-image-turbo wall decals on white (the game turns white into transparent). Needs no other GPU job.
cd /e/Documents/GitHub/project-valley
PY=C:/AI/ComfyUI/.venv/Scripts/python.exe
i=0
while IFS='|' read -r name prompt; do
  i=$((i+1))
  "$PY" -I D:/AI3D/hub/runners/comfy_image.py --model z-image-turbo --prompt "$prompt, flat 2d graphic on a pure white background, high contrast, weathered and faded, no wall, no shadow" --out "E:/Documents/GitHub/project-valley/assets/gen/decals/$name" --params "{\"width\":1024,\"height\":1024,\"steps\":8,\"seed\":$((500+i))}"
done <<'LIST'
red_x|huge hand painted red spray paint letter X with drips
safe_zone|stenciled black text SAFE ZONE with an arrow, spray paint stencil
biohazard|faded yellow and black biohazard warning symbol stencil
evac_arrow|white-on-grey stenciled EVACUATION arrow pointing right, military stencil
missing_flyers|cluster of torn paper missing person flyers taped together with torn edges, black and white photocopies
graffiti_survive|bold spray paint graffiti word DON'T OPEN DEAD INSIDE in dripping red letters
skull_tag|spray painted black skull and crossbones tag graffiti with drips
tally_marks|chalk tally marks counting days in white and grey scratched lines
LIST
