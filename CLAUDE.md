# 준영보카 (junyoung-voca)

말해보카 학습 방식과 화면을 1인용으로 재구현한 PWA. 사용자(Junyoung) 본인만 안드로이드 Chrome에서 사용. 리그·캐릭터 꾸미기·다중 사용자·유료 원어민 음성·발음 정밀 진단은 만들지 않음.
외부 유료 API를 쓰지 않는다. 단어 데이터는 Claude 세션 안에서 직접 작성해 JSON 팩으로 저장한다. 말해보카의 캐릭터·로고·문구 데이터는 복사하지 않는다(마스코트는 직접 그린 SVG).

## 스택

Vite + React + TypeScript, Dexie(IndexedDB), ts-fsrs(복습 스케줄), vite-plugin-pwa, HashRouter. 글꼴은 폰 기본 글꼴(system-ui) — 갤럭시에서는 말해보카와 같은 글꼴로 보이므로 웹 폰트를 넣지 않는다. 배포는 GitHub Pages (`base: /junyoung-voca/`).

## 명령

- `npm run dev` / `npm test` / `npm run build` (prebuild에서 콘텐츠 검증 + manifest 생성)
- `npm run content:validate`, `npm run content:coverage [레벨]`
- 안드로이드 APK: `npm run build:native`(base `/` 로 빌드 + cap sync) → `cd android && ./gradlew assembleRelease` (JDK 21, 서명 키는 `~/.junyoung-voca/`). 일반 `npm run build` 결과를 APK 에 넣으면 경로가 `/junyoung-voca/` 라 빈 화면이 뜬다. 폰 뒤로 가기는 `src/lib/nativeBack.ts`(App 플러그인) 가 처리한다.
- APK 배포·자동 업데이트: **package.json 의 version 을 올린 뒤** `npm run release:apk -- "릴리스 메모"` (테스트 → 빌드 → 서명 → GitHub 릴리스 `latest` 에 업로드 → 설명에 `version=`/`versionCode=` 기록). versionCode = major×10000 + minor×100 + patch 로 gradle·vite·스크립트가 같은 공식을 쓴다. 설치된 앱은 켜질 때 그 릴리스를 읽어 새 버전이면 안내 시트를 띄우고 APK 를 내려받아 설치 화면을 연다(`src/lib/appUpdate.ts`, `components/UpdateSheet.tsx`, `android/.../AppUpdaterPlugin.java`). 같은 버전으로 다시 올리면 앱이 새 버전으로 보지 않으므로 반드시 버전을 올린다.

## 화면별 스타일 파일

`src/styles.css` 가 공통이고, 말해보카 실측값으로 맞춘 화면은 `src/styles/<화면>.css`(quiz·home·all·stats·settings)가 뒤에 로드되어 덮어쓴다. 그 화면을 고칠 때는 해당 파일을 먼저 본다. 어휘 퀴즈의 치수·색·타이밍 실측치는 docs/SPEC.md 맨 끝 "어휘 퀴즈 실측" 절에 있다.

## 비교·캡처 도구

`scripts/devtools/`(README 참고): 플립·에뮬레이터 캡처(cap.py), OCR 탭(tw.py), 말해보카 자판 입력(kb.py), 녹화·키프레임(rec.sh·kf.py·clip.py), WebView 조작(remote.mjs·drive.mjs), APK 없이 개발 서버 + 헤드리스 Chrome 캡처(shot.mjs). 실제 앱 캡처·영상은 `ref/flip/`(git 제외).

## 화면 구조 (말해보카 기준)

- 퀴즈(`src/pages/Quiz.tsx`): 하늘색 배경 + 풍경(`components/DinoScene.tsx`, 정답마다 익룡 `Pterodactyls.tsx`), 레벨 탭이 붙은 카드(`components/QuizCard.tsx`), New / N일 전 / 재도전 / N 뒤 복습 배지, 앱 자체 자판(`components/Keyboard.tsx`, 폰 기본 키보드를 띄우지 않음, 아포스트로피 키는 정답에 있을 때만), 보라색 입력 말풍선, 힌트 2단계(앞 2글자 → 정답 보기: 입력이 비워지고 정답이 비침), 정답 입력 시 자동 채점(하이픈 단어는 칸을 나눔), 오타는 '!' 도장 + 연보라 말풍선(실시간 갱신), 오답은 카드가 1초 붉게, 정답 후 0.55초 뒤 배지·♥, 0.9초 뒤 자판↔패널 슬라이드(`components/AfterPanel.tsx`: 다른 예문·오답 노트는 카드 자리의 `InfoCard.tsx`, 말해보기, 단어 정보, 듣기평가 속도/다시 듣기/다음 문제, '^' → `ExtraSheet.tsx`), 레벨 '?' 팝업 `LevelHelp.tsx`, 하루 목표 달성 트로피 팝업. 학습 화면 상태바 색은 `lib/statusBar.ts`.
- 홈: 연속 학습 카드(주간 출석), 진행률 링 + 오늘의 어휘/추가 학습 버튼, 하루 목표 팝업, 학습 정보, 나의 어휘력, 좋아하는 문장/오답노트/학습한 어휘/사전 목록. 하단 탭: 어휘·기록·사전·설정.

## 학습 모드 (docs/SPEC.md 에 실제 앱 관찰 기록)

- 어휘 `/quiz`, 문법 `/grammar` (단어 카드 배열, `src/lib/grammar.ts`), 리스닝 `/listening` (객관식 단어 버튼 / 주관식 음성·키보드, `src/lib/listening.ts`), 발음 구분 연습 `/pairs`
- 표현 `/expr` (코스 지도 → `/expr/quiz` 패턴 빈칸, 길이 보기 → 힌트 → 정답, `src/lib/expr.ts`), 코스 선택 `/expr/courses`, 일별 학습 문장 `/expr/notebook`, 표현 사전 `/expr-dict/:key`
- 실전 회화 `/talk` (스토리 캐러셀·문장 복습·카테고리) → `/talk/:story/:ep` (인트로 → 대화 → 결과), 난이도 `/talk/level`(CEFR), 채점은 AI 없이 핵심 표현 포함 + 단어 겹침 F1 (`src/lib/talk.ts`), 진행은 kv `talkProgress`, 좋아요한 표현은 kv `myExpressions`
- 장면 그림은 `components/SceneArt.tsx`(직접 그린 SVG), 문장 자판은 `components/SentenceKeyboard.tsx`
- 어휘 외 모드의 복습 카드는 `mcards` 테이블(`${mode}:${itemId}`), 하루 기록은 `daily.byMode`, 기록 함수는 `src/lib/modeStudy.ts`
- 문법 데이터 `public/data/grammar/g-XX.json` (주제 + 설명글 + 문장), 발음 데이터 `public/data/pairs/pairs.json`, 표현 코스 `public/data/expr/<course>.json`, 회화 스토리 `public/data/talk/<story>.json`, 검증 `npm run content:validate` (규칙은 `scripts/lib/validate-extra.mjs`)
- 리스닝 문장은 어휘 예문과 문법 문장을 재사용
- 제외: 리그, 캐릭터 꾸미기, 유료 원어민 음성, 발음 정밀 진단, AI 질문 답변

## 로직

- `src/lib/scheduler.ts` FSRS 래퍼와 등급 규칙. 처음 본 단어를 깨끗하게 맞히면 KNOWN_WORD_DAYS(180일) 뒤로.
- `src/lib/text.ts` 채점(`evaluate`: 정답/alts/기본형/오타/오답), 빈칸 배치, 힌트.
- `src/lib/session.ts` 출제 순서(StudyPicker)와 레벨 테스트(LevelTest). 순수 로직은 `levelLogic.ts`.
- `src/lib/content.ts` `data/manifest.json` 해시 비교로 바뀐 팩만 동기화.
- `public/data/words/level-XX.json` 단어 팩. 작성 규칙은 CONTENT.md.
- 하루 경계는 04:00 (`src/lib/time.ts`).

## 작업 규칙

- 콘텐츠를 추가할 때는 CONTENT.md의 순서를 따르고 `content:validate` 오류 0개를 확인한 뒤 커밋한다.
- 코드 변경 후 `npm test`와 `npm run build`가 통과해야 push한다. 커밋 조건은 반드시 명령 자체의 종료 코드(`T=$?`, `[ "$T" = 0 ]`)로 건다. "Tests N passed" 줄을 grep 하는 방식은 "1 failed | 58 passed" 에도 걸리므로 쓰지 않는다 (2026-10-25 실제로 실패 테스트가 push 된 적 있음).
