// 우리 앱 리스닝 객관식: 맞는 보기를 차례로 눌러 KEEP 개만 남긴다. 남은 낱말과 그 보기의 화면 자리(기기 px)를 돌려준다
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => s.toLowerCase().replace(/[^a-z']/g, '');
  for (let guard = 0; guard < 40; guard++) {
    const blanks = [...document.querySelectorAll('.card-slide:not(.exit) .lq-w.lq-b')];
    if (blanks.length <= __KEEP__) break;
    const want = norm(blanks[0].textContent);
    const slot = [...document.querySelectorAll('.lq-slot:not(.empty)')].find((e) => norm(e.querySelector('span:last-child')?.textContent ?? '') === want);
    if (!slot) { await sleep(300); continue; }
    slot.click();
    await sleep(450);
  }
  const blanks = [...document.querySelectorAll('.card-slide:not(.exit) .lq-w.lq-b')];
  if (!blanks.length) return 'done';
  const want = norm(blanks[0].textContent);
  const slot = [...document.querySelectorAll('.lq-slot:not(.empty)')].find((e) => norm(e.querySelector('span:last-child')?.textContent ?? '') === want);
  const r = slot?.getBoundingClientRect();
  return want + ' ' + (r ? Math.round((r.left + r.width / 2) * 3) + ' ' + Math.round((r.top + r.height / 2 + 30.67) * 3) : 'noslot');
})()
