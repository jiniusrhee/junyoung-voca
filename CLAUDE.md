# 준영보카 (junyoung-voca)

말해보카 학습 방식을 1인용으로 재구현한 PWA. 사용자(Junyoung) 본인만 안드로이드 Chrome에서 사용. 리그·캐릭터·다중 사용자 기능은 만들지 않음.
외부 유료 API를 쓰지 않는다. 단어 데이터는 Claude 세션 안에서 직접 작성해 JSON 팩으로 저장한다.

## 스택

Vite + React + TypeScript, Dexie(IndexedDB), ts-fsrs(복습 스케줄), vite-plugin-pwa, HashRouter. 배포는 GitHub Pages (`base: /junyoung-voca/`).

## 명령

- `npm run dev` / `npm test` / `npm run build` (prebuild에서 콘텐츠 검증 + manifest 생성)
- `npm run content:validate`, `npm run content:coverage [레벨]`

## 구조

- `src/lib/scheduler.ts` FSRS 래퍼와 등급 규칙. 처음 본 단어를 깨끗하게 맞히면 KNOWN_WORD_DAYS(180일) 뒤로.
- `src/lib/session.ts` 출제 순서(StudyPicker)와 레벨 테스트(LevelTest). 순수 로직은 `levelLogic.ts`.
- `src/lib/content.ts` `data/manifest.json` 해시 비교로 바뀐 팩만 동기화.
- `public/data/words/level-XX.json` 단어 팩. 작성 규칙은 CONTENT.md.
- 하루 경계는 04:00 (`src/lib/time.ts`).

## 작업 규칙

- 콘텐츠를 추가할 때는 CONTENT.md의 순서를 따르고 `content:validate` 오류 0개를 확인한 뒤 커밋한다.
- 코드 변경 후 `npm test`와 `npm run build`가 통과해야 push한다.
