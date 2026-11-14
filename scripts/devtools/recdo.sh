#!/bin/bash
# 녹화하면서 기기 안에서 입력 스크립트를 실행: recdo.sh <이름> <초> "<기기 셸 스크립트>" [추출 fps=30]
# 결과: video/<이름>.mp4, video/<이름>/f###.png (가로 540 로 축소)
S="C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad"
A="$LOCALAPPDATA/Android/platform-tools/adb.exe"
export MSYS_NO_PATHCONV=1
name=$1; secs=$2; script=$3; fps=${4:-30}
rm -rf "$S/video/$name"; mkdir -p "$S/video/$name"
"$A" shell "screenrecord --time-limit $secs --bit-rate 12000000 --size 540x1318 /sdcard/rec_$name.mp4" &
RP=$!
sleep 1.2
"$A" shell "$script"
wait $RP
"$A" pull /sdcard/rec_$name.mp4 "$S/video/$name.mp4" >/dev/null && "$A" shell rm /sdcard/rec_$name.mp4
ffmpeg -loglevel error -y -i "$S/video/$name.mp4" -vf "fps=$fps" "$S/video/$name/f%04d.png"
echo "frames: $(ls "$S/video/$name" | wc -l) @${fps}fps"
