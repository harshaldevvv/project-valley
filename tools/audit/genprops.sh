#!/bin/bash
# z-image-turbo concept pictures for image-to-3D props. Needs ComfyUI up (hub.py comfy start).
cd /e/Documents/GitHub/project-valley
PY=C:/AI/ComfyUI/.venv/Scripts/python.exe
STYLE="single building centered, three-quarter view from slightly above, isolated on a plain white background, stylized hand-painted low-poly game building, muted weathered post-apocalyptic colors, soft even lighting, no text"
i=0
while IFS='|' read -r name prompt; do
  i=$((i+1))
  "$PY" -I D:/AI3D/hub/runners/comfy_image.py --model z-image-turbo --prompt "$prompt, $STYLE" --out "E:/Documents/GitHub/project-valley/assets/gen/props/$name" --params "{\"width\":1024,\"height\":1024,\"steps\":8,\"seed\":$((600+i))}"
done <<'LIST'
ruined_house|abandoned two story suburban house with broken windows, partially collapsed roof, peeling paint and overgrown vines
barn|old weathered red wooden barn with a sagging gambrel roof and missing planks
gas_station|abandoned roadside gas station with a flat canopy over two pumps and a small shop, faded and rusted
water_tower|tall rusty steel water tower on four legs with a round tank
farm_silo|old corrugated metal grain silo with a conical rusty roof and a small shed beside it
small_church|small white wooden country church with a steeple, peeling paint and broken windows
LIST
