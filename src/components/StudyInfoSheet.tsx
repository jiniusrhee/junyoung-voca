import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db';
import { formatAfter } from '../lib/time';
import { toggleWordbook, useWordbooks } from '../lib/wordbook';
import type { StoredWord } from '../types';
import Icon from './Icon';

type Tab = 'history' | 'interval' | 'wordbook';

/**
 * 카드 오른쪽 위 배지(New / N일 전 / 재도전 / N 뒤 복습)를 누르면 뜨는 "학습 정보" 팝업.
 * 말해보카 실측(2026-11-08): 가운데 카드형 팝업, 제목 + ×, 탭 3개(학습 내역 / 복습 주기 / 단어장),
 * 학습 내역은 회차 라벨(첫 학습 · 당일 복습 · N일 차 복습) + 결과 + 날짜 목록, 단어장 탭 아래에는 보라 '단어장에 추가' 버튼.
 */
export default function StudyInfoSheet({ word, onClose }: { word: StoredWord; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('history');
  const reviews = useLiveQuery(() => db.reviews.where('wordId').equals(word.id).sortBy('ts'), [word.id]);
  const card = useLiveQuery(() => db.cards.get(word.id), [word.id]);
  const books = useWordbooks();
  const inBooks = (books ?? []).filter((b) => b.ids.includes(word.id));
  const rows = (reviews ?? []).filter((r) => !r.studyMode);
  const firstDay = rows[0] ? dayNumber(rows[0].studyDate) : 0;

  return (
    <div className="modal-dim study-info-dim" onClick={onClose}>
      <div className="study-info" onClick={(e) => e.stopPropagation()}>
        <div className="study-info-head">
          <span>학습 정보</span>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={22} />
          </button>
        </div>
        <div className="study-info-tabs">
          {(
            [
              ['history', '학습 내역'],
              ['interval', '복습 주기'],
              ['wordbook', '단어장'],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="study-info-body">
          {tab === 'history' &&
            (rows.length === 0 ? (
              <Empty text={'아직 학습 기록이 없어요.\n이 문제를 풀면 여기에 쌓여요.'} />
            ) : (
              <ul className="study-info-list">
                {[...rows].reverse().map((r, i) => {
                  const idx = rows.length - 1 - i;
                  const day = dayNumber(r.studyDate) - firstDay;
                  const label = idx === 0 ? '첫 학습' : day === 0 ? '당일 복습' : `${day}일 차 복습`;
                  const miss = r.showedAnswer || r.wrongAttempts > 0;
                  const result = r.showedAnswer ? '정답 보기' : r.wrongAttempts > 0 ? '오답 뒤 정답' : r.hints > 0 ? '힌트 뒤 정답' : '정답 맞힘';
                  return (
                    <li key={r.id ?? i}>
                      <span className={`study-info-mark ${miss ? 'miss' : ''}`}>{miss ? '!' : <Icon name="check" size={13} />}</span>
                      <span className="study-info-label">{label}</span>
                      <span className="study-info-right">
                        <b>{result}</b>
                        <small>{r.studyDate}</small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ))}
          {tab === 'interval' &&
            (card ? (
              <div className="study-info-interval">
                <p>
                  다음 복습 <b>{formatAfter(card.due)}</b>
                </p>
                <p>
                  복습 간격 약 <b>{Math.max(1, Math.round(card.stability))}일</b> · 지금까지 {card.reps}번 학습, {card.lapses}번 틀림
                </p>
              </div>
            ) : (
              <Empty text={'아직 학습하지 않은 단어예요.\n한 번 풀면 복습 주기가 정해져요.'} />
            ))}
          {tab === 'wordbook' &&
            (inBooks.length ? (
              <ul className="study-info-list plain">
                {inBooks.map((b) => (
                  <li key={b.id}>
                    <Icon name="bookmark" size={16} />
                    <span className="study-info-label">{b.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text={'이 단어가 담긴 단어장이 없어요.'} />
            ))}
        </div>
        {tab === 'wordbook' && (
          <button className="btn primary big study-info-add" onClick={() => void toggleWordbook(word.id)}>
            {inBooks.length ? '단어장에서 빼기' : '단어장에 추가'}
          </button>
        )}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="study-info-empty">
      <span className="study-info-bang">!</span>
      <p>{text}</p>
    </div>
  );
}

function dayNumber(date: string): number {
  return Math.floor(new Date(date + 'T12:00:00').getTime() / 86_400_000);
}
