"""ink.py <name> x,y,w,h [thr] [colgap] : 영역(CSS px) 안에서 배경과 다른 덩어리를 줄(세로 구간)별로, 줄 안에서는 가로 덩어리별로 나열 (CSS px, 평균색)"""
import sys
import numpy as np
from PIL import Image
S = 'C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/phone/'
name = sys.argv[1]; x, y, w, h = [round(float(v) * 3) for v in sys.argv[2].split(',')]
thr = int(sys.argv[3]) if len(sys.argv) > 3 else 14; colgap = int(sys.argv[4]) if len(sys.argv) > 4 else 12
im = np.asarray(Image.open(S + name + '.png').convert('RGB')).astype(int)
reg = im[y:y + h, x:x + w]
q = (reg.reshape(-1, 3) // 4) * 4 + 2; vals, counts = np.unique(q, axis=0, return_counts=True); bg = vals[np.argmax(counts)]
m = np.abs(reg - bg).max(axis=2) > thr
def runs(v, gap):
    out = []; s = None
    for i, b in enumerate(list(v) + [False]):
        if b and s is None: s = i
        if not b and s is not None:
            if out and s - out[-1][1] <= gap: out[-1][1] = i
            else: out.append([s, i])
            s = None
    return out
print('bg #%02x%02x%02x' % tuple(bg))
for r0, r1 in runs(m.any(axis=1), 1):
    sub = m[r0:r1]
    print('y %.2f..%.2f (h %.2f)' % ((y + r0) / 3, (y + r1) / 3, (r1 - r0) / 3))
    for c0, c1 in runs(sub.any(axis=0), colgap):
        blk = sub[:, c0:c1]; ys = np.where(blk.any(axis=1))[0]
        px = reg[r0:r1, c0:c1][blk]; mean = px.mean(axis=0)
        # 가장 진한(배경에서 먼) 색
        far = px[np.argsort(np.abs(px - bg).sum(axis=1))[-max(1, len(px) // 5):]].mean(axis=0)
        print('    x %.2f..%.2f (w %.2f)  y %.2f..%.2f (h %.2f)  mean #%02x%02x%02x core #%02x%02x%02x' % ((x + c0) / 3, (x + c1) / 3, (c1 - c0) / 3, (y + r0 + ys.min()) / 3, (y + r0 + ys.max() + 1) / 3, (ys.max() + 1 - ys.min()) / 3, *[int(v) for v in mean], *[int(v) for v in far]))
