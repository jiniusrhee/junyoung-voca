"""말해보카 실전 회화의 문장 자판(플립 1080x2636) 입력: kb2.py "<문자열>" [--gap 초] [--dy 픽셀]
   글자·띄어쓰기·쉼표·마침표는 그대로, 토큰: {bs} 지우기, {ok} 확인, {shift}, {123}, {hint} 힌트 보기, {voice} 음성 모드, {w0.5} 0.5초 대기
   --dy: 자판이 통째로 위아래로 옮겨진 화면(우리 앱 등)에서 y 를 더한다"""
import sys as _s; _s.stdout.reconfigure(encoding='utf-8', errors='replace')
import sys, os, subprocess, time, re
adb = os.path.join(os.environ['LOCALAPPDATA'], 'Android', 'platform-tools', 'adb.exe')
ROWS = {'qwertyuiop': (69, 2043), 'asdfghjkl': (120, 2192), 'zxcvbnm': (226, 2340)}
STEP = 105.3
SPECIAL = {'bs': (994, 2340), 'ok': (965, 2489), 'sp': (541, 2489), 'shift': (85, 2340), '123': (115, 2489), ',': (271, 2489), '.': (812, 2489), 'hint': (230, 1895), 'voice': (880, 1895)}
DY = 0
def pos(ch):
    for row, (x0, y) in ROWS.items():
        if ch in row: return (round(x0 + STEP * row.index(ch)), y)
    if ch == ' ': return SPECIAL['sp']
    if ch in SPECIAL: return SPECIAL[ch]
    raise KeyError(ch)
def tap(x, y): subprocess.run([adb, 'shell', 'input', 'tap', str(x), str(y + DY)], check=True)
def run(s, gap=0.2):
    for tok in re.findall(r'\{[^}]*\}|.', s):
        if tok.startswith('{'):
            t = tok[1:-1]
            if re.fullmatch(r'w[\d.]+', t): time.sleep(float(t[1:])); continue
            tap(*SPECIAL[t])
        else: tap(*pos(tok.lower()))
        time.sleep(gap)
if __name__ == '__main__':
    args = sys.argv[1:]; gap = 0.2
    if '--gap' in args: i = args.index('--gap'); gap = float(args[i+1]); del args[i:i+2]
    if '--dy' in args: i = args.index('--dy'); DY = int(args[i+1]); del args[i:i+2]
    run(args[0], gap); print('typed', args[0])
