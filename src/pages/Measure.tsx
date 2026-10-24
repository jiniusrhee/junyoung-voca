import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Mascot from '../components/Mascot';
import { db } from '../db';
import { getImported } from '../lib/imported';
import { useSettings } from '../lib/settings';
import { comprehension, displayVocab, percentileOf, saveMeasure } from '../lib/stats';
import { studyDateOf } from '../lib/time';

/**
 * 어휘력 측정 (말해보카 2026 방식): 문제를 내지 않고 학습 기록으로 바로 계산한다.
 * 측정 중 화면(말풍선 + 캐릭터 + % 막대) → 결과 카드 3장 → 확인.
 */
export default function Measure() {
  const nav = useNavigate();
  const s = useSettings();
  const imp = useLiveQuery(() => getImported(), []);
  const comp = useLiveQuery(() => comprehension(), []);
  /** 이 앱에서 새로 본 단어 수: 표본이 작을수록 들여온 이해도를 더 믿는다 */
  const sample = useLiveQuery(() => db.reviews.filter((r) => r.isNew).count(), []);
  const testDate = useLiveQuery(async () => (await db.kv.get('levelTestDate'))?.value as string | undefined, []);
  /** 들여온 기록 이후 이 앱에서 처음 보고 바로 맞힌 단어 수 (아는 어휘에 더함) */
  const grown = useLiveQuery(async () => {
    const since = imp?.asOf ?? '0000-00-00';
    return db.reviews.filter((r) => r.isNew && r.firstTry && r.studyDate > since && (r.studyMode == null || r.studyMode === 'vocab')).count();
  }, [imp?.asOf]);
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!s) return;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - t0) / 2800) * 100));
      setPct(p);
      if (p >= 100) {
        window.clearInterval(id);
        window.setTimeout(() => setDone(true), 400);
      }
    }, 60);
    return () => window.clearInterval(id);
  }, [s]);

  if (!s || imp === undefined || comp === undefined || grown === undefined || sample === undefined) return <div className="measure-page" />;

  const base = displayVocab(s.level ?? 10, comp, imp, testDate);
  const vocab = base + (grown ?? 0);
  const w = Math.min(0.3, (sample ?? 0) / 300);
  const compNow = imp?.comprehension != null ? (comp == null ? imp.comprehension : imp.comprehension * (1 - w) + comp * w) : (comp ?? 0.7);
  const percentile = imp?.percentile != null && vocab >= (imp.vocabSize ?? 0) ? (vocab >= 22000 ? Math.min(imp.percentile, 0.1) : imp.percentile) : percentileOf(vocab);
  const today = studyDateOf();

  const confirm = async () => {
    if (!saved) {
      setSaved(true);
      await saveMeasure({ date: today, vocab, comprehension: compNow, percentile, level: s.level ?? undefined });
    }
    nav(-1);
  };

  if (!done) {
    return (
      <div className="measure-page">
        <div className="measure-bubble">
          <p>
            학습 기록을 바탕으로
            <br />
            영어 능력 측정 중입니다.
          </p>
          <b>{pct >= 70 ? '거의 다 되었습니다.' : '잠시만 기다려 주세요.'}</b>
        </div>
        <div className="measure-mascot">
          <Mascot size={150} mood="happy" />
        </div>
        <div className="measure-pct">
          {pct}
          <small>%</small>
        </div>
        <div className="measure-bar">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="measure-page result">
      <div className="measure-card purple">
        <span className="measure-cap">당신이 현재 알고있는 어휘는 약</span>
        <b>
          {vocab.toLocaleString()}
          <small>개</small>
        </b>
      </div>
      <div className="measure-card violet">
        <span className="measure-cap">당신의 어휘 이해도는</span>
        <b>
          {(compNow * 100).toFixed(2)}
          <small>%</small>
        </b>
      </div>
      <div className="measure-card pink">
        <span className="measure-cap">당신의 어휘력은 대한민국 상위</span>
        <b>
          {percentile}
          <small>%</small>
        </b>
      </div>
      <p className="measure-note">
        위의 수치들은 학습이 진행될수록
        <br />
        점점 정확하게 측정돼요.
      </p>
      <button className="btn primary big measure-ok" onClick={() => void confirm()}>
        확인
      </button>
    </div>
  );
}
