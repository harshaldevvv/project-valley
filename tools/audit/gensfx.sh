#!/bin/bash
# stable-audio3-sfx (Stability AI Community licence) -> short SFX -> normalised OGG in public/assets/audio/gen/
cd /e/Documents/GitHub/project-valley
PY=C:/AI/ComfyUI/.venv/Scripts/python.exe
mkdir -p assets/gen/sfx public/assets/audio/gen
i=0
while IFS='|' read -r name dur prompt; do
  i=$((i+1))
  "$PY" -I D:/AI3D/hub/runners/comfy_audio.py --model stable-audio3-sfx --prompt "$prompt, no music, no voice" --out "E:/Documents/GitHub/project-valley/assets/gen/sfx/$name" --params "{\"duration\":$dur,\"seed\":$((20+i))}" > /dev/null 2>&1
  f=$(ls assets/gen/sfx/$name/*.flac | head -1)
  ffmpeg -y -loglevel error -i "$f" -af "silenceremove=start_periods=1:start_threshold=-45dB,loudnorm=I=-18:TP=-2" -ac 1 -ar 44100 -c:a libvorbis -q:a 4 "public/assets/audio/gen/$name.ogg"
done <<'LIST'
swing_1|1.2|fast whoosh of a crowbar swung through the air, short and dry
swing_2|1.2|quick sharp whoosh of a knife slash through the air
swing_3|1.4|heavy whoosh of a hammer swung hard through the air
flesh_1|1.0|wet meaty thud of a punch hitting a body, short impact
flesh_2|1.0|wet bullet impact into flesh, dull thud with a squelch
flesh_3|1.0|heavy wet smack of a bat hitting flesh and bone
flesh_4|1.0|short wet crunch impact, close up
body_fall|1.6|heavy body collapsing and falling onto dirt ground, single thud and cloth rustle
head_pop|1.0|sharp wet crack of a headshot impact, short
LIST
