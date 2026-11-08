"""폰 화면의 글자를 찾아 누른다: tw.py <텍스트> [--cap] [--n 몇번째]  (ANDROID_SERIAL 기기, 전체 해상도 좌표)
   --list 만 주면 OCR 결과를 출력. 글자 인식은 Windows OCR(ocr.ps1), 캡처는 adb screencap."""
import sys as _s; _s.stdout.reconfigure(encoding='utf-8', errors='replace')
import sys, os, subprocess, re
here = os.path.dirname(os.path.abspath(__file__)); S = os.path.join(here, 'out')
adb = os.path.join(os.environ['LOCALAPPDATA'], 'Android', 'platform-tools', 'adb.exe')
def shot(path):
    png = subprocess.run([adb, 'exec-out', 'screencap', '-p'], capture_output=True, check=True).stdout
    open(path, 'wb').write(png)
def ocr(path, lang='ko'):
    out = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', os.path.join(here, 'ocr.ps1'), path, lang], capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
    rows = []
    for line in out.splitlines():
        m = re.match(r'(\d+) (\d+) (\d+) (\d+) \| (.*)', line.strip())
        if m: rows.append((int(m[1]), int(m[2]), int(m[3]), int(m[4]), m[5]))
    return rows
if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    n = int(sys.argv[sys.argv.index('--n') + 1]) if '--n' in sys.argv else 0
    path = os.path.join(S, 'phone', '_tw.png'); shot(path); rows = ocr(path)
    if '--list' in sys.argv or not args:
        for r in rows: print(*r)
        sys.exit(0)
    key = args[0].replace(' ', '')
    hits = [r for r in rows if key in r[4].replace(' ', '')]
    if not hits: print('NOT-FOUND', key); print('\n'.join(f'{r[1]} {r[4]}' for r in rows[:40])); sys.exit(1)
    x, y, w, h, t = hits[n]; cx, cy = x + w // 2, y + h // 2
    subprocess.run([adb, 'shell', 'input', 'tap', str(cx), str(cy)], check=True); print(f'tapped "{t}" at {cx},{cy}')
