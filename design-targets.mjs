import './design-candidates.mjs';
import './free-ai-design.mjs';
// Size changes produce quick, editable candidates without downloading an AI model.
const $=id=>document.getElementById(id),api=()=>globalThis.coexLayerLayout;
const controls=document.createElement('label');controls.className='design-check';
controls.innerHTML='<input id="designAutoResize" type="checkbox" checked> 규격을 바꾸면 해당 크기의 디자인 후보 자동 만들기';
$('designCandidates').querySelector('.design-actions').before(controls);
let timer=null,pending=null;
function cancel(){clearTimeout(timer);pending=null;}
function request(w,h){
 w=Number(w);h=Number(h);cancel();
 if(!$('designAutoResize').checked||!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>12000||h>12000||w*h>24000000)return;
 const state=api()?.read(),source=globalThis.getLayerAnalysisSource?.();
 if(!state)return;
 pending={w,h,epoch:state.epoch,key:source?.key||null,started:Date.now()};
 // Hide old dimensions immediately, including an enlarged old candidate.
 $('designResults').replaceChildren();$('designDialog')?.close();
 $('designStatus').textContent=`${w} × ${h}px에 맞는 디자인 후보를 준비합니다…`;
 timer=setTimeout(run,550);
}
function run(){
 const target=pending,state=api()?.read(),source=globalThis.getLayerAnalysisSource?.();
 if(!target)return;
 const sourceChanged=(source?.key||null)!==target.key;
 // Committing a reflow replaces an uploaded raster with its linked layer snapshot.
 if(!state||state.epoch!==target.epoch||sourceChanged&&!(target.key&&!source?.key&&state.linked)){cancel();return;}
 if($('designCandidates').getAttribute('aria-busy')==='true'){
  if(Date.now()-target.started<15000){timer=setTimeout(run,100);return;}
  cancel();return;
 }
 pending=null;
 $('layerWidth').value=String(target.w);$('layerHeight').value=String(target.h);
 window.dispatchEvent(new CustomEvent('coex:design-target-ready',{detail:{width:target.w,height:target.h}}));
 $('designGenerate').click();
}
for(const id of ['wInput','hInput','pctInput'])$(id)?.addEventListener('input',()=>request($('wInput').value,$('hInput').value));
for(const id of ['layerWidth','layerHeight'])$(id)?.addEventListener('input',()=>request($('layerWidth').value,$('layerHeight').value));
for(const id of ['reflowRatio','layerPreset'])$(id)?.addEventListener('change',()=>{const value=$(id).value;if(value){const [w,h]=value.split('x');request(w,h);}});
for(const id of ['reflowCustomApply','reflowApply','layerResize'])$(id)?.addEventListener('click',()=>request($('layerWidth').value,$('layerHeight').value));
const preset=globalThis.applyPreset;
globalThis.applyPreset=function(p){const result=preset(p);request(p.w,p.h);return result;};
$('designAutoResize').addEventListener('change',()=>{if(!$('designAutoResize').checked)cancel();});
for(const event of ['coex:layer-source','coex:history-source'])window.addEventListener(event,cancel);
for(const [id,event]of [['fileInput','change'],['dropzone','drop']])$(id)?.addEventListener(event,cancel,true);
document.addEventListener('paste',e=>{if(e.clipboardData?.files?.length)cancel();},true);
$('resetBtn').addEventListener('click',()=>{cancel();$('designAutoResize').checked=true;});
window.addEventListener('pagehide',cancel);
