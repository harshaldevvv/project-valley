#!/bin/bash
cd /e/Documents/GitHub/project-valley
PY=$(py -3.10 -c "import json;r=json.load(open('D:/AI3D/hub/registry.json'));ms=r['models'] if isinstance(r,dict) and 'models' in r else r;m=[x for x in ms if x['id']=='z-image-turbo'][0];print(m['runner']['python'])")
echo PY=$PY
i=0
while IFS='|' read -r name prompt; do
  i=$((i+1))
  "$PY" -I D:/AI3D/hub/runners/comfy_image.py --model z-image-turbo --prompt "$prompt" --out "E:/Documents/GitHub/project-valley/assets/gen/tex/$name" --params "{\"width\":1024,\"height\":1024,\"steps\":8,\"seed\":$((100+i))}"
done <<'LIST'
dirt|seamless tileable texture, top-down photo of dry packed brown dirt and gravel ground with small stones, flat even lighting, no shadows, game ground texture
concrete|seamless tileable texture, top-down photo of weathered cracked grey concrete slab with stains and moss in cracks, flat even lighting, no shadows, game texture
grunge|seamless tileable texture, grayscale dirt and grime overlay, scratches, rust streaks and wear, soft mid grey, flat lighting, game grunge map
LIST
echo ALLDONE
