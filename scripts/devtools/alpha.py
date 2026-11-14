"""alpha.py <video> <bg프레임> <ui프레임> x,y,w,h [x,y,w,h ...] : 사진 배경 위에 얹힌 반투명 면의 색과 불투명도를 구한다.
   같은 자리의 '면이 없는 프레임'(bg)과 '면이 있는 프레임'(ui)을 견주어 out = (1-a)·bg + a·c 를 채널별로 최소제곱으로 푼다.
   좌표는 프레임 픽셀(녹화 프레임은 폭 540 = CSS px × 1.5). 접두는 f."""
import sys
import numpy as np
from PIL import Image
S = 'C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/video/'
name, fb, fu = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
bg = np.asarray(Image.open(f'{S}{name}/f{fb:04d}.png').convert('RGB')).astype(float)
ui = np.asarray(Image.open(f'{S}{name}/f{fu:04d}.png').convert('RGB')).astype(float)
for spec in sys.argv[4:]:
    x, y, w, h = [int(v) for v in spec.split(',')]
    b = bg[y:y + h, x:x + w].reshape(-1, 3); u = ui[y:y + h, x:x + w].reshape(-1, 3)
    # 세 채널을 한꺼번에: u = k·b + m (k = 1-a 는 채널 공통이라고 보고 푼다)
    bm = b - b.mean(axis=0); um = u - u.mean(axis=0)
    k = float((bm * um).sum() / max(1e-9, (bm * bm).sum()))
    a = 1 - k
    m = u.mean(axis=0) - k * b.mean(axis=0)
    c = m / a if a > 0.02 else m
    resid = float(np.abs(u - (k * b + m)).mean())
    print(f'{spec:>18}  alpha {a:.3f}  colour #%02x%02x%02x  (bg mean #%02x%02x%02x → ui mean #%02x%02x%02x, 잔차 {resid:.1f})' % (*[int(max(0, min(255, round(v)))) for v in c], *[int(round(v)) for v in b.mean(axis=0)], *[int(round(v)) for v in u.mean(axis=0)]))
