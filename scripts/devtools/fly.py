"""fly.py <video> <ref-frame> <x,y,w,h> <a> <b> [prefix=f] : 기준 프레임의 조각(template)을 각 프레임 전체에서 찾아 위치·일치도 출력 (프레임 px, 540 폭). cv2.matchTemplate."""
import sys
import cv2

S = 'C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/video/'
name, ref = sys.argv[1], int(sys.argv[2])
x, y, w, h = [int(v) for v in sys.argv[3].split(',')]
a, b = int(sys.argv[4]), int(sys.argv[5])
prefix = sys.argv[6] if len(sys.argv) > 6 else 'f'


def load(i):
    return cv2.imread(f'{S}{name}/{prefix}{i:04d}.png')


tpl = load(ref)[y:y + h, x:x + w]
for i in range(a, b + 1):
    im = load(i)
    if im is None:
        break
    res = cv2.matchTemplate(im, tpl, cv2.TM_CCOEFF_NORMED)
    _, mx, _, loc = cv2.minMaxLoc(res)
    print(f'{i:4d}  x {loc[0]:4d}  y {loc[1]:4d}  score {mx:.3f}')
