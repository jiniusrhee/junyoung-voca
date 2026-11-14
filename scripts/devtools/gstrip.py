"""gstrip.py <video> <out> <frames: a-b[:step] or comma list> <crop x,y,w,h | -> [scale] [prefix=g] : 프레임 조각을 가로로 이어 붙임 (줄바꿈 cols=환경변수 COLS)"""
import sys, os
from PIL import Image, ImageDraw
S = 'C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad/'
name, out, spec = sys.argv[1:4]
crop = None if sys.argv[4] == '-' else [int(v) for v in sys.argv[4].split(',')]
scale = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0; prefix = sys.argv[6] if len(sys.argv) > 6 else 'g'
frames = []
for part in spec.split(','):
    if '-' in part:
        rng, _, st = part.partition(':'); a, b = rng.split('-'); frames += list(range(int(a), int(b) + 1, int(st or 1)))
    else: frames.append(int(part))
ims = []
for i in frames:
    p = f'{S}video/{name}/{prefix}{i:04d}.png'
    if not os.path.exists(p): continue
    im = Image.open(p).convert('RGB')
    if crop: im = im.crop((crop[0], crop[1], crop[0] + crop[2], crop[1] + crop[3]))
    if scale != 1: im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    d = ImageDraw.Draw(im); lab = str(i); d.rectangle((0, 0, 7 * len(lab) + 2, 11), fill=(0, 0, 0)); d.text((1, 0), lab, fill=(255, 255, 0)); ims.append(im)
cols = int(os.environ.get('COLS', len(ims))); rows = (len(ims) + cols - 1) // cols
w = max(i.width for i in ims); h = max(i.height for i in ims)
c = Image.new('RGB', (cols * (w + 3), rows * (h + 3)), (255, 0, 255))
for k, im in enumerate(ims): c.paste(im, ((k % cols) * (w + 3), (k // cols) * (h + 3)))
c.save(f'{S}phone/{out}.png'); print(out, c.size, len(ims))
