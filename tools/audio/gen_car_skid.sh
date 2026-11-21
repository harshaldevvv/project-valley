#!/bin/sh
# Tyre skid squeal loop (own procedural work, no third-party audio): FM squeal (1150 Hz + 1720 Hz partial, vibrato)
# with chatter AM and band-passed scrub noise. Every modulator has a whole number of cycles in 2 s, so it loops clean.
# Usage: sh tools/audio/gen_car_skid.sh   -> public/assets/audio/car/tyre_skid_loop.ogg
set -e
out=public/assets/audio/car/tyre_skid_loop.ogg
ffmpeg -y -loglevel error \
  -f lavfi -i "aevalsrc='(0.32*sin(2*PI*1150*t+(60/7)*sin(2*PI*7*t))+0.16*sin(2*PI*1720*t+(80/5)*sin(2*PI*5*t)))*(0.72+0.28*sin(2*PI*13*t))':s=44100:d=2" \
  -f lavfi -i "anoisesrc=d=2:c=pink:r=44100:a=0.5" \
  -filter_complex "[1]highpass=f=900,lowpass=f=4200,volume=0.55[n];[0][n]amix=inputs=2:normalize=0,lowpass=f=6000,alimiter=limit=0.85[a]" \
  -map "[a]" -ac 1 -c:a libvorbis -q:a 4 "$out"
echo "$out"
