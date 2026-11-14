# gcard.sh <name> : 실제 앱(문법) 화면을 찍어 진행 막대 + 카드 + 보기 칸만 작게 저장 (phone/<name>_c.png)
T="C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad"
export ANDROID_SERIAL="adb-R39N5043ZPZ-IcEF35._adb-tls-connect._tcp" PYTHONUTF8=1
python -I "$T/tools/cap.py" "$1" >/dev/null
python -I - "$1" <<'PY'
import sys
from PIL import Image
S='C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/phone/'
im=Image.open(S+sys.argv[1]+'.png').convert('RGB')
top=im.crop((0,100,1080,230)).resize((540,65)); card=im.crop((0,530,1080,1560)).resize((540,515)); bot=im.crop((0,1880,1080,2200)).resize((540,160))
c=Image.new('RGB',(540,65+515+160+4),(255,0,255)); c.paste(top,(0,0)); c.paste(card,(0,67)); c.paste(bot,(0,584)); c.save(S+sys.argv[1]+'_c.png')
PY
