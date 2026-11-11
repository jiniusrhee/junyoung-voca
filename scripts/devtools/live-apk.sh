#!/bin/bash
# 라이브 디버그 APK: 폰의 준영보카 테스트 앱(com.junyoung.voca.debug)이 PC 의 Vite 개발 서버 화면을 그대로 불러온다(HMR).
# 실제 기기 글꼴·WebView 로 바로 확인하면서 CSS 를 고칠 수 있다. 사용법: bash scripts/devtools/live-apk.sh  (ANDROID_SERIAL 로 기기 선택)
# 전제: `npx vite --port 5180 --strictPort` 가 돌고 있을 것. 끝나면 일반 디버그/릴리스 빌드는 평소대로(build:native 가 설정을 다시 만든다).
set -euo pipefail
cd "$(dirname "$0")/../.."
export JAVA_HOME="${JAVA_HOME:-C:/Program Files/Eclipse Adoptium/jdk-21.0.12.8-hotspot}"
ADB="$LOCALAPPDATA/Android/platform-tools/adb.exe"
CFG=android/app/src/main/assets/capacitor.config.json
[ -f "$CFG" ] || npm run build:native >/dev/null
node -e "
const fs=require('fs');const p='$CFG';const c=JSON.parse(fs.readFileSync(p,'utf8'));
c.server={...(c.server||{}),url:'http://localhost:5180/junyoung-voca/',cleartext:true,androidScheme:'http'};
fs.writeFileSync(p,JSON.stringify(c,null,2));"
(cd android && ./gradlew assembleDebug -q)
"$ADB" install -r android/app/build/outputs/apk/debug/app-debug.apk | tail -1
"$ADB" reverse tcp:5180 tcp:5180
echo "live debug apk installed; dev server reversed on tcp:5180"
