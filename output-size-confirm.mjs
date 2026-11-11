// Draft dimensions never reach rendering, exports or scene history until confirmed.
import './layers.mjs';
import './responsive-layout.mjs';
const by=id=>document.getElementById(id),w=by('wInput'),h=by('hInput'),host=by('outputSizeControls');
if(w&&h&&host){
 const fields=[w,h],drafts=fields.map((input,index)=>{const draft=input.cloneNode();draft.id=index?'outputHeightDraft':'outputWidthDraft';draft.setAttribute('aria-describedby','outputSizeDraftStatus');input.before(draft);input.type='hidden';input.setAttribute('aria-hidden','true');host.querySelector('label[for="'+input.id+'"]').htmlFor=draft.id;input.focus=options=>draft.focus(options);return draft;});
 const row=document.createElement('div');row.className='sns-toolbar';row.style.marginTop='10px';row.innerHTML='<button type="button" class="doc-btn" id="confirmOutputSize">규격 적용</button><span id="outputSizeDraftStatus" class="sns-helper" role="status" aria-live="polite"></span>';
 row.querySelector('#outputSizeDraftStatus').style.cssText='flex-basis:100%;min-height:3em;line-height:1.4;margin:0';
 host.querySelector('.dims').after(row);
 let confirmed=[w.value,h.value],dirty=false,queued=false;
 function sync(force=false){const next=[w.value,h.value],changed=next.some((value,i)=>value!==confirmed[i]);if(force||changed||!dirty){confirmed=next;drafts.forEach((d,i)=>d.value=next[i]);dirty=false;by('outputSizeDraftStatus').textContent=next.every(Boolean)?'적용된 규격 '+next[0]+' × '+next[1]+' px':'';}}
 function deferSync(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync();});}
 const descriptor=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
 for(const input of fields)Object.defineProperty(input,'value',{configurable:true,get(){return descriptor.get.call(this);},set(value){descriptor.set.call(this,value);deferSync();}});
 drafts.forEach((draft,index)=>draft.addEventListener('input',()=>{
  dirty=true;const n=Number(draft.value),locked=by('lockBtn').getAttribute('aria-checked')==='true',a=Number(confirmed[0]),b=Number(confirmed[1]);
  if(locked&&Number.isFinite(n)&&n>0&&a>0&&b>0)drafts[1-index].value=String(Math.max(1,Math.round(index?n*a/b:n*b/a)));
  by('outputSizeDraftStatus').textContent='입력 중 · 규격 적용을 누르면 변경됩니다.';
 }));
 by('confirmOutputSize').onclick=()=>{
  const values=drafts.map(d=>Number(d.value)),[width,height]=values;
  if(!values.every(n=>Number.isInteger(n)&&n>=1&&n<=12000)||width*height>24000000){by('outputSizeDraftStatus').textContent='너비·높이는 1~12,000의 정수, 전체 2,400만 픽셀 이내로 입력하세요.';return;}
  if(width===Number(w.value)&&height===Number(h.value)){dirty=false;sync(true);return;}
  dirty=false;w.value=String(width);h.value=String(height);sync(true);
  // Legacy inputs stay committed-only; one render request applies the pair together.
  by('pctInput').value='';globalThis.scheduleRender();
 };
 function cancelDraft(){dirty=false;sync(true);}
 const originalPreset=globalThis.applyPreset;globalThis.applyPreset=function(...args){cancelDraft();return originalPreset(...args);};
 for(const event of ['coex:layer-source'])window.addEventListener(event,cancelDraft);
 by('fileInput').addEventListener('change',cancelDraft,true);by('dropzone').addEventListener('drop',cancelDraft,true);by('resetBtn').addEventListener('click',cancelDraft,true);
 document.addEventListener('paste',e=>{if(e.clipboardData?.files?.length)cancelDraft();},true);
 sync(true);
}
