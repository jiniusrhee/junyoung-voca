# 공용 함수: source w.sh  (플립 실제 앱 탐색용)
export ANDROID_SERIAL="adb-R39N5043ZPZ-IcEF35._adb-tls-connect._tcp" PYTHONUTF8=1 MSYS_NO_PATHCONV=1
ADB="$LOCALAPPDATA/Android/platform-tools/adb.exe"
T="C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/tools"
c() { sleep ${2:-1.2}; python -I "$T/cap.py" "$1" >/dev/null; }          # c <name> [delay]
tap() { "$ADB" shell input tap $1 $2; }                                   # tap x y
tw() { python -I "$T/tw.py" "$@" | tail -1; }                             # tw "글자"
up() { "$ADB" shell input swipe 540 ${1:-2100} 540 ${2:-900} 500; }       # 위로 스크롤(내용이 올라감)
down() { "$ADB" shell input swipe 540 ${1:-900} 540 ${2:-2100} 500; }
back() { "$ADB" shell input keyevent KEYCODE_BACK; }
ocr() { python -I "$T/tw.py" --list | sed -n "1,${1:-40}p"; }
top() { "$ADB" shell "dumpsys activity activities | grep topResumedActivity" | head -1; }
mont() { # mont <out> <w> name...
  python -I - "$@" <<'PY'
import sys
from PIL import Image, ImageDraw
S = r'C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad'
out, w, names = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = []
for n in names:
    try: im = Image.open(f'{S}/phone/{n}.png').convert('RGB')
    except Exception: print('missing', n); continue
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    d = ImageDraw.Draw(im); d.rectangle((0, 0, 8 + 6 * len(n), 14), fill=(0, 0, 0)); d.text((2, 1), n, fill=(255, 255, 0)); ims.append(im)
H = max(i.height for i in ims); c = Image.new('RGB', (len(ims) * (w + 4), H), (40, 40, 40))
for k, im in enumerate(ims): c.paste(im, (k * (w + 4), 0))
c.save(f'{S}/phone/{out}.png'); print(out, c.size)
PY
}
# 플립의 준영보카 디버그 앱(com.junyoung.voca.debug) 조작: ours_start / oev "<js>" / ogo "/route"
ours_start() { "$ADB" shell am force-stop com.junyoung.voca.debug; "$ADB" shell monkey -p com.junyoung.voca.debug -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep ${1:-7}; local pid=$("$ADB" shell pidof com.junyoung.voca.debug | tr -d '\r'); "$ADB" forward tcp:9225 localabstract:webview_devtools_remote_$pid >/dev/null; echo "ours pid $pid"; }
ours_front() { "$ADB" shell monkey -p com.junyoung.voca.debug -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep ${1:-1.5}; }
real_front() { "$ADB" shell am start -n kr.epopsoft.word/org.cocos2dx.javascript.AppActivity >/dev/null 2>&1; sleep ${1:-2}; }
oev() { DEVTOOLS_PORT=9225 timeout 12 node "$T/remote.mjs" "$1" | tail -1; }
ogo() { oev "location.hash='#$1';'x'" >/dev/null; sleep ${2:-2}; }
ours_fwd() { local pid=$("$ADB" shell pidof com.junyoung.voca.debug | tr -d '\r'); "$ADB" forward tcp:9225 localabstract:webview_devtools_remote_$pid >/dev/null; echo "ours pid $pid"; }
still() { oev "$(cat "$T/still.js")"; }
