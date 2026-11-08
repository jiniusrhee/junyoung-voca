"""키프레임 분석: kf.py <frames_dir> <out_prefix> [fps=10] [thresh=2.0] [max=12]
연속 프레임 차이(0~255 평균)를 출력하고, 변화가 큰 구간의 프레임을 골라 시간 라벨을 붙인 스트립을 만든다."""
import sys as _s; _s.stdout.reconfigure(encoding='utf-8', errors='replace')
import sys, os, glob
from PIL import Image, ImageChops, ImageStat, ImageDraw
d, out = sys.argv[1], sys.argv[2]
fps = float(sys.argv[3]) if len(sys.argv) > 3 else 10
th = float(sys.argv[4]) if len(sys.argv) > 4 else 2.0
mx = int(sys.argv[5]) if len(sys.argv) > 5 else 12
fs = sorted(glob.glob(os.path.join(d, 'f*.png')))
ims = [Image.open(f).convert('RGB') for f in fs]
diffs = [0.0]
for a, b in zip(ims, ims[1:]):
    diffs.append(sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3)
# 타임라인 출력 (변화 있는 프레임만)
line = []
for i, dv in enumerate(diffs):
    if dv >= th: line.append(f'{i+1:03d}@{i/fps:.1f}s:{dv:.1f}')
print('changes:', ' '.join(line) if line else '(none)')
# 변화 구간: 연속된 변화 프레임 묶음
segs = []; cur = None
for i, dv in enumerate(diffs):
    if dv >= th:
        if cur and i - cur[1] <= 2: cur[1] = i
        else:
            cur = [i, i]; segs.append(cur)
print('segments:', ' '.join(f'{a+1:03d}-{b+1:03d}({a/fps:.1f}-{b/fps:.1f}s)' for a, b in segs))
def strip(idxs, path):
    sel = [ims[i] for i in idxs]
    W = sum(i.width for i in sel) + 4 * (len(sel) - 1); H = sel[0].height
    c = Image.new('RGB', (W, H), (40, 40, 40)); x = 0
    for i, im in zip(idxs, sel):
        im = im.copy(); dr = ImageDraw.Draw(im); dr.rectangle((0, 0, 70, 14), fill=(0, 0, 0)); dr.text((2, 2), f'{i+1:03d} {i/fps:.1f}s', fill=(255, 255, 0))
        c.paste(im, (x, 0)); x += im.width + 4
    c.save(path)
# 구간마다 스트립: 구간 시작 직전 1장 + 구간 프레임(최대 mx장 균등) + 끝난 뒤 1장
for k, (a, b) in enumerate(segs):
    idxs = list(range(max(a - 1, 0), min(b + 2, len(ims))))
    if len(idxs) > mx:
        step = (len(idxs) - 1) / (mx - 1); idxs = [idxs[round(j * step)] for j in range(mx)]
    strip(idxs, f'{out}_{k:02d}.png'); print(f'{out}_{k:02d}.png', idxs[0]+1, idxs[-1]+1)
