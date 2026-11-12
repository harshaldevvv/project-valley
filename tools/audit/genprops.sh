#!/bin/bash
# z-image-turbo concept pictures for image-to-3D props. Needs ComfyUI up (hub.py comfy start).
cd /e/Documents/GitHub/project-valley
PY=C:/AI/ComfyUI/.venv/Scripts/python.exe
STYLE="single object centered, three-quarter view, isolated on a plain white background, stylized hand-painted low-poly game asset, muted weathered post-apocalyptic colors, soft even lighting, no text"
i=0
while IFS='|' read -r name prompt; do
  i=$((i+1))
  "$PY" -I D:/AI3D/hub/runners/comfy_image.py --model z-image-turbo --prompt "$prompt, $STYLE" --out "E:/Documents/GitHub/project-valley/assets/gen/props/$name" --params "{\"width\":1024,\"height\":1024,\"steps\":8,\"seed\":$((300+i))}"
done <<'LIST'
wreck_sedan|rusted abandoned wrecked sedan car with flat tires and broken windows
tent_military|olive green military canvas tent with faded patches
sandbag_wall|short curved wall of stacked burlap sandbags
barrels|three rusty oil drums stacked together, one fallen over
dead_tree|dead leafless twisted tree with a thick trunk
generator|old portable gasoline generator on a metal frame
pallet_stack|stack of wooden shipping pallets with a few wooden crates
dumpster|dented green metal dumpster with a half open lid
LIST
