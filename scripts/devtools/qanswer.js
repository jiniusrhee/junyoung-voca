(async()=>{const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const ko=(document.querySelector('.qcard .ko')?.textContent??'').trim();
const db=await new Promise((res,rej)=>{const r=indexedDB.open('junyoung-voca');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const all=await new Promise(r=>{const q=db.transaction('words','readonly').objectStore('words').getAll();q.onsuccess=()=>r(q.result)});db.close();
let ans=null;for(const w of all){for(const s of w.sentences){if(s.ko.replace(/\*\*/g,'')===ko){ans=s.answer;break;}}if(ans)break;}
if(!ans)return 'noanswer';
const key=(ch)=>[...document.querySelectorAll('.kb button')].find(b=>b.textContent.trim().toLowerCase()===ch&&b.textContent.trim().length===1);
for(const ch of ans){if(ch===' '){const sp=document.querySelector('button[aria-label="띄어쓰기"]');sp?.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));await sleep(80);continue;}const k=key(ch.toLowerCase());if(!k)return 'nokey:'+ch;k.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));await sleep(60);}
await sleep(1500);return 'typed '+ans})()
