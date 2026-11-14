"""tb.py <name> <thr> x,y,w,h [x,y,w,h ...] : 영역(CSS px) 안에서 밝기(최대 채널)가 thr 넘는 픽셀의 상자 (CSS px). thr 앞에 '-' 를 붙이면 thr 보다 어두운 픽셀."""
import sys
import numpy as np
from PIL import Image

S = 'C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/phone/'
name = sys.argv[1]
thr = int(sys.argv[2])
im = np.asarray(Image.open(S + name + '.png').convert('RGB')).astype(int)
for spec in sys.argv[3:]:
    x, y, w, h = [round(float(v) * 3) for v in spec.split(',')]
    reg = im[y:y + h, x:x + w]
    m = reg.max(axis=2) > thr if thr >= 0 else reg.max(axis=2) < -thr
    if not m.any():
        print(spec, 'none')
        continue
    ys, xs = np.where(m)
    x0, x1, y0, y1 = (xs.min() + x) / 3, (xs.max() + 1 + x) / 3, (ys.min() + y) / 3, (ys.max() + 1 + y) / 3
    sel = reg[m]
    top = sel[sel.max(axis=1) >= np.percentile(sel.max(axis=1), 90)].mean(axis=0)
    print(f'{spec:>22}  x {x0:.2f}..{x1:.2f} (w {x1 - x0:.2f})  y {y0:.2f}..{y1:.2f} (h {y1 - y0:.2f})  peak #%02x%02x%02x' % tuple(int(v) for v in top))
