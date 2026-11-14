"""ab2.py real ours out x,y,w,h dy [zoom] : 실제(위/왼쪽)·우리(가운데)·겹침. 우리 쪽은 y 를 dy(CSS px)만큼 빼서 자른다 (ours_y = real_y - dy)"""
import sys
from PIL import Image, ImageChops
S = 'C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/phone/'
real, ours, out = sys.argv[1:4]
box = [float(v) for v in sys.argv[4].split(',')]
dy = round(float(sys.argv[5]) * 3); zoom = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0
A = Image.open(S + real + '.png').convert('RGB'); B = Image.open(S + ours + '.png').convert('RGB')
x, y, w, h = [round(v * 3) for v in box]
a = A.crop((x, y, x + w, y + h)); b = B.crop((x, y - dy, x + w, y - dy + h))
if zoom != 1:
    sz = (round(w * zoom), round(h * zoom)); a = a.resize(sz, Image.LANCZOS); b = b.resize(sz, Image.LANCZOS)
W, H = a.size
diff = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 28 else 0)
ov = Image.blend(a, b, 0.5); red = Image.new('RGB', (W, H), (255, 0, 0)); ov2 = Image.composite(red, ov, diff)
if W > H * 1.3:
    c = Image.new('RGB', (W, H * 3 + 16), (255, 0, 255)); c.paste(a, (0, 0)); c.paste(b, (0, H + 8)); c.paste(ov2, (0, 2 * H + 16))
else:
    c = Image.new('RGB', (W * 3 + 16, H), (255, 0, 255)); c.paste(a, (0, 0)); c.paste(b, (W + 8, 0)); c.paste(ov2, (2 * W + 16, 0))
c.save(S + out + '.png'); print(out, c.size, 'diff %.2f%%' % (100.0 * sum(1 for v in diff.getdata() if v) / (W * H)))
