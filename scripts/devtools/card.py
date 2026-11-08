"""card.py <정답> [스크린샷이름]: 정답 입력 → 패널 뜨면 '다음 문제' 탭 → 새 카드 OCR 출력. 패널이 안 뜨면 현재 OCR 출력."""
import sys as _s; _s.stdout.reconfigure(encoding='utf-8', errors='replace')
import sys, os, time, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kb, tw
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def shot_ocr(name):
    p = os.path.join(S, 'phone', name + '.png'); tw.shot(p); return tw.ocr(p)
word = sys.argv[1]; name = sys.argv[2] if len(sys.argv) > 2 else 'card'
kb.run(word, 0.15); time.sleep(3.5)
rows = shot_ocr(name + '_ok')
hit = [r for r in rows if '다음' in r[4].replace(' ', '')]
if not hit:
    print('NOT-ANSWERED'); [print(r[1], r[4]) for r in rows[1:16]]; sys.exit(1)
x, y, w, h, t = hit[0]; kb.tap(x + w // 2, y + h // 2 - 40); time.sleep(3)
rows = shot_ocr(name + '_next')
for r in rows[1:18]: print(r[0], r[1], r[2], r[4])
