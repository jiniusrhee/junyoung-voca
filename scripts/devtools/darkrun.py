"""darkrun.py <이름> h <y css> [임계=80] | v <x css> [임계=80] : 가로줄(h)·세로줄(v)에서 어두운(최대 채널 < 임계) 구간들을 CSS px 로.
   사진 위에 얹힌 어두운 반투명 면(말풍선·칸)의 가장자리를 찾을 때 쓴다. 짧은 구간(4px 미만)은 버린다."""
import sys
import numpy as np
from PIL import Image
S = 'C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/phone/'
name, mode, pos = sys.argv[1], sys.argv[2], float(sys.argv[3])
thr = int(sys.argv[4]) if len(sys.argv) > 4 else 80
im = np.asarray(Image.open(S + name + '.png').convert('RGB')).astype(int)
p = round(pos * 3)
line = im[p - 1:p + 2].max(axis=2).max(axis=0) if mode == 'h' else im[:, p - 1:p + 2].max(axis=2).max(axis=1)
dark = line < thr
runs = []; st = None
for i, d in enumerate(dark):
    if d and st is None: st = i
    if not d and st is not None:
        if i - st >= 12: runs.append((st, i))
        st = None
if st is not None and len(dark) - st >= 12: runs.append((st, len(dark)))
# 가까운 구간(글자 때문에 끊긴 것)은 잇는다
merged = []
for a, b in runs:
    if merged and a - merged[-1][1] <= 40: merged[-1] = (merged[-1][0], b)
    else: merged.append((a, b))
for a, b in merged: print('%7.2f..%7.2f (%.2f)' % (a / 3, b / 3, (b - a) / 3))
