import { useEffect, useState } from 'react';
import { canInstall, checkForUpdate, downloadAndInstall, isNativeApp, openInstallSettings, type UpdateInfo } from '../lib/appUpdate';
import Icon from './Icon';

type Step = 'idle' | 'permission' | 'downloading' | 'installing' | 'error';

/**
 * 새 버전 안내 시트. 앱(APK)에서만 동작한다.
 * - 앱을 열 때와 설정의 '새 버전 확인'(voca:check-update 이벤트)에서 릴리스를 확인한다.
 * - '지금 업데이트' → (처음이면 '이 출처 허용' 설정) → 내려받기 진행률 → 안드로이드 설치 화면. 설치 버튼은 사용자가 한 번 누른다.
 */
export default function UpdateSheet() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const check = async (manual: boolean) => {
    try {
      const u = await checkForUpdate();
      if (u) {
        setInfo(u);
        setStep('idle');
      } else if (manual) {
        setToast('지금이 최신 버전이에요.');
        window.setTimeout(() => setToast(null), 2400);
      }
    } catch (e) {
      if (manual) {
        setToast(e instanceof Error ? e.message : '확인하지 못했어요. 연결을 확인해 주세요.');
        window.setTimeout(() => setToast(null), 2600);
      }
    }
  };

  useEffect(() => {
    if (!isNativeApp()) return;
    const t = window.setTimeout(() => void check(false), 2500);
    const onManual = () => void check(true);
    window.addEventListener('voca:check-update', onManual);
    // 설정에서 '이 출처 허용'을 켜고 돌아오면 이어서 진행
    const onVisible = () => {
      if (document.visibilityState === 'visible' && step === 'permission') void start();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('voca:check-update', onManual);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const start = async () => {
    if (!info) return;
    try {
      if (!(await canInstall())) {
        setStep('permission');
        await openInstallSettings();
        return;
      }
      setStep('downloading');
      setPercent(0);
      await downloadAndInstall(info.url, (p) => setPercent(Math.max(0, p)));
      setStep('installing');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep('error');
    }
  };

  if (toast) return <div className="toast">{toast}</div>;
  if (!info) return null;

  return (
    <div className="modal-dim update-dim" onClick={() => step !== 'downloading' && setInfo(null)}>
      <div className="update-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="update-icon">
          <Icon name="gift" size={30} />
        </div>
        <h3>새 버전이 나왔어요</h3>
        <p className="update-ver">
          {__APP_VERSION__} → <b>{info.version}</b>
        </p>
        {info.notes && <pre className="update-notes">{info.notes.slice(0, 400)}</pre>}

        {step === 'permission' && <p className="update-msg">설정에서 준영보카의 &apos;이 출처 허용&apos;을 켠 뒤 돌아오면 바로 이어서 받아요.</p>}
        {step === 'downloading' && (
          <div className="update-progress">
            <div className="update-bar">
              <div style={{ width: `${percent}%` }} />
            </div>
            <span>{percent >= 0 ? `${percent}% 받는 중…` : '받는 중…'}</span>
          </div>
        )}
        {step === 'installing' && <p className="update-msg">설치 화면이 열렸어요. &apos;설치&apos;를 누르면 새 버전으로 바뀌어요.</p>}
        {step === 'error' && <p className="update-msg error">실패했어요: {error}</p>}

        <div className="update-actions">
          {step !== 'downloading' && (
            <button className="btn gray big" onClick={() => setInfo(null)}>
              나중에
            </button>
          )}
          {(step === 'idle' || step === 'error' || step === 'permission') && (
            <button className="btn primary big" onClick={() => void start()}>
              {step === 'error' ? '다시 시도' : '지금 업데이트'}
            </button>
          )}
          {step === 'installing' && (
            <button className="btn primary big" onClick={() => void start()}>
              설치 화면 다시 열기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
