"""hscan.py <name> <y css> [x0 x1 css] [thr=10] : 가로줄 y 에서 색이 바뀌는 x 위치들 (CSS px)"""
import sys
from PIL import Image

S = 'C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/phone/'
im = Image.open(S + sys.argv[1] + '.png').convert('RGB')
y = round(float(sys.argv[2]) * 3)
x0 = round(float(sys.argv[3]) * 3) if len(sys.argv) > 3 else 0
x1 = round(float(sys.argv[4]) * 3) if len(sys.argv) > 4 else im.width
thr = int(sys.argv[5]) if len(sys.argv) > 5 else 10
px = im.load()


def col(x):
    r = g = b = 0
    for dy in range(-1, 2):
        p = px[x, y + dy]
        r += p[0]; g += p[1]; b += p[2]
    return (r // 3, g // 3, b // 3)


start = x0
ref = col(x0)
for x in range(x0 + 1, x1 + 1):
    c = col(x) if x < x1 else None
    if c is None or max(abs(c[i] - ref[i]) for i in range(3)) > thr:
        if x - start >= 2:
            print(f'{start / 3:7.2f}..{x / 3:7.2f} ({x - start:4d} px) #%02x%02x%02x' % ref)
        start = x
        if c is not None:
            ref = c
