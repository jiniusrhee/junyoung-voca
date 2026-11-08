"""말해보카(플립 1080x2636) 자판 입력: kb.py "<문자열>" [--gap 초]  (ANDROID_SERIAL 기기)
   문자열의 특수 토큰: {bs} 지우기, {ok} 확인, {sp} 띄어쓰기, {hint} 힌트 보기, {voice} 음성 모드, {w0.5} 0.5초 대기"""
import sys as _s; _s.stdout.reconfigure(encoding='utf-8', errors='replace')
import sys, os, subprocess, time, re
adb = os.path.join(os.environ['LOCALAPPDATA'], 'Android', 'platform-tools', 'adb.exe')
ROWS = {'qwertyuiop': (56, 2076), 'asdfghjkl': (110, 2216), 'zxcvbnm': (218, 2356)}
STEP = 107.4
SPECIAL = {'bs': (1010, 2356), 'ok': (942, 2500), 'sp': (540, 2500), 'hint': (154, 1930), 'voice': (924, 1930), 'shift': (66, 2356), 'wide': (136, 2500)}
def pos(ch):
    for row, (x0, y) in ROWS.items():
        if ch in row: return (round(x0 + STEP * row.index(ch)), y)
    if ch == ' ': return SPECIAL['sp']
    raise KeyError(ch)
def tap(x, y): subprocess.run([adb, 'shell', 'input', 'tap', str(x), str(y)], check=True)
def run(s, gap=0.35):
    for tok in re.findall(r'\{[^}]*\}|.', s):
        if tok.startswith('{'):
            t = tok[1:-1]
            if t.startswith('w'): time.sleep(float(t[1:])); continue
            tap(*SPECIAL[t])
        else: tap(*pos(tok.lower()))
        time.sleep(gap)
if __name__ == '__main__':
    args = sys.argv[1:]; gap = 0.35
    if '--gap' in args: i = args.index('--gap'); gap = float(args[i+1]); del args[i:i+2]
    run(args[0], gap); print('typed', args[0])
