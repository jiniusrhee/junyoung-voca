"""shore.py <name> <y0 css> <y1 css> [step=15] : 풍경의 띠 경계를 x 마다 잰다 — 올리브 언덕 위 끝, 짙은 풀 위 끝, 물가(밝은 선) 위 끝 (화면 CSS px)"""
import sys
import numpy as np
from PIL import Image

S = 'C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/phone/'
name = sys.argv[1]
y0 = round(float(sys.argv[2]) * 3)
y1 = round(float(sys.argv[3]) * 3)
step = int(sys.argv[4]) if len(sys.argv) > 4 else 15
im = np.asarray(Image.open(S + name + '.png').convert('RGB')).astype(int)


def near(c, ref, tol):
    return np.abs(c - np.array(ref)).max(axis=-1) <= tol


for x in range(0, 361, step):
    px = min(1079, x * 3)
    col = im[y0:y1, max(0, px - 1):px + 2].mean(axis=1)
    olive = near(col, (0x8b, 0xb0, 0x84), 12)
    grass = near(col, (0x66, 0x86, 0x5b), 12)
    water = near(col, (0x75, 0xb8, 0xb4), 14) | near(col, (0x8e, 0xcb, 0xca), 12)

    def first(m, need=4):
        run = 0
        for i, v in enumerate(m):
            run = run + 1 if v else 0
            if run >= need:
                return round((i - need + 1 + y0) / 3, 2)
        return None

    def last(m):
        idx = np.where(m)[0]
        return round((idx.max() + 1 + y0) / 3, 2) if len(idx) else None

    print(f'x {x:3d}  olive {first(olive)}  grass {first(grass)}~{last(grass)}  water {first(water)}')
