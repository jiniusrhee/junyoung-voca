"""mp4 구간을 잘라 몽타주: clip.py <mp4> <out.png> <start> <end> <fps> [crop x,y,w,h (영상 좌표)] [cols=8] [width=270]"""
import sys as _s; _s.stdout.reconfigure(encoding='utf-8', errors='replace')
import sys, os, subprocess, tempfile, glob, shutil
from PIL import Image, ImageDraw
mp4, out, st, en, fps = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])
crop = sys.argv[6] if len(sys.argv) > 6 and sys.argv[6] != '-' else None
cols = int(sys.argv[7]) if len(sys.argv) > 7 else 8
width = int(sys.argv[8]) if len(sys.argv) > 8 else 270
tmp = tempfile.mkdtemp()
vf = f'fps={fps}'
if crop:
    x, y, w, h = crop.split(','); vf += f',crop={w}:{h}:{x}:{y}'
vf += f',scale={width}:-1'
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', mp4, '-ss', str(st), '-to', str(en), '-vf', vf, os.path.join(tmp, 'f%03d.png')], check=True)
fs = sorted(glob.glob(os.path.join(tmp, 'f*.png'))); ims = [Image.open(f).convert('RGB') for f in fs]
if not ims: print('no frames'); sys.exit(1)
w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
c = Image.new('RGB', (cols * (w + 4), rows * (h + 4)), (40, 40, 40))
for i, im in enumerate(ims):
    dr = ImageDraw.Draw(im); t = st + i / fps; dr.rectangle((0, 0, 46, 13), fill=(0, 0, 0)); dr.text((2, 1), f'{t:.2f}s', fill=(255, 255, 0))
    c.paste(im, ((i % cols) * (w + 4), (i // cols) * (h + 4)))
c.save(out); shutil.rmtree(tmp); print(out, len(ims), c.size)
