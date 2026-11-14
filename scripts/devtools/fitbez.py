"""fitbez.py "<frame:progress,...>" : 관측한 진행률에 가장 잘 맞는 cubic-bezier(x1,y1,x2,y2)·시작 프레임·길이(프레임)를 격자 탐색으로 찾는다."""
import sys
import itertools

obs = [(float(a), float(b)) for a, b in (p.split(':') for p in sys.argv[1].split(','))]


def bez(x1, y1, x2, y2, t):
    if t <= 0:
        return 0.0
    if t >= 1:
        return 1.0
    lo, hi = 0.0, 1.0
    for _ in range(24):
        m = (lo + hi) / 2
        x = 3 * (1 - m) ** 2 * m * x1 + 3 * (1 - m) * m * m * x2 + m ** 3
        if x < t:
            lo = m
        else:
            hi = m
    m = (lo + hi) / 2
    return 3 * (1 - m) ** 2 * m * y1 + 3 * (1 - m) * m * m * y2 + m ** 3


best = []
grid = [i / 10 for i in range(0, 11)]
f0s = [obs[0][0] - 1.5 + 0.25 * k for k in range(0, 7)]
durs = [d / 2 for d in range(12, 30)]
for x1, y1, x2, y2 in itertools.product(grid, [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0], grid, [0.6, 0.8, 0.9, 1.0]):
    for f0 in f0s:
        for d in durs:
            e = sum((bez(x1, y1, x2, y2, (f - f0) / d) - p) ** 2 for f, p in obs)
            best.append((e, x1, y1, x2, y2, f0, d))
best.sort()
for e, x1, y1, x2, y2, f0, d in best[:8]:
    print(f'err {e:.4f}  cubic-bezier({x1},{y1},{x2},{y2})  start f{f0:.2f}  dur {d:.1f} fr = {d / 60 * 1000:.0f} ms')
# 흔한 곡선들과 비교
for nm, c in [('linear', (0, 0, 1, 1)), ('ease', (.25, .1, .25, 1)), ('ease-out', (0, 0, .58, 1)), ('ease-in-out', (.42, 0, .58, 1)), ('quad-out', (.25, .46, .45, .94)), ('cubic-out', (.215, .61, .355, 1)), ('sine-inout', (.445, .05, .55, .95))]:
    r = min((sum((bez(*c, (f - f0) / d) - p) ** 2 for f, p in obs), f0, d) for f0 in f0s for d in durs)
    print(f'{nm:12s} err {r[0]:.4f} start f{r[1]:.2f} dur {r[2]:.1f} fr = {r[2] / 60 * 1000:.0f} ms')
