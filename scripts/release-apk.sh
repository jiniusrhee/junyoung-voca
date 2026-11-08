#!/bin/bash
# 릴리스 APK 를 빌드해 GitHub 릴리스 "latest" 에 올린다. 앱의 자동 업데이트는 이 릴리스의 설명(version=, versionCode=)을 읽는다.
# 사용법: npm run release:apk -- "릴리스 메모(선택)"
# 전제: package.json 의 version 을 올려 두었을 것 (versionCode = major*10000 + minor*100 + patch, android/app/build.gradle 과 같은 공식),
#       서명 키 ~/.junyoung-voca/, JDK 21, gh 로그인.
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-C:/Program Files/Eclipse Adoptium/jdk-21.0.12.8-hotspot}"

V=$(node -p "require('./package.json').version")
CODE=$(node -p "const [a=0,b=0,c=0]=require('./package.json').version.split('.').map(Number); a*10000+b*100+c")
NOTES="${1:-}"

npm test
npm run build:native
(cd android && ./gradlew assembleRelease -q)
cp android/app/build/outputs/apk/release/app-release.apk junyoung-voca.apk
cmp android/app/build/outputs/apk/release/app-release.apk junyoung-voca.apk

gh release view latest >/dev/null 2>&1 || gh release create latest --title "준영보카 APK v$V" --notes "version=$V"
gh release upload latest junyoung-voca.apk --clobber
BODY=$(printf 'version=%s\nversionCode=%s\n%s 빌드\n\n%s' "$V" "$CODE" "$(date +%F)" "$NOTES")
gh release edit latest --title "준영보카 APK v$V" --notes "$BODY"
echo "released v$V (versionCode $CODE): $(ls -la junyoung-voca.apk | awk '{print $5}') bytes"
