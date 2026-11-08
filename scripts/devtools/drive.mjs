// 앱 WebView(DevTools 9224)를 한 소켓으로 조작하는 드라이버. 사용법: node drive.mjs <시나리오> [인자]
// 시나리오: vocab N  → 어휘 N문제를 정답 DB 로 풀며(섞어서: 바로 정답/오답 뒤 정답/힌트/정답 보기) 단계마다 캡처
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const adb = path.join(process.env.LOCALAPPDATA, 'Android', 'platform-tools', 'adb.exe');
const serial = process.env.ANDROID_SERIAL || 'emulator-5554';
const cap = (name) => execFileSync('python', [path.join(here, 'cap.py'), name], { env: { ...process.env, ANDROID_SERIAL: serial } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const port = process.env.DEVTOOLS_PORT || '9224'; // 플립은 9225 로 포워딩해 쓴다
const list = await (await fetch(`http://localhost:${port}/json`)).json();
const t = list.find((x) => x.type === 'page' && /localhost/.test(x.url));
if (!t) { console.log('NO-TARGET'); process.exit(2); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const ev = (expr) => new Promise((resolve) => { const i = ++id; pending.set(i, (m) => resolve(m.result?.exceptionDetails ? 'EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 200) : m.result?.result?.value)); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } })); });

const text = () => ev("document.body.innerText.replace(/\\n+/g,'|').slice(0,260)");
const press = (label) => ev(`(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>x.textContent.includes(${JSON.stringify(label)})||(x.getAttribute('aria-label')||'')===${JSON.stringify(label)});if(!b)return 'no:'+${JSON.stringify(label)};b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));b.click();return 'ok'})()`);
const typeW = (w) => ev(`(async()=>{const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));const key=(ch)=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim().toLowerCase()===ch&&b.textContent.trim().length===1);for(const ch of ${JSON.stringify(w)}){if(ch===' '){const sp=[...document.querySelectorAll('button')].find(x=>/띄어쓰기|space/i.test(x.getAttribute('aria-label')||''));if(sp){sp.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));sp.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));sp.click();}await sleep(140);continue;}const k=key(ch.toLowerCase());if(!k)return 'nokey:'+ch;k.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));k.click();await sleep(90);}return 'typed'})()`);
const clear = () => ev(`(async()=>{const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));const bs=[...document.querySelectorAll('button')].find(x=>/지우기|backspace/i.test(x.getAttribute('aria-label')||''));for(let i=0;i<24;i++){bs.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));bs.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));bs.click();await sleep(40);}return 'cleared'})()`);
const card = () => ev(`(async()=>{const ko=(document.querySelector('.qcard .ko')?.textContent??'').trim();const db=await new Promise((res,rej)=>{const r=indexedDB.open('junyoung-voca');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});const all=await new Promise(r=>{const q=db.transaction('words','readonly').objectStore('words').getAll();q.onsuccess=()=>r(q.result)});for(const w of all){for(const s of w.sentences){if(s.ko.replace(/\\*\\*/g,'')===ko){const bad=(s.alts||[]).find(a=>a.t!=='ok');return JSON.stringify({answer:s.answer,wrong:bad?bad.w:null,word:w.word});}}}return null})()`);
const count = () => ev("(document.querySelector('.progress-label')||document.querySelector('.progress-fill span'))?.textContent");
const hasNext = () => ev("!![...document.querySelectorAll('button')].find(x=>x.textContent.includes('다음 문제'))");

const scenario = process.argv[2];
if (scenario === 'vocab') {
  const n = Number(process.argv[3] || 5);
  const log = [];
  for (let i = 0; i < n; i++) {
    const c = JSON.parse((await card()) || 'null');
    if (!c) { log.push(`#${i}: no card | ${await text()}`); cap(`e_v_nocard${i}`); break; }
    const mode = i % 4; // 0 정답, 1 오답→정답, 2 힌트→정답, 3 정답 보기→정답
    const before = await count();
    if (mode === 1) { await typeW(c.wrong || 'abc'); await press('확인'); await sleep(1500); if (i < 8) cap(`e_v${i}_wrong`); await clear(); }
    if (mode === 2) { await press('힌트 보기'); await sleep(800); if (i < 8) cap(`e_v${i}_hint`); await clear(); }
    if (mode === 3) { await press('힌트 보기'); await sleep(600); await press('정답 보기'); await sleep(800); if (i < 8) cap(`e_v${i}_show`); await clear(); }
    const typed = mode >= 2 ? c.answer.slice((await ev("(document.querySelector('.blank-text .typed')?.textContent||'').length")) || 0) : c.answer;
    await typeW(typed);
    await sleep(2200);
    const ok = await hasNext();
    if (!ok) { await press('확인'); await sleep(1500); }
    const after = await count();
    log.push(`#${i} ${['clean', 'wrong', 'hint', 'show'][mode]} ${c.word}: ${before} -> ${after} panel=${await hasNext()}`);
    if (i < 8 || i === n - 1) cap(`e_v${i}_done`);
    const txt = await text();
    if (/목표|축하|트로피/.test(txt) && !(await hasNext())) { cap(`e_v${i}_goal`); log.push(`#${i} popup: ${txt.slice(0, 120)}`); }
    await press('다음 문제');
    await sleep(2500);
  }
  console.log(log.join('\n'));
  console.log('END ' + (await text()));
}
if (scenario === 'walk') {
  // 모든 주요 화면을 차례로 열어 캡처 + 본문 앞부분 기록
  const routes = (process.argv[3] || '/,/all,/all?mode=grammar,/all?mode=expr,/all?mode=talk,/all?mode=listening,/stats,/streak,/inbox,/words,/learned-words/daily,/favorites,/wrongs,/wordbook,/dict,/grammar-dict,/learned/grammar,/bookmarks/grammar,/expr,/expr/courses,/talk,/pairs,/settings,/settings/vocab,/settings/mode/screen,/settings/mode/notice,/settings/mode/voice,/settings/mode/grammar,/settings/mode/listening,/settings/mode/expr,/settings/mode/talk,/settings/data').split(',');
  for (const r of routes) {
    await ev(`location.hash='#${r}';'x'`);
    await sleep(1600);
    const name = 'w_' + r.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'w_home';
    cap(name);
    console.log(r + ' | ' + (await text()).slice(0, 150));
  }
}
if (scenario === 'goal') {
  // 목표 달성 팝업까지 바로 정답으로 풀기
  for (let i = 0; i < 40; i++) {
    const c = JSON.parse((await card()) || 'null');
    if (!c) { console.log('no card: ' + (await text())); break; }
    await typeW(c.answer); await sleep(2200);
    if (!(await hasNext())) { await press('확인'); await sleep(1500); }
    const txt = await text();
    if (/목표|축하|달성/.test(txt) && !/다음 문제/.test(txt.slice(0, 80))) { cap('e_goal'); console.log('GOAL: ' + txt.slice(0, 160)); break; }
    const cnt = await count(); console.log(`#${i} ${c.word} ${cnt}`);
    await press('다음 문제'); await sleep(2500);
  }
  cap('e_goal_state');
  console.log('END ' + (await text()).slice(0, 200));
}
const dbAll = (store) => ev(`(async()=>{const db=await new Promise((res,rej)=>{const r=indexedDB.open('junyoung-voca');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return JSON.stringify(await new Promise(r=>{const q=db.transaction(${JSON.stringify(store)},'readonly').objectStore(${JSON.stringify(store)}).getAll();q.onsuccess=()=>r(q.result)}))})()`);
const tapCardText = (w) => ev(`(()=>{const b=[...document.querySelectorAll('.g-card-btn:not(.used):not(:disabled)')].find(x=>x.textContent.trim().toLowerCase()===${JSON.stringify(w)}.toLowerCase());if(!b)return 'nocard:'+${JSON.stringify(w)};b.click();return 'ok'})()`);
if (scenario === 'grammar') {
  const n = Number(process.argv[3] || 6);
  const sents = JSON.parse(await dbAll('gsentences'));
  await ev("location.hash='#/grammar';'x'"); await sleep(2500);
  for (let i = 0; i < n; i++) {
    const ko = (await ev("(document.querySelector('.qcard .ko, .g-ko, .ko')?.textContent||'').trim()")) || '';
    const s = sents.find((x) => x.ko.replace(/[*][*]/g, '') === ko.replace(/[*][*]/g, ''));
    if (!s) { console.log(`#${i} no sentence for: ${ko.slice(0, 40)} | ${await text()}`); cap(`e_g${i}_nos`); break; }
    const words = s.en.replace(/[.,!?]/g, ' ').split(/\s+/).filter(Boolean);
    if (i === 0) cap('e_g0_q');
    if (i % 3 === 1) {
      // 일부러 두 단어만 놓고 확인 → 안내 말풍선
      await tapCardText(words[1]); await tapCardText(words[0]); await press('확인'); await sleep(1200); cap(`e_g${i}_wrong`);
      console.log(`#${i} wrong-check: ${(await text()).slice(0, 140)}`);
      // 정답 보기
      await press('정답 보기'); await sleep(1500); cap(`e_g${i}_show`);
    } else {
      for (const w of words) { const r = await tapCardText(w); if (r !== 'ok') { console.log(`#${i} ${r}`); break; } await sleep(120); }
      await press('확인'); await sleep(1800);
      if (i < 3) cap(`e_g${i}_done`);
    }
    console.log(`#${i} ${s.en.slice(0, 40)} | ${(await text()).slice(0, 120)}`);
    await press('다음 문제'); await sleep(2200);
  }
  cap('e_g_end'); console.log('END ' + (await text()).slice(0, 200));
}
if (scenario === 'listen') {
  const n = Number(process.argv[3] || 3);
  await ev("location.hash='#/listening';'x'"); await sleep(3000);
  for (let i = 0; i < n; i++) {
    cap(`e_l${i}_q`);
    const r = await ev(`(async()=>{const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));const line=()=>document.querySelector('.l-line')?.textContent??'';let taps=0,wrong=0;for(let n=0;n<40;n++){if([...document.querySelectorAll('button')].find(x=>x.textContent.includes('다음 문제')))break;const before=line();const btns=[...document.querySelectorAll('.l-slot:not(.empty):not(:disabled)')];if(!btns.length)break;let moved=false;for(const b of btns){b.click();taps++;await sleep(260);if(line()!==before||[...document.querySelectorAll('button')].find(x=>x.textContent.includes('다음 문제'))){moved=true;break;}wrong++;}if(!moved){const sb=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('정답 보기'));if(sb){sb.click();await sleep(1500);break;}await sleep(600);}}await sleep(1500);return 'taps='+taps+' wrong='+wrong+' | '+document.body.innerText.replace(/\\n+/g,'|').slice(0,160)})()`);
    cap(`e_l${i}_done`); console.log(`#${i} ${r}`);
    await press('다음 문제'); await sleep(3000);
  }
  console.log('END ' + (await text()).slice(0, 160));
}
if (scenario === 'expr') {
  const n = Number(process.argv[3] || 4);
  await ev("location.hash='#/expr/quiz';'x'"); await sleep(3000);
  for (let i = 0; i < n; i++) {
    if (i === 0) cap('e_x0_q');
    const mode = i % 3; // 0 바로, 1 길이→힌트→정답 보기, 2 오답 뒤 정답
    if (mode === 1) { await press('길이 보기'); await sleep(600); await press('힌트 보기'); await sleep(600); cap(`e_x${i}_hint`); await press('정답 보기'); await sleep(600); cap(`e_x${i}_show`); }
    const ans = await ev(`(async()=>{const db=await new Promise((res,rej)=>{const r=indexedDB.open('junyoung-voca');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});const ko=(document.querySelector('.e-ko')?.textContent||'').replace(/[*][*]/g,'').trim();const all=await new Promise(r=>{const q=db.transaction('eitems','readonly').objectStore('eitems').getAll();q.onsuccess=()=>r(q.result)});const it=all.find(x=>x.ko.replace(/[*][*]/g,'').trim()===ko);return it?it.answer:''})()`);
    if (!ans) { console.log(`#${i} no answer | ${await text()}`); cap(`e_x${i}_noans`); break; }
    if (mode === 2) { await typeW('xyz'); await press('확인'); await sleep(1200); cap(`e_x${i}_wrong`); await clear(); }
    const typedAlready = mode === 1 ? ((await ev("[...document.querySelectorAll('.e-box')].map(b=>b.querySelector('.typed')?.textContent||'').join(' ').trim()")) || '') : '';
    await typeW(ans.slice(typedAlready.length)); await sleep(2500);
    if (![...(await text())].length) break;
    cap(`e_x${i}_done`); console.log(`#${i} ${['clean','hint','wrong'][mode]} ${ans} | ${(await text()).slice(0, 120)}`);
    await press('다음 문제'); await sleep(2500);
  }
  console.log('END ' + (await text()).slice(0, 160));
}
if (scenario === 'talk') {
  const n = Number(process.argv[3] || 6);
  const story = process.argv[4] || 'first-campus';
  const ep = Number(process.argv[5] || 0);
  const pd = (sel) => `(()=>{const b=${sel};if(!b)return 'no-key';b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));return 'ok'})()`;
  const typeS = async (text) => {
    for (const ch of text) {
      let r;
      if (ch === ' ') r = await ev(pd(`document.querySelector('button[aria-label="띄어쓰기"]')`));
      else if (/[a-z]/i.test(ch)) {
        if (ch === ch.toUpperCase()) { const on = await ev(`!!document.querySelector('button[aria-label="대문자"].on')`); if (!on) await ev(pd(`document.querySelector('button[aria-label="대문자"]')`)); }
        r = await ev(pd(`document.querySelector('button[aria-label="${ch.toLowerCase()}"]')`));
      } else if (ch === ',' || ch === '.') r = await ev(pd(`[...document.querySelectorAll('.kb.sentence button')].find(b=>b.textContent.trim()===${JSON.stringify(ch)})`));
      else {
        await ev(pd(`[...document.querySelectorAll('.kb.sentence button')].find(b=>b.textContent.trim()==='123')`)); await sleep(80);
        r = await ev(pd(`[...document.querySelectorAll('.kb.sentence button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(ch)})`)); await sleep(80);
        await ev(pd(`[...document.querySelectorAll('.kb.sentence button')].find(b=>b.textContent.trim()==='ABC')`));
      }
      if (r !== 'ok') console.log(`key ${JSON.stringify(ch)}: ${r}`);
      await sleep(45);
    }
  };
  const answerOf = () => ev(`(async()=>{const d=await (await fetch('/data/talk/${story}.json')).json();const ep=d.episodes[${ep}];const ko=(document.querySelector('.me-ko')?.textContent||'').replace(/\s+/g,'');const l=ep.lines.find(x=>x.who==='me'&&ko.includes(x.ko.replace(/\s+/g,'')));return l?JSON.stringify({answer:l.answer,alt:(l.accept||[])[0]||''}):''})()`);
  await ev(`location.hash='#/talk/${story}/${ep}';'x'`); await sleep(3000);
  cap('e_t_intro'); console.log('INTRO ' + (await text()).slice(0, 160));
  let r = await press('처음부터 하기'); if (r.startsWith('no:')) r = await press('시작하기'); console.log('start: ' + r); await sleep(1800);
  for (let i = 0; i < n; i++) {
    if (await ev(`!![...document.querySelectorAll('button')].find(x=>x.textContent.includes('키보드 모드'))`)) { await press('키보드 모드'); await sleep(700); }
    const a = JSON.parse((await answerOf()) || 'null');
    if (!a) { console.log(`#${i} no answer | ${(await text()).slice(0, 200)}`); cap(`e_t${i}_noans`); break; }
    const mode = i % 3; // 0 정답 그대로, 1 힌트 → 허용 답, 2 엉뚱한 답
    if (i < 2) cap(`e_t${i}_q`);
    if (mode === 1) { await press('힌트 보기'); await sleep(700); cap(`e_t${i}_hint`); }
    const typed = mode === 0 ? a.answer : mode === 1 ? (a.alt || a.answer) : 'I like pizza very much.';
    await typeS(typed); await sleep(300);
    await ev(pd(`[...document.querySelectorAll('.kb.sentence button')].find(b=>b.textContent.includes('확인'))`)); await sleep(1800);
    cap(`e_t${i}_done`);
    console.log(`#${i} ${['perfect', 'hint', 'wrong'][mode]} "${typed}" | ${(await text()).slice(0, 220)}`);
    let nx = await press('다음 문제'); if (nx.startsWith('no:')) nx = await press('학습 완료'); await sleep(1500);
    if (await ev(`!!document.querySelector('.modal-dim')`)) { cap(`e_t${i}_expr`); await press('괜찮아요'); await sleep(1500); }
    if (nx.startsWith('no:') || !(await ev(`!!document.querySelector('.me-ko')`))) { await sleep(1500); cap('e_t_end'); console.log('END ' + (await text()).slice(0, 260)); break; }
  }
}
if (scenario === 'shots') {
  // 화면 비율 테스트용: 접두어를 붙여 주요 화면을 캡처
  const p = process.argv[3] || 's';
  const go = async (h, ms = 2200) => { await ev(`location.hash='#${h}';'x'`); await sleep(ms); };
  await go('/'); cap(`${p}_home`);
  await go('/all'); cap(`${p}_all`);
  await go('/stats'); cap(`${p}_stats`);
  await go('/streak'); cap(`${p}_streak`);
  await go('/quiz', 3000); cap(`${p}_quiz`);
  const c = JSON.parse((await card()) || 'null');
  if (c) {
    await typeW(c.wrong || 'abc'); await press('확인'); await sleep(1300); cap(`${p}_quiz_wrong`); await clear();
    await press('힌트 보기'); await sleep(700); cap(`${p}_quiz_hint`);
    await press('정답 보기'); await sleep(700); cap(`${p}_quiz_show`);
    const typedLen = (await ev("(document.querySelector('.blank-text .typed')?.textContent||'').length")) || 0;
    await typeW(c.answer.slice(typedLen)); await sleep(2200);
    if (!(await hasNext())) { await press('확인'); await sleep(1500); }
    cap(`${p}_quiz_after`);
    console.log(`${p} quiz: ${c.word} | ${(await text()).slice(0, 120)}`);
  } else console.log(`${p} quiz: no card | ${(await text()).slice(0, 120)}`);
  await go('/listening', 3000); cap(`${p}_listen`);
  await go('/grammar', 3000); cap(`${p}_grammar`);
  await go('/expr/quiz', 3000); cap(`${p}_expr`);
  await go('/talk/first-campus/0', 3000); cap(`${p}_talk_intro`);
  let r = await press('처음부터 하기'); if (r.startsWith('no:')) r = await press('시작하기'); await sleep(1600);
  if (await ev(`!![...document.querySelectorAll('button')].find(x=>x.textContent.includes('키보드 모드'))`)) { await press('키보드 모드'); await sleep(700); }
  cap(`${p}_talk`);
  await go('/settings/vocab'); cap(`${p}_settings`);
  await go('/dict'); cap(`${p}_dict`);
  console.log(`${p} done`);
}
if (scenario === 'qstates') {
  // 어휘 퀴즈의 상태별 캡처 (입력·오타·오답·힌트·정답 보기·정답 타임라인·패널 기능·다음 문제)
  const p = process.argv[3] || 'n';
  const bs1 = () => ev(`(()=>{const bs=[...document.querySelectorAll('button')].find(x=>/지우기/.test(x.getAttribute('aria-label')||''));bs.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));bs.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));return 'x'})()`);
  await ev(`location.hash='#/quiz';'x'`); await sleep(2500); cap(`${p}_q0`);
  const c = JSON.parse((await card()) || 'null');
  if (c) {
    await typeW(c.answer[0]); await sleep(400); cap(`${p}_type1`);
    await typeW(c.answer.slice(1, -1)); await sleep(400); cap(`${p}_typeN`);
    await clear();
    const mid = Math.floor(c.answer.length / 2);
    const typo = c.answer.slice(0, mid) + (c.answer[mid] === 'a' ? 'e' : 'a') + c.answer.slice(mid + 1);
    await typeW(typo); await press('확인'); await sleep(250); cap(`${p}_typo1`); await sleep(1200); cap(`${p}_typo2`);
    await bs1(); await sleep(300); cap(`${p}_typo_edit`);
    await clear(); await sleep(300); cap(`${p}_cleared`);
    await typeW('zzzz'); await press('확인'); await sleep(200); cap(`${p}_wrong1`); await sleep(700); cap(`${p}_wrong2`); await sleep(700); cap(`${p}_wrong3`);
    await clear();
    await press('힌트 보기'); await sleep(500); cap(`${p}_hint`);
    await press('정답 보기'); await sleep(500); cap(`${p}_show`);
    await typeW(c.answer[0]); await sleep(300); cap(`${p}_show_type`);
    await typeW(c.answer.slice(1)); await sleep(100); cap(`${p}_ok_a`); await sleep(350); cap(`${p}_ok_b`); await sleep(400); cap(`${p}_ok_c`); await sleep(1200); cap(`${p}_ok_d`);
    await press('다른 예문'); await sleep(500); cap(`${p}_examples`); await press('다른 예문'); await sleep(300);
    await press('오답 노트'); await sleep(500); cap(`${p}_wrongs`); await press('오답 노트'); await sleep(300);
    await press('더 보기'); await sleep(600); cap(`${p}_more`); await ev(`document.querySelector('.extra-sheet-dim')?.click();'x'`); await sleep(400);
    await press('다음 문제'); await sleep(100); cap(`${p}_next_a`); await sleep(2000); cap(`${p}_next_b`);
    console.log(`qstates ${c.word} typo=${typo}`);
  }
  console.log('qstates done ' + (await text()).slice(0, 100));
}
if (scenario === 'qrec') {
  // 녹화용 타임라인: 마지막 글자 입력 → 3.5초 → 다음 문제 → 2초 (호출 전에 adb screenrecord 를 켜 둔다)
  const c = JSON.parse((await card()) || 'null');
  if (!c) console.log('no card ' + (await text()).slice(0, 100));
  else {
    await typeW(c.answer.slice(0, -1)); await sleep(1500);
    console.log('LAST ' + Date.now()); await typeW(c.answer.slice(-1)); await sleep(3500);
    console.log('NEXT ' + Date.now()); await press('다음 문제'); await sleep(2000);
    console.log('qrec ' + c.word);
  }
}
if (scenario === 'qtime') {
  // 정답 타임라인을 DOM 폴링으로 재기 (ms): 마지막 글자 누른 순간 기준으로 초록 글자·도장·하트·배지·패널 등장 시각
  const c = JSON.parse((await card()) || 'null');
  if (!c) console.log('no card ' + (await text()).slice(0, 100));
  else {
    await typeW(c.answer.slice(0, -1)); await sleep(800);
    const last = c.answer.slice(-1).toLowerCase();
    const r = await ev(`(async()=>{const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));const k=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().toLowerCase()===${JSON.stringify(last)}&&b.textContent.trim().length===1);const t0=performance.now();k.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));k.click();const seen={};const want={green:'.blank.filled',stamp:'.mark-check',heart:'.heart-btn',due:'.badge-due',panel:'.after',kbgone:null,bird:'.ptero'};for(let i=0;i<60;i++){const now=Math.round(performance.now()-t0);for(const [n,sel] of Object.entries(want)){if(seen[n]!=null)continue;if(n==='kbgone'){if(!document.querySelector('.quiz-input'))seen[n]=now;}else if(document.querySelector(sel))seen[n]=now;}await sleep(25);}return JSON.stringify(seen)})()`);
    console.log('qtime ' + c.word + ' ' + r);
    await sleep(1200); await press('다음 문제'); await sleep(2000);
  }
}
ws.close();
