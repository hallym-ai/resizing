import assert from 'node:assert/strict';
import {HistoryStore} from './history-store.mjs';
const make=(text,images)=>JSON.stringify({text,images,nested:{s:'한글 🎨 \" \\n prototype __proto__',fake:'data:image/x;base64,%%%'}});
const blob='data:image/png;base64,'+'A'.repeat(15_000_000), blob2='data:image/png;base64,'+'B'.repeat(3_000_000);
const a=make('원본',[blob,blob2]),b=make('편집',[blob,blob2]),c=make('다시 편집',[blob,blob2]);
const h=new HistoryStore();assert(h.push(a));assert(h.push(b));assert(h.canUndo());assert.equal(h.read(0),a);assert.equal(h.read(1),b);assert.equal(h.stats().assets,2);assert(h.stats().bytes<19_000_000);const t=h.peek(-1);assert.equal(t.json,a);assert.equal(h.cursor,1);h.commit(t.index);assert.equal(h.cursor,0);assert(h.canRedo());assert(h.push(c));assert(!h.canRedo());assert.equal(h.read(1),c);assert.equal(h.stats().assets,2);
const before=h.stats();try{const p=h.peek(-1);throw Error('restore failed')}catch{}assert.deepEqual(h.stats(),before,'failed restore cannot move cursor');assert(!h.push(c));
const tricky=['__proto__','</script>','한글\\u0000','data:image/png;base64,'+'A'.repeat(1023)+'%', 'data:image/png;base64,'+'Z'.repeat(1024)+'\\n'];for(const s of tricky){let v=make(s,[s]);h.push(v);assert.equal(h.read(),v)}
const many=new HistoryStore({maxEntries:3,maxBytes:4000});for(let i=0;i<10;i++)many.push(JSON.stringify({i,x:'z'.repeat(1200)}));assert.equal(many.stats().entries,1);assert.equal(many.read(),JSON.stringify({i:9,x:'z'.repeat(1200)}));many.clear();assert.deepEqual(many.stats(),{entries:0,cursor:-1,assets:0,bytes:0});
const oversize=new HistoryStore({maxBytes:100});oversize.push(a);assert.equal(oversize.read(),a);assert.equal(oversize.stats().entries,1);oversize.push(b);assert.equal(oversize.stats().entries,1);assert.equal(oversize.read(),b);
const lots='data:image/png;base64,'+'X'.repeat(1024),manyUrls=JSON.stringify(Array(513).fill(lots));const m=new HistoryStore();m.push(manyUrls);assert.equal(m.read(),manyUrls);assert.equal(m.stats().assets,0);
const malicious=JSON.stringify({text:'data:image/png;base64,'+'A'.repeat(1024)+'\\";window.alert(1)//',toString:'constructor',null:'\u0000'});m.push(malicious);assert.equal(m.read(),malicious);
const adversarial=JSON.stringify({text:'data:'.repeat(120000)+';base64,'});m.push(adversarial);assert.equal(m.read(),adversarial);
console.log(JSON.stringify({roundTrip:true,undoRedoBranch:true,restoreFailureUnchanged:true,unicodeAndMalicious:true,budgetAndSingleLarge:true,maxAssetGuard:true,dedupBytes:h.stats().bytes,normalSingleSceneUtf16Bytes:a.length*2}));
