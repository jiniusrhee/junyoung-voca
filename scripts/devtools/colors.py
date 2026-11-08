"""영역 최빈색 샘플: colors.py <png> "name:x,y,w,h" ...  (좌표는 그 이미지의 픽셀 좌표)"""
import sys as _s; _s.stdout.reconfigure(encoding='utf-8', errors='replace')
import sys
from PIL import Image
from collections import Counter
im = Image.open(sys.argv[1]).convert('RGB')
for spec in sys.argv[2:]:
    name, rect = spec.split(':'); x, y, w, h = map(int, rect.split(','))
    c = Counter(im.crop((x, y, x + w, y + h)).getdata())
    top = c.most_common(3)
    print(f'{name:14s}', ' '.join('#%02x%02x%02x(%d)' % (k + (v,)) for k, v in top))
