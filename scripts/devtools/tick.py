"""Trace the white tick in the finish button: per-row runs of white, in CSS px relative to the button's top-left."""
import sys
from PIL import Image

path = sys.argv[1]
bx0, by0 = float(sys.argv[2]), float(sys.argv[3])  # button top-left in device px
im = Image.open(path).convert('RGB')
W, H = im.size
x0, x1, y0, y1 = int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6]), int(sys.argv[7])
px = im.load()
rows = []
for y in range(y0, y1):
    runs = []
    start = None
    for x in range(x0, x1):
        r, g, b = px[x, y]
        white = r > 150 and b > 150
        if white and start is None:
            start = x
        if not white and start is not None:
            runs.append((start, x - 1))
            start = None
    if start is not None:
        runs.append((start, x1 - 1))
    if runs:
        rows.append((y, runs))
if not rows:
    print('no white')
    sys.exit()
ys = [r[0] for r in rows]
xs = [x for r in rows for run in r[1] for x in run]
print('bbox dev', min(xs), max(xs), min(ys), max(ys))
print('bbox css rel', round((min(xs) - bx0) / 3, 2), round((max(xs) + 1 - bx0) / 3, 2), round((min(ys) - by0) / 3, 2), round((max(ys) + 1 - by0) / 3, 2))
step = max(1, len(rows) // 30)
for y, runs in rows[::step]:
    print(round((y - by0) / 3, 2), ' '.join(f'{round((a - bx0) / 3, 2)}~{round((b + 1 - bx0) / 3, 2)}' for a, b in runs))
