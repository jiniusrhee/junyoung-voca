# 준영보카 (junyoung-voca)

말해보카 학습 방식과 화면을 1인용으로 재구현한 PWA. 사용자(Junyoung) 본인만 안드로이드 Chrome에서 사용. 리그·캐릭터 꾸미기·다중 사용자·유료 원어민 음성·발음 정밀 진단은 만들지 않음.
외부 유료 API를 쓰지 않는다. 단어 데이터는 Claude 세션 안에서 직접 작성해 JSON 팩으로 저장한다. 말해보카의 캐릭터·로고·문구 데이터는 복사하지 않는다(마스코트는 직접 그린 SVG).

## 스택

Vite + React + TypeScript, Dexie(IndexedDB), ts-fsrs(복습 스케줄), vite-plugin-pwa, HashRouter, Pretendard 폰트(CDN). 배포는 GitHub Pages (`base: /junyoung-voca/`).

## 명령

- `npm run dev` / `npm test` / `npm run build` (prebuild에서 콘텐츠 검증 + manifest 생성)
- `npm run content:validate`, `npm run content:coverage [레벨]`

## 화면 구조 (말해보카 기준)

- 퀴즈(`src/pages/Quiz.tsx`): 하늘색 배경, 레벨 탭이 붙은 카드(`components/QuizCard.tsx`), New / N일 전 / N일 뒤 복습 배지, 앱 자체 자판(`components/Keyboard.tsx`, 폰 기본 키보드를 띄우지 않음), 보라색 입력 말풍선, 힌트 2단계(앞 1/3 → 정답 보기), 정답 입력 시 자동 채점, 오답 시 분홍 카드 + 설명 말풍선(초록/노랑/빨강), 정답 후 패널(`components/AfterPanel.tsx`: 다른 예문·오답 노트·말해보기·단어 정보, 실전 속도/다시 듣기/다음 문제), 하루 목표 달성 트로피 팝업.
- 홈: 연속 학습 카드(주간 출석), 진행률 링 + 오늘의 어휘/추가 학습 버튼, 하루 목표 팝업, 학습 정보, 나의 어휘력, 좋아하는 문장/오답노트/학습한 어휘/사전 목록. 하단 탭: 어휘·기록·사전·설정.

## 학습 모드 (docs/SPEC.md 에 실제 앱 관찰 기록)

- 어휘 `/quiz`, 문법 `/grammar` (단어 카드 배열, `src/lib/grammar.ts`), 리스닝 `/listening` (객관식 단어 버튼 / 주관식 음성·키보드, `src/lib/listening.ts`), 발음 구분 연습 `/pairs`
- 어휘 외 모드의 복습 카드는 `mcards` 테이블(`${mode}:${itemId}`), 하루 기록은 `daily.byMode`, 기록 함수는 `src/lib/modeStudy.ts`
- 문법 데이터 `public/data/grammar/g-XX.json` (주제 + 설명글 + 문장), 발음 데이터 `public/data/pairs/pairs.json`, 검증 `npm run content:validate` 와 `node scripts/validate-extra.mjs`
- 리스닝 문장은 어휘 예문과 문법 문장을 재사용
- 아직 없는 것: 표현 학습, 실전 회화 (실제 앱 화면 확인 필요)

## 로직

- `src/lib/scheduler.ts` FSRS 래퍼와 등급 규칙. 처음 본 단어를 깨끗하게 맞히면 KNOWN_WORD_DAYS(180일) 뒤로.
- `src/lib/text.ts` 채점(`evaluate`: 정답/alts/기본형/오타/오답), 빈칸 배치, 힌트.
- `src/lib/session.ts` 출제 순서(StudyPicker)와 레벨 테스트(LevelTest). 순수 로직은 `levelLogic.ts`.
- `src/lib/content.ts` `data/manifest.json` 해시 비교로 바뀐 팩만 동기화.
- `public/data/words/level-XX.json` 단어 팩. 작성 규칙은 CONTENT.md.
- 하루 경계는 04:00 (`src/lib/time.ts`).

## 작업 규칙

- 콘텐츠를 추가할 때는 CONTENT.md의 순서를 따르고 `content:validate` 오류 0개를 확인한 뒤 커밋한다.
- 코드 변경 후 `npm test`와 `npm run build`가 통과해야 push한다.
