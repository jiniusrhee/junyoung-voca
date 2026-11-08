#!/bin/bash
# 화면 녹화 → 프레임 추출. 사용법: rec.sh <이름> <초> [fps]   (ANDROID_SERIAL 로 기기 선택)
S="$(cd "$(dirname "$0")" && pwd)/out"
A="$LOCALAPPDATA/Android/platform-tools/adb.exe"
export MSYS_NO_PATHCONV=1
W=$("$A" shell wm size | tr -d '\r' | awk '{print $NF}' | tail -1)
SW=$(( ${W%x*} / 2 )); SH=$(( ${W#*x} / 2 )); SH=$(( SH - SH % 2 ))
name=$1; secs=${2:-8}; fps=${3:-4}
mkdir -p "$S/video/$name"
"$A" shell screenrecord --time-limit "$secs" --bit-rate 8000000 --size ${SW}x${SH} /sdcard/rec_$name.mp4
"$A" pull /sdcard/rec_$name.mp4 "$S/video/$name.mp4" >/dev/null && "$A" shell rm /sdcard/rec_$name.mp4
ffmpeg -loglevel error -y -i "$S/video/$name.mp4" -vf "fps=$fps,scale=270:-1" "$S/video/$name/f%03d.png"
n=$(ls "$S/video/$name" | wc -l); echo "frames: $n size: ${SW}x${SH}"
python -I - "$S/video/$name" "$S/video/${name}_strip" <<'PY'
import sys, os, glob
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
fs = sorted(glob.glob(os.path.join(d, 'f*.png')))
for k in range(0, len(fs), 10):
    ims = [Image.open(f).convert('RGB') for f in fs[k:k+10]]
    W = sum(i.width for i in ims) + 4*(len(ims)-1); H = ims[0].height
    c = Image.new('RGB', (W, H), (40,40,40)); x = 0
    for i, f in zip(ims, fs[k:k+10]):
        ImageDraw.Draw(i).text((3,3), os.path.basename(f)[1:4], fill=(255,255,0)); c.paste(i, (x,0)); x += i.width+4
    c.save(f'{out}_{k//10:02d}.png')
print('strips', (len(fs)+9)//10)
PY
