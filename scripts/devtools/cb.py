"""cb.py <name> x,y,w,h rrggbb tol [label] : 영역(CSS px) 안에서 주어진 색에 가까운 픽셀의 상자와, 줄(y)마다 가로 범위를 출력"""
import sys
import numpy as np
from PIL import Image

S = 'C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/phone/'
name = sys.argv[1]
x, y, w, h = [round(float(v) * 3) for v in sys.argv[2].split(',')]
ref = [int(sys.argv[3][i:i + 2], 16) for i in (0, 2, 4)]
tol = int(sys.argv[4])
label = sys.argv[5] if len(sys.argv) > 5 else ''
rows = len(sys.argv) > 6
a = np.asarray(Image.open(S + name + '.png').convert('RGB')).astype(int)
reg = a[y:y + h, x:x + w]
m = np.abs(reg - np.array(ref)).max(axis=2) <= tol
ys, xs = np.where(m)
if not len(xs):
    print(name, label, 'none')
    sys.exit()
print(name, label, 'x %.2f..%.2f (w %.2f)  y %.2f..%.2f (h %.2f)' % ((xs.min() + x) / 3, (xs.max() + 1 + x) / 3, (xs.max() + 1 - xs.min()) / 3, (ys.min() + y) / 3, (ys.max() + 1 + y) / 3, (ys.max() + 1 - ys.min()) / 3))
if rows:
    for yy in range(ys.min(), ys.max() + 1, 3):
        r = np.where(m[yy])[0]
        if len(r):
            print('   y %.2f: %.2f..%.2f' % ((yy + y) / 3, (r.min() + x) / 3, (r.max() + 1 + x) / 3))
