#!/bin/bash
# z-image-turbo concept pictures for image-to-3D props. Needs ComfyUI up (hub.py comfy start).
cd /e/Documents/GitHub/project-valley
PY=C:/AI/ComfyUI/.venv/Scripts/python.exe
STYLE="single building centered, three-quarter view from slightly above, isolated on a plain white background, stylized hand-painted low-poly game building, muted weathered post-apocalyptic colors, soft even lighting, no text"
i=0
while IFS='|' read -r name prompt; do
  i=$((i+1))
  "$PY" -I D:/AI3D/hub/runners/comfy_image.py --model z-image-turbo --prompt "$prompt, $STYLE" --out "E:/Documents/GitHub/project-valley/assets/gen/props/$name" --params "{\"width\":1024,\"height\":1024,\"steps\":8,\"seed\":$((750+i))}"
done <<'LIST'
tree_oak|single large broadleaf oak tree with a thick trunk and a full rounded green leafy crown, only the tree, no ground, no base, no building, no platform
tree_autumn|single broadleaf maple tree with a thick trunk and a full crown of orange and yellow autumn leaves, only the tree, no ground, no base, no building, no platform
LIST
