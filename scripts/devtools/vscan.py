"""vscan.py <name> <x> [y0 y1] : 세로줄 x(기기 px)에서 색이 바뀌는 y 위치들을 CSS px 로"""
import sys
from PIL import Image
S = 'C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/phone/'
im = Image.open(S + sys.argv[1] + '.png').convert('RGB')
x = int(sys.argv[2]); y0 = int(sys.argv[3]) if len(sys.argv) > 3 else 0; y1 = int(sys.argv[4]) if len(sys.argv) > 4 else im.height
px = im.load()
def col(y):
    r = g = b = 0
    for dx in range(-3, 4):
        p = px[x + dx, y]; r += p[0]; g += p[1]; b += p[2]
    return (r // 7, g // 7, b // 7)
prev = col(y0); start = y0
for y in range(y0 + 1, y1):
    c = col(y)
    if max(abs(c[i] - prev[i]) for i in range(3)) > 7:
        if y - start > 2: print('%7.2f..%7.2f (%4d px) #%02x%02x%02x' % (start / 3, y / 3, y - start, *prev))
        start = y; prev = c
print('%7.2f..%7.2f (%4d px) #%02x%02x%02x' % (start / 3, y1 / 3, y1 - start, *prev))
