import type { Tone } from '../types';

/** 말해보카 오답 노트 태그: 정답(정답으로 인정되는 유의어) / 비슷(비슷하지만 정답이 아닌 말) / 오답 */
export const TONE_TAG: Record<Tone, string> = { green: '정답', yellow: '비슷', red: '오답' };

export default function WrongItem({ w, tone, m, soft }: { w: string; tone: Tone; m: string; soft?: boolean }) {
  return (
    <div className={`wrong-item ${soft ? 'soft' : ''}`}>
      <div className="wrong-head">
        <span className={`tag ${tone}`}>
          {TONE_TAG[tone]}
          <i className="tag-q">?</i>
        </span>
        <span className="wrong-w">{w}</span>
      </div>
      <p>{m}</p>
    </div>
  );
}
