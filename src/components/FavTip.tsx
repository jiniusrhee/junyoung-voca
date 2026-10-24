import Mascot from './Mascot';

/** 좋아하는 문장 ♥ 를 처음 누를 때 뜨는 2단계 안내 (말해보카) */
export default function FavTip({ page, onNext, onNo, onYes }: { page: 1 | 2; onNext: () => void; onNo: () => void; onYes: () => void }) {
  return (
    <div className="fav-tip">
      <p className="ft-kicker">
        내가 좋아하는 문장 <em>활용 Tip</em>
        <span className="ft-num">{page}</span>
      </p>
      {page === 1 ? (
        <>
          <h2>
            혹시, 단어를 모르거나
            <br />
            틀려서 ❤️를 누른 건가요?
          </h2>
          <div className="ft-mascot">
            <span className="ft-letter a">A</span>
            <span className="ft-letter b">B</span>
            <span className="ft-letter c">C</span>
            <Mascot size={170} mood="happy" />
          </div>
          <div className="ft-box">
            <b>제가 다 챙겨 줄게요!</b>
            <p>
              완벽하게 알게 될 때까지
              <br />
              [오늘의 학습]에서 여러 번 문제를 내 줄게요!
            </p>
          </div>
          <button className="btn primary big ft-btn" onClick={onNext}>
            그럼… ❤️는 언제 써요?
          </button>
        </>
      ) : (
        <>
          <h2>
            내가 좋아하는 문장
            <br />한 곳에서 모아봐요❤️
          </h2>
          <div className="ft-mascot">
            <span className="ft-heart h1">♥</span>
            <span className="ft-heart h2">♥</span>
            <span className="ft-heart h3">♥</span>
            <Mascot size={170} mood="cheer" />
          </div>
          <div className="ft-box">
            <b>방금 본 문장, 마음에 드나요?</b>
            <p>
              [내가 좋아하는 문장]
              <br />
              목록에 추가할까요?
            </p>
          </div>
          <div className="ft-actions">
            <button className="btn gray big" onClick={onNo}>
              아니요, 괜찮아요.
            </button>
            <button className="btn primary big" onClick={onYes}>
              네, 추가해 주세요❤️
            </button>
          </div>
        </>
      )}
    </div>
  );
}
