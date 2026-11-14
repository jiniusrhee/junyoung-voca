"""chg.py <video> [region x,y,w,h|-] [minpix=150] [prefix=f] [gap=2] : 연속 프레임 차이가 있는 구간을 묶어서 출력 (프레임 범위, 합친 상자, 가장 큰 변화 픽셀 수)"""
import sys, os
import numpy as np
from PIL import Image
S = 'C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/video/'
name = sys.argv[1]; reg = None if len(sys.argv) < 3 or sys.argv[2] == '-' else [int(v) for v in sys.argv[2].split(',')]
minpix = int(sys.argv[3]) if len(sys.argv) > 3 else 150; prefix = sys.argv[4] if len(sys.argv) > 4 else 'f'; gap = int(sys.argv[5]) if len(sys.argv) > 5 else 2
files = sorted(f for f in os.listdir(S + name) if f.startswith(prefix) and f.endswith('.png'))
prev = None; runs = []
for f in files:
    i = int(f[len(prefix):-4]); im = np.asarray(Image.open(f'{S}{name}/{f}').convert('RGB')).astype(np.int16)
    if reg: im = im[reg[1]:reg[1] + reg[3], reg[0]:reg[0] + reg[2]]
    if prev is not None:
        d = np.abs(im - prev).max(axis=2) > 24; n = int(d.sum())
        if n >= minpix:
            ys, xs = np.where(d); bb = [xs.min(), ys.min(), xs.max() + 1, ys.max() + 1]
            if runs and i - runs[-1][1] <= gap:
                r = runs[-1]; r[1] = i; r[2] = max(r[2], n); r[3] = [min(r[3][0], bb[0]), min(r[3][1], bb[1]), max(r[3][2], bb[2]), max(r[3][3], bb[3])]
            else: runs.append([i, i, n, bb])
    prev = im
ox, oy = (reg[0], reg[1]) if reg else (0, 0)
for a, b, n, bb in runs: print('%4d-%4d (%3d fr) max %6d  x%d-%d y%d-%d' % (a, b, b - a + 1, n, bb[0] + ox, bb[2] + ox, bb[1] + oy, bb[3] + oy))
