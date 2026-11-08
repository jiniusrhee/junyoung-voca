// 헤드리스 Chrome(원격 디버깅 9333)에서 개발 서버(5180)의 앱을 플립 크기(360x820, dpr 3, 다크)로 열어 캡처한다.
// 사용법: node shot.mjs <hash> <out.png> [--wait ms] [--eval "<js>"] [--click "<버튼 글자>"]... [--w 360 --h 820 --dpr 3] [--light]
//   예) node shot.mjs "/all" all.png --wait 1500
//       node shot.mjs "/quiz" quiz.png --click "힌트 보기" --wait 600
// 동작: speechSynthesis·SpeechRecognition 을 무음 스텁으로 바꾸고(이 PC는 헤드리스에서도 소리가 남), 설정이 없으면 레벨 30 으로 온보딩을 건너뛴다.
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
// Git Bash 가 '/all' 같은 인자를 'C:/Program Files/Git/all' 로 바꿔 버리므로 되돌린다. 'all' 처럼 슬래시 없이 줘도 된다
let hash = (args[0] || '/').replace(/^[A-Za-z]:\/Program Files\/Git/, '');
if (!hash.startsWith('/')) hash = '/' + hash;
const out = args[1] || 'shot.png';
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const clicks = []; args.forEach((a, i) => { if (a === '--click') clicks.push(args[i + 1]); });
const evals = []; args.forEach((a, i) => { if (a === '--eval') evals.push(args[i + 1]); });
const W = Number(opt('--w', 360)), H = Number(opt('--h', 820)), DPR = Number(opt('--dpr', 3));
const wait = Number(opt('--wait', 1200));
const dark = !args.includes('--light');
const port = process.env.CDP_PORT || '9333';
const base = process.env.APP_URL || 'http://localhost:5180/junyoung-voca/';

const list = await (await fetch(`http://localhost:${port}/json`)).json();
let t = list.find((x) => x.type === 'page');
if (!t) { t = await (await fetch(`http://localhost:${port}/json/new?about:blank`, { method: 'PUT' })).json(); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const m = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return m.result?.exceptionDetails ? 'EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 300) : m.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  try { const noop = () => {}; const synth = { speak: noop, cancel: noop, pause: noop, resume: noop, getVoices: () => [], speaking: false, pending: false, paused: false, addEventListener: noop, removeEventListener: noop, onvoiceschanged: null };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    delete window.SpeechRecognition; delete window.webkitSpeechRecognition;
    window.__shot = true; } catch (e) {}` });

// 온보딩 건너뛰기: kv 'settings' 가 없으면 레벨 30 + 다이노 테마로 저장
const cur = await ev('location.href');
if (!cur.startsWith(base)) { await send('Page.navigate', { url: base + '#/' }); await sleep(1500); }
const seeded = await ev(`(async()=>{const open=()=>new Promise((res,rej)=>{const r=indexedDB.open('junyoung-voca');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onupgradeneeded=()=>{}});const db=await open();if(!db.objectStoreNames.contains('kv')){db.close();return 'nokv';}const get=()=>new Promise(r=>{const q=db.transaction('kv','readonly').objectStore('kv').get('settings');q.onsuccess=()=>r(q.result);});const row=await get();if(row&&row.value&&row.value.level!=null){db.close();return 'ok';}const v={...(row?.value||{}),level:30,theme:'dark',studyTheme:'dino',nickname:'준영'};await new Promise(r=>{const q=db.transaction('kv','readwrite').objectStore('kv').put({key:'settings',value:v});q.onsuccess=()=>r();});db.close();return 'seeded'})()`);
if (seeded === 'seeded' || seeded === 'nokv') { await send('Page.navigate', { url: base + '#/' }); await sleep(1800); }

// 같은 문서 안의 해시 이동은 location.hash 로 (Page.navigate 는 라우터가 못 받는 경우가 있음)
if (!(await ev('location.href')).startsWith(base)) { await send('Page.navigate', { url: base + '#/' }); await sleep(1500); }
// 앱이 막 뜬 직후엔 해시가 '#/' 로 되돌아오는 때가 있어 확인하며 최대 4번 다시 건다
const before = await ev('location.hash+"|"+document.body.innerText.slice(0,200)');
if (process.env.SHOT_DEBUG) console.log('before', before.slice(0, 60));
for (let k = 0; k < 4; k++) {
  await ev(`location.hash=${JSON.stringify('#' + hash)};'x'`);
  // 라우트 모듈을 개발 서버가 처음 변환할 때는 몇 초 걸리므로 화면 글자가 바뀔 때까지 기다린다
  let changed = false;
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    const now = await ev('location.hash+"|"+document.body.innerText.slice(0,200)');
    if (now !== before && now.startsWith('#' + hash + '|')) { changed = true; break; }
    if (process.env.SHOT_DEBUG) console.log('poll', k, i, now.slice(0, 60));
  }
  if (changed || before.startsWith('#' + hash + '|')) break;
}
await sleep(wait);
for (const c of clicks) {
  const r = await ev(`(()=>{const b=[...document.querySelectorAll('button,a,[role=button]')].find(x=>x.textContent.trim().includes(${JSON.stringify(c)})||(x.getAttribute('aria-label')||'')===${JSON.stringify(c)});if(!b)return 'no:'+${JSON.stringify(c)};b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));b.click();return 'ok'})()`);
  if (r !== 'ok') console.log('click', c, '->', r);
  await sleep(Number(opt('--after', 700)));
}
for (const e of evals) console.log('eval ->', await ev(e));
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log(out, await ev('innerWidth+"x"+innerHeight+" | "+document.body.innerText.replace(/\\n+/g,"|").slice(0,120)'));
ws.close();
