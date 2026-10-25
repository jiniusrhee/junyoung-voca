// public/icons/icon-512.png 로 안드로이드 런처 아이콘(mipmap)과 스플래시를 만든다. 사용: node scripts/make-android-icons.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const py = `
from PIL import Image
import os
root = ${JSON.stringify(fileURLToPath(new URL('../', import.meta.url)))}
src = Image.open(os.path.join(root, 'public/icons/icon-512.png')).convert('RGBA')
res = os.path.join(root, 'android/app/src/main/res')
sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for d, s in sizes.items():
    folder = os.path.join(res, f'mipmap-{d}'); os.makedirs(folder, exist_ok=True)
    src.resize((s, s), Image.LANCZOS).save(os.path.join(folder, 'ic_launcher.png'))
    src.resize((s, s), Image.LANCZOS).save(os.path.join(folder, 'ic_launcher_round.png'))
    # 적응형 아이콘 전경: 108dp 캔버스에 66dp 안전 영역 → 아이콘을 60% 로 가운데
    fg = int(s * 108 / 48); canvas = Image.new('RGBA', (fg, fg), (0, 0, 0, 0))
    inner = int(fg * 0.62); ic = src.resize((inner, inner), Image.LANCZOS)
    canvas.paste(ic, ((fg - inner) // 2, (fg - inner) // 2), ic)
    canvas.save(os.path.join(folder, 'ic_launcher_foreground.png'))
# 스플래시: 어두운 배경 가운데 아이콘
for d, w in {'port-mdpi': 320, 'port-hdpi': 480, 'port-xhdpi': 720, 'port-xxhdpi': 1080, 'port-xxxhdpi': 1440}.items():
    folder = os.path.join(res, f'drawable-{d}'); os.makedirs(folder, exist_ok=True)
    h = int(w * 16 / 9); bg = Image.new('RGBA', (w, h), (23, 24, 28, 255))
    inner = int(w * 0.3); ic = src.resize((inner, inner), Image.LANCZOS)
    bg.paste(ic, ((w - inner) // 2, (h - inner) // 2), ic); bg.save(os.path.join(folder, 'splash.png'))
bg = Image.new('RGBA', (1080, 1920), (23, 24, 28, 255)); ic = src.resize((320, 320), Image.LANCZOS)
bg.paste(ic, (380, 800), ic); os.makedirs(os.path.join(res, 'drawable'), exist_ok=True); bg.save(os.path.join(res, 'drawable', 'splash.png'))
print('icons ok')
`;
console.log(execFileSync('python', ['-c', py], { encoding: 'utf-8' }));
