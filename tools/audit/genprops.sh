#!/bin/bash
# z-image-turbo concept pictures for image-to-3D props. Needs ComfyUI up (hub.py comfy start).
cd /e/Documents/GitHub/project-valley
PY=C:/AI/ComfyUI/.venv/Scripts/python.exe
STYLE="single object centered, three-quarter view, isolated on a plain white background, stylized hand-painted low-poly game asset, muted weathered post-apocalyptic colors, soft even lighting, no text"
i=0
while IFS='|' read -r name prompt; do
  i=$((i+1))
  "$PY" -I D:/AI3D/hub/runners/comfy_image.py --model z-image-turbo --prompt "$prompt, $STYLE" --out "E:/Documents/GitHub/project-valley/assets/gen/props/$name" --params "{\"width\":1024,\"height\":1024,\"steps\":8,\"seed\":$((400+i))}"
done <<'LIST'
burned_van|burned out rusted delivery van with blackened paint and missing doors
shipping_container|weathered rusty red shipping container with faded stenciled markings
watchtower|small wooden guard watchtower on four legs with a ladder and a plank roof
tire_pile|pile of old black rubber car tires stacked in a heap
crate_stack|stack of wooden supply crates and a green military ammo box
campfire|small campfire ring of stones with burnt logs and a tripod cooking pot
sofa_junk|abandoned dirty torn old sofa with a stained mattress leaning on it
bush_overgrown|large overgrown dense green shrub bush with some dry branches
LIST
