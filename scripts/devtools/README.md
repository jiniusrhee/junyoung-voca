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
