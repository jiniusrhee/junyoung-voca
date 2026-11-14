# 개발·비교 도구 (2026-11-08)

실제 말해보카(갤럭시 Z 플립, 무선 adb)와 우리 앱(에뮬레이터·플립·헤드리스 Chrome)을 캡처·측정하는 스크립트. 결과물은 `out/`(git 제외).
Git Bash 에서 `/sdcard/...` 나 `"/all"` 같은 인자는 경로로 바뀌므로 `MSYS_NO_PATHCONV=1` 을 붙인다. 파이썬은 `PYTHONUTF8=1`.

- `cap.py <이름>`: adb 스크린샷 → out/phone/<이름>.png(원본) + _s.png(540폭). `ANDROID_SERIAL` 로 기기 선택.
- `tw.py <글자>|--list`: Windows OCR(`ocr.ps1`)로 화면 글자를 찾아 탭. 말해보카(cocos2dx)처럼 접근성 트리가 없는 앱용.
- `kb.py "<글자>{bs}{ok}{hint}"`: 말해보카 자판 좌표(플립 1080x2636) 입력. `card.py <정답> <이름>`: 정답 입력 → 다음 문제 → 새 카드 OCR.
- `rec.sh <이름> <초> [fps]`: adb screenrecord → mp4 + 프레임 + 필름 스트립. `kf.py <프레임폴더> <출력접두> [fps] [임계] [최대]`: 변화 구간 키프레임 스트립. `clip.py <mp4> <out.png> <시작> <끝> <fps> [crop x,y,w,h]`: 구간 몽타주. `colors.py <png> "이름:x,y,w,h"...`: 영역 최빈색.
- `remote.mjs "<js>"`: 우리 앱 WebView(DevTools, 기본 9224, `DEVTOOLS_PORT`)에서 JS 실행. 디버그 APK만 가능. `adb forward tcp:9224 localabstract:webview_devtools_remote_<pid>` 먼저.
- `drive.mjs <시나리오>`: vocab/walk/shots/qstates/qrec/qtime 등 자동 조작 + 캡처(에뮬레이터·플립).
- `shot.mjs "<해시>" out.png [--w 360 --h 820 --dpr 3] [--click 글자] [--eval js]`: 개발 서버(5180) + 헤드리스 Chrome(`--remote-debugging-port=9333`, `CDP_PORT`)으로 APK 없이 화면 캡처. 설정을 레벨 30·다크·다이노로 심고 TTS 를 무음 처리한다. `qanswer.js` 는 현재 카드 정답을 IndexedDB 에서 찾아 자판으로 치는 `--eval` 용 스니펫.
- 실제 앱 캡처·영상·실측 메모는 `ref/flip/`(git 제외, 2026-11-08), 요약은 docs/SPEC.md.

## 2026-11-14 추가: 치수·타이밍 측정 도구

세션 임시 폴더에 두었던 것을 옮겨 둔 것. 스크립트 안의 `S = '…/scratchpad/…'` 경로는 그때의 임시 폴더이므로 쓰기 전에 캡처·프레임이 있는 폴더로 고친다.
캡처는 `<S>/phone/<이름>.png`(1080x2636), 녹화 프레임은 `<S>/video/<이름>/f####.png`(540 폭)를 본다. 좌표는 화면 폭 360 기준 CSS px(= 기기 px ÷ 3).

- `hscan.py <이름> <y> [x0 x1] [임계]` / `vscan.py <이름> <x기기px> [y0 y1]`: 가로줄·세로줄에서 색이 바뀌는 자리.
- `tb.py <이름> <임계> x,y,w,h…`: 영역 안 밝은(임계 앞에 `-` 면 어두운) 글자의 상자. `cb.py <이름> x,y,w,h rrggbb 허용오차 [이름] [rows]`: 그 색에 가까운 픽셀의 상자(줄마다 가로 범위).
- `ink.py <이름> x,y,w,h [임계] [틈]`: 배경과 다른 덩어리를 줄·칸별로. `tick.py <png> <bx> <by> x0 x1 y0 y1`: 흰 그림의 줄별 윤곽(아이콘 따라 그리기).
- `ab2.py <실제> <우리> <출력> x,y,w,h dy [확대]`: 실제·우리·겹침(다른 곳은 빨강). `shore.py <이름> y0 y1 [간격]`: 풍경의 언덕·풀·물가 경계.
- `recdo.sh <이름> <초> "<기기 셸 스크립트>" [fps]`: 녹화하면서 `input tap …` 실행 → 프레임 추출. 실제 앱과 우리 앱에 같은 스크립트를 쓴다.
- `chg.py <영상> [x,y,w,h] [최소픽셀] [접두] [틈]`: 프레임 사이에 변화가 있는 구간(영역별로 돌려 타이밍을 잰다). `gstrip.py <영상> <출력> <프레임들> <crop|-> [배율] [접두]`: 프레임 조각을 이어 붙임.
- `fly.py <영상> <기준프레임> x,y,w,h <a> <b>`: 기준 프레임의 조각이 각 프레임에서 어디 있는지(움직임 궤적). `fitbez.py "<프레임:진행률,…>"`: 가장 잘 맞는 cubic-bezier·길이.
- `gcard.sh <이름>`: 실제 앱 문법 화면에서 머리줄 + 카드 + 보기 칸만 작게 저장. `w.sh`: 기기 조작 함수 모음(c·tap·oev·ogo·ours_start·real_front…).
