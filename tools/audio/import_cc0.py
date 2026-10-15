"""Import the CC0 sound files used by src/content/data/sounds.ts into public/assets/audio/.

Downloads are done by hand (see docs/pipeline/asset-credits.md for URLs); unzip each pack into
<src>/<pack>/ and run:   python -I tools/audio/import_cc0.py <src> public/assets/audio

OGG files are copied as-is. WAV files (PCM 16/24-bit or float32) are mixed to mono, resampled,
leading silence trimmed, cut to a max length with a short fade, peak-normalised to -1 dBFS and
written as 16-bit WAV (no ffmpeg on this machine, so no OGG encode). Keeps every file < 300 KB.
"""
import shutil
import struct
import sys
from pathlib import Path

import numpy as np

# (source path relative to <src>, output name, max seconds, sample rate)
WAVS = [
    ('oga/gunshots/22_Pistol.wav', 'gun/pistol_22.wav', 0.42, 32000),
    ('oga/gunsounds/x/sounds/cz.wav', 'gun/pistol_cz.wav', 1.4, 32000),
    ('oga/gunshots/22_Magnum.wav', 'gun/rifle_magnum.wav', 0.65, 32000),
    ('oga/gunsounds/x/sounds/sks.wav', 'gun/rifle_sks.wav', 1.6, 32000),
    ('oga/gunsounds/x/sounds/mosin.wav', 'gun/rifle_mosin.wav', 1.2, 32000),
    ('oga/gunsounds/x/sounds/shotty.wav', 'gun/shotgun.wav', 1.0, 32000),
] + [(f'oga/zpack/x/zombies/zombie-{i}.wav', f'zombie/z{i:02d}.wav', 1.6, 22050) for i in range(1, 25)]

OGG_DIRS = {
    'dl/kenney_impact-sounds': 'kenney',
    'dl/kenney_interface-sounds': 'kenney',
    'dl/kenney_rpg-audio': 'kenney',
    'oga/car/x': 'car',
    'oga/undead/x': 'zombie',
    'oga/zmoans': 'zombie',
}
KEEP_OGG = {  # only what sounds.ts uses
    'footstep_grass_00', 'footstep_concrete_00', 'footstep_carpet_00', 'impactPunch_', 'impactMining_', 'impactSoft_',
    'impactWood_medium', 'impactWood_heavy', 'impactPlank_medium', 'impactMetal_light', 'impactPlate_light', 'impactBell_heavy_00',
    'metalClick', 'metalLatch', 'drawKnife', 'creak', 'cloth', 'handleSmallLeather', 'beltHandle', 'dropLeather',
    'click_001', 'click_002', 'open_001', 'close_001', 'error_004', 'tick_001', 'confirmation_001',
    'Car_Engine_Loop', 'Car_Engine_Start_Up', 'Car_Horn', 'Car_Door', 'undead-', 'darsycho',
}


def read_wav(path: Path):
    b = path.read_bytes()
    assert b[:4] == b'RIFF' and b[8:12] == b'WAVE', path
    i, fmt, data = 12, None, None
    while i < len(b) - 8:
        cid, size = b[i:i + 4], struct.unpack('<I', b[i + 4:i + 8])[0]
        body = b[i + 8:i + 8 + size]
        if cid == b'fmt ':
            fmt = struct.unpack('<HHIIHH', body[:16])
        elif cid == b'data':
            data = body
        i += 8 + size + (size & 1)
    tag, ch, rate, _, _, bits = fmt
    if tag == 0xFFFE:  # WAVE_FORMAT_EXTENSIBLE: assume PCM unless float32
        tag = 3 if bits == 32 else 1
    if tag == 3:
        x = np.frombuffer(data, '<f4').astype(np.float64)
    elif bits == 16:
        x = np.frombuffer(data, '<i2') / 32768.0
    elif bits == 24:
        a = np.frombuffer(data[: len(data) // 3 * 3], np.uint8).reshape(-1, 3)
        v = (a[:, 0].astype(np.int32) | (a[:, 1].astype(np.int32) << 8) | (a[:, 2].astype(np.int32) << 16))
        x = np.where(v >= 1 << 23, v - (1 << 24), v) / float(1 << 23)
    else:
        raise ValueError(f'{path}: unsupported {bits}-bit')
    x = x[: len(x) // ch * ch].reshape(-1, ch).mean(axis=1)
    return x, rate


def process(x, rate, max_s, out_rate):
    n_out = int(len(x) * out_rate / rate)
    x = np.interp(np.linspace(0, len(x) - 1, n_out), np.arange(len(x)), x)  # ponytail: linear resample, fine for SFX
    peak = np.abs(x).max() or 1.0
    start = int(np.argmax(np.abs(x) > peak * 0.25))
    x = x[max(0, start - int(0.01 * out_rate)):][: int(max_s * out_rate)]
    fade = min(len(x), int(0.08 * out_rate))
    x[-fade:] *= np.linspace(1, 0, fade)
    x = x / (np.abs(x).max() or 1.0) * 0.89
    return (x * 32767).astype('<i2')


def write_wav(path: Path, pcm, rate):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = pcm.tobytes()
    hdr = b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, rate, rate * 2, 2, 16)
    path.write_bytes(hdr + b'data' + struct.pack('<I', len(data)) + data)


def main(src: Path, out: Path):
    for rel, name, max_s, rate in WAVS:
        x, r = read_wav(src / rel)
        write_wav(out / name, process(x, r, max_s, rate), rate)
    for d, sub in OGG_DIRS.items():
        for f in (src / d).rglob('*.ogg'):
            if '__MACOSX' not in str(f) and any(f.name.startswith(k) for k in KEEP_OGG):
                (out / sub).mkdir(parents=True, exist_ok=True)
                shutil.copy(f, out / sub / f.name)
    big = [p for p in out.rglob('*') if p.is_file() and p.stat().st_size > 300_000]
    assert not big, f'over 300 KB: {big}'
    print('ok', sum(1 for _ in out.rglob('*.*')), 'files')


if __name__ == '__main__':
    main(Path(sys.argv[1]), Path(sys.argv[2]))
