# 단어 데이터 작성 가이드

단어 팩은 `public/data/words/level-XX.json` (XX = 01~30). 한 파일에 그 레벨의 단어들을 담는다.

```json
{
  "words": [
    {
      "id": "probably", "word": "probably", "pos": "adv", "level": 4,
      "meanings": ["아마"],
      "sentences": [
        {
          "en": "He'll ___ say yes.",
          "ko": "걔 **아마** 좋다고 할 거야.",
          "answer": "probably",
          "ctx": "친구 고백을 응원하며",
          "note": "그럴 확률이 80~90% 된다는 뜻",
          "alts": [
            { "w": "maybe", "t": "near", "m": "확률이 반반쯤일 때 maybe라고 해요." },
            { "w": "perhaps", "t": "wrong", "m": "perhaps는 맨 앞에 와야 자연스러워요." }
          ]
        }
      ],
      "nuance": "...",
      "etymology": "..."
    }
  ]
}
```

## 규칙

- `id`: 소문자 단어. 같은 단어가 다른 품사로 또 들어가면 `word_pos` (예: `increase_n`). 전체 팩에서 유일해야 한다.
- `pos`: n, v, adj, adv, prep, conj, pron, det, num, interj, phr 중 하나.
- `level`: 1(가장 일상적)~30(가장 격식·희귀). 파일 이름의 레벨과 같게.
- `meanings`: 한국어 뜻 1~3개. 핵심 뜻을 앞에.
- `sentences`: 2개 권장. 첫 문장은 기본형, 두 번째는 변화형이면 복습 때 번갈아 나와 좋다.
  - `en`: 빈칸 `___`(밑줄 3개). 빈칸은 1개이거나, 정답이 여러 단어로 떨어져 있으면 단어 수만큼(`Let's ___ ___ ten-minute ___.` + `take a break`). 문장 첫 단어에 빈칸을 두지 않는다.
  - `answer`: 빈칸에 들어갈 **그 문장에서의 형태**(achieved, carries 등).
  - `ko`: 자연스러운 번역. 빈칸 단어에 해당하는 부분을 `**굵게**` 한 쌍으로 표시(퀴즈에서 초록색).
  - `ctx` (선택, 30자 이하): 한국어 문장 위에 작게 보이는 상황 설명. 마침표 없이.
  - `note` (선택, 40자 이하): 같은 한국어 뜻에 영어 단어가 여럿일 때 구분해 주는 메모. 화면에 `※`가 붙는다.
  - `alts` (권장 2~3개): 학습자가 칠 법한 다른 답과 그 설명. 퀴즈에서 말풍선으로 뜬다.
    - `w`: 빈칸에 맞는 형태 그대로. 정답과 같으면 안 되고, 정답의 기본형이나 단순 오타는 넣지 않는다(앱이 자동 처리).
    - `t`: `ok`(정답으로 인정되는 유의어, 초록, 감점 없음) / `near`(비슷하지만 여기엔 안 맞는 말, 노랑) / `wrong`(오답, 빨강)
    - `m`: 해요체 한두 문장, 90자 이하. 정답 단어를 직접 쓰지 않는다. 큰따옴표 대신 작은따옴표.
- `nuance`: 비슷한 말과의 차이, 자주 쓰는 구조, 흔한 실수를 1~2문장으로.
- `etymology`: 선택. 짧게.

## 작업 순서 (새 세션에서 단어 추가할 때)

1. `npm run content:coverage [레벨]`로 아직 없는 흔한 단어를 확인한다. 사용자의 현재 레벨 ±2 범위부터 채운다.
2. 해당 `level-XX.json`의 `words` 배열에 항목을 추가한다 (한 번에 50~100개 정도씩). 셸 명령 길이 제한이 있으니 파일 쓰기 도구를 쓴다.
3. `npm run content:validate` → 오류 0개 확인.
4. `npm test`와 `npm run build`로 매니페스트 재생성과 빌드가 되는지 확인한다.
5. 커밋 메시지에 추가한 레벨과 개수를 적고 push. 배포되면 폰에서 앱을 열 때 자동으로 새 팩을 받는다.

## 표현 코스 (`public/data/expr/<course>.json`)

- `{ id, title, group, stars(1~3), icon('cup'|'plane'), order, patterns[], items[] }`
- 패턴 `{ id, ko('~로 계산할 수 있을까요?'), en('Can I pay with ~?'), meaning, note, order }`
- 문제 `{ id: '<course>-<pattern>-NN', pkey: '<course>:<pattern>', partner{en,ko}, en(빈칸 ___ 하나), answer(패턴 단어들), ko(정답 부분을 **…**로), alts[{w,t:'ok'|'near'|'wrong',m}], order }`
- 패턴마다 문제 2개 이상, alts 는 오답 노트에 그대로 보이므로 '왜 아닌지'를 해요체로 100자 이내

## 회화 스토리 (`public/data/talk/<story>.json`)

- `{ id, title, subtitle, category(일상|연애|학교|직장|여행|스페셜), cefr(A1~C2), scene(street|campus|office|city|home|cafe), order, episodes[] }`
- 에피소드 `{ id, title, partner, mission, lines[] }`, 내 대사 4개 이상
- 상대 대사 `{ who:'npc', en, ko }`, 내 대사 `{ who:'me', ko, answer, accept[1개 이상], keys[{k:'표현|다른 표현', tip}], hint, words[{ko,en}], expr?{en,ko,note} }`
- keys 의 각 변형은 answer 와 모든 accept 에 통째 단어로 들어 있어야 하고, words.ko 는 ko 안에 있어야 한다 (검증기가 확인)
- 채점기는 `src/lib/__tests__/content-grading.test.ts` 로 모든 answer/accept 가 별 3개인지 확인한다

