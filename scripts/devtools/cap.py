"""스크린샷: cap.py <이름> → phone/<이름>.png (원본) + phone/<이름>_s.png (가로 540 축소)"""
import sys as _sys; _sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import sys, subprocess, os, re
from PIL import Image
adb = os.path.join(os.environ['LOCALAPPDATA'], 'Android', 'platform-tools', 'adb.exe')
os.environ.setdefault('ANDROID_SERIAL', 'emulator-5554')
here = os.path.dirname(os.path.abspath(__file__)); out = os.path.join(here, 'out', 'phone'); os.makedirs(out, exist_ok=True)
name = sys.argv[1]
png = subprocess.run([adb, 'exec-out', 'screencap', '-p'], capture_output=True, check=True).stdout
full = os.path.join(out, name + '.png'); open(full, 'wb').write(png)
im = Image.open(full).convert('RGB'); scale = 540 / im.width
im.resize((540, int(im.height * scale)), Image.LANCZOS).save(os.path.join(out, name + '_s.png'))
print(full, im.size)
