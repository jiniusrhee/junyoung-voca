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

화면 맞춤의 전제 (2026-11-11 플립 대조로 확인, 자세한 치수는 docs/SPEC.md 맨 끝 절):

- 폰에서는 viewport 를 `width=360` 으로 고정한다(index.html 의 스크립트 + MainActivity 의 `setUseWideViewPort`). 말해보카가 화면 폭에 맞춰 통째로 커지는 앱이라서, 치수는 모두 "폭 360 기준 CSS px" 로 적는다.
- 한글은 전역 자간 `--ls`(-0.0864em)로 좁힌다(styles.css 맨 위 `*` 규칙). 영어·숫자가 주인 요소는 `lang="en"` 을 주거나 `--ls: 0`, 한글 문장 속 영어·숫자는 `components/KoText.tsx` 로 감싼다.
- `quiz.css` 의 선택자는 `#root .vocab-quiz …` 로 시작한다(styles.css 의 옛 규칙·다크 규칙보다 항상 우선). 새 규칙도 같은 꼴로 쓰고, 고친 뒤에는 기기에서 계산된 스타일을 확인한다(styles.css 의 padding·border·position 이 남아 있는 경우가 많다).
- 어휘 퀴즈 전용 아이콘은 `components/QuizIcons.tsx`(실측 크기 그대로의 SVG). 실제 앱 색은 디더링돼 있으므로 면 평균으로 잰다.
- 실제 기기에서 바로 고치기: `bash scripts/devtools/live-apk.sh` (디버그 앱 `com.junyoung.voca.debug` 가 개발 서버를 불러옴, Vite 는 `--host 127.0.0.1`).
- 눌림·전환 타이밍은 60fps 화면 녹화를 프레임 단위로 재서 맞췄다(docs/SPEC.md 맨 끝 "눌림·입력 반응 실측" 절). 고칠 때는 실제 앱과 같은 `adb shell input …` 스크립트로 양쪽을 녹화해 비교한다. 어휘 퀴즈의 카드 넘김(끌기)·다음 문제 미리 고르기는 `pages/Quiz.tsx` 의 "카드 끌기" 블록, 자판 눌림·길게 누르기는 `components/Keyboard.tsx`, 키 햅틱은 `SystemUiPlugin.haptic`(= `lib/statusBar.ts` 의 `keyHaptic`).

## 화면 전환·움직임 (2026-11-11 60fps 녹화 실측, 수치는 docs/SPEC.md 맨 끝 "3차" 절)

- 화면 전환은 `components/PageHost.tsx` 가 맡는다(Routes 를 감쌈). 규칙은 `lib/pageTransition.ts` 의 `transitionFor`: 탭·☰ 설정 메뉴 사이는 없음, 하위 화면은 오른쪽에서 밀려 들어옴/빠져나감, `/streak` 는 아래에서 올라옴. React 는 화면을 바로 바꾸고, 바뀌기 직전 화면은 DOM 복사본(`.pt-snap`)으로 깔거나 덮어 움직인다(`styles/transition.css`). 새 화면이 다 그려질 때까지(최대 0.2초) 이전 화면을 그대로 보여 준다. 새 하위 화면을 만들 때 머리줄은 화면 뿌리의 바로 아래 `<header>` 로 둘 것(머리줄만 먼저 바뀌게 하는 데 쓴다). 스크롤 위치 저장·복원도 여기서 한다.
- 화면을 다시 열 때 빈 프레임이 없도록 `lib/liveCache.ts` 를 쓴다: `useKeptQuery`(설정·하루 기록처럼 작고 자주 쓰는 것, 계속 구독), `useCachedQuery`(지난번 결과를 먼저 돌려줌). 탭 화면에서 `useLiveQuery` 를 그대로 쓰면 돌아올 때 서너 프레임 깜박인다.
- 홈(`pages/Home.tsx`, `styles/home.css`, 그림은 `components/HomeIcons.tsx`): 시작 버튼의 4초 주기 움직임(내려앉기·별 돌기·빛줄기), 리본 빛줄기, 켠 직후 순서(`.home.intro`), 학습에서 돌아왔을 때 다시 채우기(`.home.replay`, sessionStorage `homeReplay`), '오늘' 막대 자라기. 버튼의 턱은 움직이지 않는 받침(`.today-seat`)이라 면은 transform 만 움직인다 — box-shadow 를 같이 움직이면 다른 움직임과 박자가 어긋난다.
- 팝업: 어휘 학습 시작 창 `components/ExtraStudySheet.tsx` + `styles/startpop.css`, 하루 목표 `components/GoalModal.tsx` + `styles/goalpop.css`. 둘 다 실측 치수를 창 왼쪽 위 기준 절대 자리로 적었다.
- 켠 직후 시스템 막대 색: 스플래시가 걷힐 때 테마의 막대 색이 다시 입혀지므로 `android/.../values/styles.xml` 에 기본색을 두고, 웹에서 `reassertBars()`(lib/statusBar.ts)로 다시 칠한다.

## 2026-11-13 에 다시 만든 화면 (수치는 docs/SPEC.md 맨 끝 "2026-11-13" 절)

- 설정 하위 화면 `pages/ModeSettings.tsx` + `styles/modeset.css`(선택자 `.ms2 …`): 값은 아래에서 올라오는 시트(`.sheet-dim`)로 고른다. 즐겨찾기(홈 모드 탭 순서, '확인'을 눌러야 적용)와 왼손 사용자 모드(`settings.leftHanded` → `.home.lefty`)도 여기.
- 사전 `pages/Dictionary.tsx` + `styles/dict.css`(`.dict2 …`), 낱말 상세 `styles/worddetail.css`(`#root .word-page …`). 치는 대로 찾고, 뒤로 돌아오면 지난 검색이 남는다(모듈 변수 `lastQuery`).
- 목록 화면(좋아하는 문장·오답노트·학습한 어휘·내 단어장) `styles/lists.css`, `components/ListChrome.tsx`.
- 어휘 퀴즈의 음성 모드: `pages/Quiz.tsx` 의 `.voice-zone`(`.vz-*`) + 물속 풍경 `components/SeaScene.tsx`(직접 그린 SVG).
- 목표를 채우면 창이 뜨지 않고 '다음 문제'가 초록 '학습 완료'(`.big-btn.next.fin`)로 바뀐다. `Quiz.tsx` 의 `reachedTarget`. 누르면 홈으로(홈이 다시 채워짐).
- styles.css 에는 옛 일반 이름 규칙(`.finish`, `.toggle::after` 등)이 남아 있다. 새 클래스 이름을 지을 때 styles.css 를 먼저 grep 한다.
- `.github/workflows/apk.yml` 은 수동 실행 전용이지만 YAML 이 틀리면 push 마다 실패 메일이 온다. 고치면 `npx js-yaml .github/workflows/apk.yml` 로 확인.

## 2026-11-14 문법 학습 (수치는 docs/SPEC.md 맨 끝 "2026-11-14" 절)

- 문법 화면 `pages/GrammarQuiz.tsx` 는 어휘 퀴즈와 같은 틀을 쓴다: 뿌리 클래스 `quiz-screen vocab-quiz grammar-quiz`, 공통 조각 `components/QuizShell.tsx`(QuizScene·QuizTop·useStreakDone), 정답 패널 `AfterPanel`(tools·bigFirst·noBubble·above). 문법만의 규칙은 `styles/grammar.css`(`#root .grammar-quiz …`, 새 클래스는 `gq-` 로 시작 — styles.css 에 옛 `.g-*` 규칙이 남아 있다).
- 다른 학습 모드(리스닝·표현)를 실제 앱에 맞출 때도 같은 방식으로 한다(QuizShell + AfterPanel + 모드 전용 css).
- 칩 움직임: 놓이는 칩·돌아가는 칩은 `document.body` 에 붙인 `.gq-ghost` 가 0.15초 동안 날고, 남은 칩은 Web Animations 로 당겨진다(`beforeChange` → `useLayoutEffect`).
- 크기 단계 `tierOf`(보기 칩 폭의 합 ≤ 340 → 21px, > 650 → 19px), 순서 표시 `lib/grammar.ts` 의 `orderMarks`, 한 번에 맞힌 문제만 세는 `ModeDay.solved`/`modeSolved()`.
- 머리줄 동그라미는 `useStreakDone()` 이 거짓이면 트로피(`QTrophy`), 참이면 불꽃. "N 연속 학습!" 은 `components/StreakPopup.tsx` + `styles/streakpop.css`(학습 화면에서는 뜨지 않고, 닫히면 `streakpop-closed` 이벤트로 홈이 다시 채워진다).
- 풍경 `DinoScene` 은 물가 아래가 뚫려 있고 그 밑에 `SeaScene` 층이 깔린다(물속 층을 먼저 그린다). 문법 화면에서는 같은 그림이 14 아래.
- 스크래치패드(임시 폴더)의 오래된 도구 파일이 지워진 적이 있다(2026-11-14 cap.py). 다시 쓸 도구는 `scripts/devtools/` 에 둔다.

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
- 문장 읽기(`src/lib/speech.ts`): 웹에서는 speechSynthesis, 안드로이드 앱에서는 네이티브 플러그인 `TtsPlugin.java`(폰 내장 TextToSpeech). 안드로이드 WebView 에는 speechSynthesis 가 아예 없어서(2026-11-11 확인) 플러그인이 없으면 APK 에서 소리가 나지 않는다. 읽기를 멈출 때는 `stopSpeaking()`.

## 작업 규칙

- 콘텐츠를 추가할 때는 CONTENT.md의 순서를 따르고 `content:validate` 오류 0개를 확인한 뒤 커밋한다.
- 코드 변경 후 `npm test`와 `npm run build`가 통과해야 push한다. 커밋 조건은 반드시 명령 자체의 종료 코드(`T=$?`, `[ "$T" = 0 ]`)로 건다. "Tests N passed" 줄을 grep 하는 방식은 "1 failed | 58 passed" 에도 걸리므로 쓰지 않는다 (2026-10-25 실제로 실패 테스트가 push 된 적 있음).
