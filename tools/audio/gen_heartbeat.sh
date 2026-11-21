#!/bin/sh
# Heartbeat thump (own procedural work, no third-party audio) for the `heartbeat` sound id (the HUD plays it twice per
# beat, lub then a quieter dub). A low sine whose pitch falls (68 -> 44 Hz), fast attack, exponential decay, a soft
# 2nd harmonic and a little low-passed noise for the chest "thud", 0.32 s. Two takes with slightly different pitch.
# Usage: sh tools/audio/gen_heartbeat.sh   -> public/assets/audio/gen/heartbeat_1.ogg, heartbeat_2.ogg
set -e
for take in "1 68 44" "2 62 41"; do
  set -- $take
  out=public/assets/audio/gen/heartbeat_$1.ogg
  ffmpeg -y -loglevel error \
    -f lavfi -i "aevalsrc='min(1,t/0.006)*exp(-t*14)*(sin(2*PI*($3*t+($2-$3)*(1-exp(-t*20))/20))+0.25*sin(4*PI*($3*t+($2-$3)*(1-exp(-t*20))/20)))':s=44100:d=0.32" \
    -f lavfi -i "anoisesrc=d=0.32:c=brown:r=44100:a=0.4" \
    -filter_complex "[1]lowpass=f=160,afade=t=out:st=0:d=0.12[n];[0][n]amix=inputs=2:normalize=0,lowpass=f=240,alimiter=limit=0.9[a]" \
    -map "[a]" -ac 1 -c:a libvorbis -q:a 4 "$out"
  echo "$out"
done
