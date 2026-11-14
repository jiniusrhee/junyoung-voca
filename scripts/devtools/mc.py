"""말해보카 리스닝 객관식: mc.py [U|I|J|K|R|N ...] → 차례로 누른 뒤(각 0.9초) 화면의 보기 4개와 카드 글자를 OCR 로 출력
   U I J K = 보기 왼위·오위·왼아래·오아래, R = 다시 듣기, N = 다음 문제"""
import sys as _s; _s.stdout.reconfigure(encoding='utf-8', errors='replace')
import sys, os, subprocess, time
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
import tw
adb = tw.adb
POS = {'U': (280, 1930), 'I': (800, 1930), 'J': (280, 2200), 'K': (800, 2200), 'R': (541, 2438), 'N': (888, 2363)}
for a in sys.argv[1:]:
    if a.startswith('w'):
        time.sleep(float(a[1:])); continue
    x, y = POS[a.upper()]
    subprocess.run([adb, 'shell', 'input', 'tap', str(x), str(y)], check=True)
    time.sleep(2.6 if a.upper() == 'N' else 0.9)
path = os.path.join(tw.S, 'phone', '_tw.png'); tw.shot(path); rows = tw.ocr(path)
slots = {'U': '', 'I': '', 'J': '', 'K': ''}; card = []; other = []
for x, y, w, h, t in rows:
    cx, cy = x + w / 2, y + h / 2
    if 1800 < cy < 2060: slots['U' if cx < 540 else 'I'] += t
    elif 2070 < cy < 2330: slots['J' if cx < 540 else 'K'] += t
    elif 640 < cy < 1460: card.append(t)
    elif cy > 100: other.append(t)
print('card:', ' / '.join(card)); print('U:', slots['U'], '| I:', slots['I'], '| J:', slots['J'], '| K:', slots['K']); print('other:', ' / '.join(other))
