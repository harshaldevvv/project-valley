"""Build the music and ambience loops in public/assets/audio/{music,amb}/ from the CC0 downloads.

Download the files listed in docs/pipeline/asset-credits.md (MUSIC / AMB rows) into <src>/ and run:
    python tools/audio/build_music.py <src> public/assets/audio <ffmpeg>

Each file is decoded, gain-matched to a loudness target (measured with ffmpeg ebur128), and loops get a seamless
seam: the last `fold` seconds are crossfaded onto the head (equal power), so the tail of the track carries into its
own start with no gap or click. Encoded as OGG Vorbis (music ~96 kbps stereo, ambience ~64 kbps).
"""
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

SR = 44100
# (source, output, target LUFS, fold seconds (0 = one-shot / already seamless), channels, vorbis quality)
FILES = [
    ('EmptyCity.ogg', 'music/explore_empty_city.ogg', -20, 2.0, 2, 2),
    ('Medium_Alert.mp3', 'music/combat_medium_alert.ogg', -20, 0, 2, 2),
    ('wind_woosh_loop.ogg', 'amb/wind.ogg', -26, 0, 2, 1),
    ('amb_morning_0.ogg', 'amb/birds_day.ogg', -24, 1.5, 2, 1),
    ('crickets_1.mp3', 'amb/crickets_night.ogg', -24, 1.0, 1, 1),
    ('Crows.ogg', 'amb/crows.ogg', -22, 0, 1, 1),
    ('crow_caw.wav', 'amb/crow_caw.ogg', -20, 0, 1, 1),
]


def decode(ff, path, ch):
    raw = subprocess.run([ff, '-v', 'error', '-i', str(path), '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()


def lufs(ff, path):
    err = subprocess.run([ff, '-hide_banner', '-i', str(path), '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', err)[-1])


def fold_loop(x, seconds):
    n = int(seconds * SR)
    head, tail = x[:n], x[-n:]
    t = np.linspace(0, np.pi / 2, n, dtype=np.float32)[:, None]
    out = x[:-n].copy()
    out[:n] = head * np.sin(t) + tail * np.cos(t)  # tail fades out while the head fades in
    return out


def main(src, dst, ff):
    src, dst = Path(src), Path(dst)
    for name, out, target, fold, ch, q in FILES:
        x = decode(ff, src / name, ch)
        x *= 10 ** ((target - lufs(ff, src / name)) / 20)
        if fold:
            x = fold_loop(x, fold)
        peak = float(np.abs(x).max())
        if peak > 0.89:  # keep 1 dB of headroom
            x *= 0.89 / peak
        o = dst / out
        o.parent.mkdir(parents=True, exist_ok=True)
        enc = subprocess.run([ff, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', '-',
                              '-c:a', 'libvorbis', '-q:a', str(q), str(o)], input=x.astype(np.float32).tobytes())
        enc.check_returncode()
        print(f'{out:34s} {len(x) / SR:6.1f}s  {o.stat().st_size / 1024:6.0f} KB')


if __name__ == '__main__':
    main(*sys.argv[1:4])
