// 앱 WebView(DevTools 포트 9224)에서 JS 식을 실행해 값만 출력. 사용법: node remote.mjs "<js>"
const port = process.env.DEVTOOLS_PORT || '9224';
let list;
try {
  list = await (await fetch(`http://localhost:${port}/json`)).json();
} catch (e) {
  console.log('NO-DEVTOOLS');
  process.exit(2);
}
const targets = list.filter((x) => x.type === 'page' && /localhost|junyoung/.test(x.url));
if (!targets.length) {
  console.log('NO-TARGET');
  process.exit(2);
}
const t = targets[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
const opened = await new Promise((r) => { ws.onopen = () => r(true); ws.onerror = () => r(false); setTimeout(() => r(false), 4000); });
if (!opened) { console.log('WS-FAIL'); process.exit(2); }
const res = await new Promise((resolve) => {
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id === 1) resolve(m); };
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: process.argv[2], awaitPromise: true, returnByValue: true } }));
  setTimeout(() => resolve(null), 15000);
});
ws.close();
if (!res) { console.log('TIMEOUT'); process.exit(3); }
const v = res.result?.result;
if (res.result?.exceptionDetails) console.log('EXC ' + (res.result.exceptionDetails.exception?.description || '').slice(0, 300));
else console.log(typeof v?.value === 'string' ? v.value : JSON.stringify(v?.value ?? v?.description ?? null));
