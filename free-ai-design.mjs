import {aiPolicy} from './resize-policy.mjs';
import './ai-layout-bridge.mjs';
import {validateDesigns,designMessages} from './free-ai-contract.mjs';
const $=id=>document.getElementById(id),panel=document.createElement('section');panel.className='card free-ai-design auto-layer-entry';panel.id='freeAiPanel';
panel.innerHTML=`<div class="auto-heading"><span class="auto-dot" aria-hidden="true"></span><strong>AI 디자인</strong></div><p>원본 요소로 배치 시안을 제안합니다. ${aiPolicy.enabled?'필요할 때만 실행하세요.':'현재 AI는 보류 중입니다.'}</p><details id="freeAiDetails"><summary>AI 디자인 안내·설정</summary><label class="free-ai-protect"><input id="preserveWholeSource" type="checkbox" checked> 원본 전체 보호 · 분리가 어려운 파일은 전체를 축소해 잘림 방지</label><details id="freeAiGpuHelp"><summary>GPU 가속 안내</summary><p>그래픽 장치(GPU)가 계산을 돕는 기능입니다. 이 AI 배치 기능은 WebGPU를 사용하며, 일반 규격 변경을 위해 AI를 켤 필요는 없습니다.</p><ol><li>별도 Chrome 또는 Edge 브라우저에서 설정을 엽니다.</li><li>설정에서 ‘그래픽 가속’을 검색하고 ‘가능한 경우 그래픽 가속 사용’을 켭니다.</li><li>편집 원본을 저장한 뒤 브라우저를 다시 시작합니다.</li></ol><p>사이트에서 이 설정을 직접 켤 수는 없습니다. 내장 브라우저에 설정이 없다면 일반 Chrome·Edge에서 열어 주세요. GPU·드라이버에 따라 지원되지 않을 수 있습니다.</p><p id="freeAiGpuStatus" role="status">이 안내를 펼치면 WebGPU 지원 여부만 확인합니다. 모델은 실행하지 않습니다.</p><p><a href="https://learn.microsoft.com/en-us/troubleshoot/microsoft-edge/development/video-playback-issues" target="_blank" rel="noopener">Edge 공식 설정 안내</a> · <a href="https://webllm.mlc.ai/docs/user/get_started.html" target="_blank" rel="noopener">WebLLM 실행 조건</a></p></details><p class="free-ai-help">기존 글씨·그림의 배치를 제안하며 새 사진을 그리지 않습니다. AI 실행을 허용한 뒤 첫 실행 시 모델 수백 MB를 다운로드합니다.</p><label for="freeAiBrief">원하는 디자인</label><textarea id="freeAiBrief" maxlength="600" placeholder="예: 케이크 사진을 크게, 제목은 강조하고 영업시간은 읽기 쉽게"></textarea><div class="free-ai-actions"><button id="freeAiGenerate" type="button" class="doc-btn">무료 AI 시안 만들기</button><button id="freeAiCancel" type="button" class="doc-btn" hidden>중지</button></div><p id="freeAiStatus" role="status" aria-live="polite">편집할 요소를 연 뒤 출력 너비·높이를 지정하세요.</p><div id="freeAiCards" class="free-ai-cards"></div><details id="freeAiSources"><summary>사용한 공개 소스</summary><ul><li><a href="https://github.com/mlc-ai/web-llm" target="_blank" rel="noopener">WebLLM 0.2.86</a>: 브라우저 AI 실행기 · Apache-2.0 (<a href="./vendor/webllm/LICENSE.txt" target="_blank">라이선스</a>)</li><li><a href="https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct" target="_blank" rel="noopener">Qwen2.5-0.5B-Instruct</a>: 배치 제안을 위한 모델 · Apache-2.0 (<a href="./vendor/webllm/LICENSE-Qwen.txt" target="_blank">라이선스</a>)</li><li><a href="https://github.com/fabricjs/fabric.js" target="_blank" rel="noopener">Fabric.js 7.4.0</a>: 요소 선택·편집·렌더링 · MIT (<a href="./vendor/layers/LICENSE-fabric.txt" target="_blank">라이선스</a>)</li><li><a href="https://github.com/facebook/yoga" target="_blank" rel="noopener">Yoga 3.2.1</a>: 배치 계산 · MIT (<a href="./vendor/yoga/LICENSE" target="_blank">라이선스</a>)</li></ul><p>AI 제안 후 실제 좌표·글자 크기·잘림·겹침은 사이트의 배치·검증 코드가 처리합니다.</p></details></details>`;
$('designSuggestions').append(panel);
const priorityTools=$('allowPriorityOmit')?.closest('.priority-tools');
if(priorityTools)$('freeAiDetails').append(priorityTools);
let worker=null,job=0,busy=false,context=null,applying=false,designs=[],sourceSeen=null,sceneSourceSeen=globalThis.getLayerAnalysisSource?.()?.key||null;
const bridge=()=>globalThis.coexAiLayout;
const status=(message,error=false)=>{$('freeAiStatus').textContent=message;$('freeAiStatus').classList.toggle('error',error);};
function stop(message='AI 작업을 중지했습니다.'){
 ++job;worker?.terminate();worker=null;busy=false;context=null;designs=[];$('freeAiCards').replaceChildren();$('freeAiCancel').hidden=true;$('freeAiGenerate').disabled=false;panel.removeAttribute('aria-busy');status(message);
}
function same(state){return sourceSeen===(globalThis.getLayerAnalysisSource?.()?.key||null)&&state&&context&&state.epoch===context.epoch&&state.revision===context.revision&&$('layerWidth').value===context.w&&$('layerHeight').value===context.h;}
function cards(list,model){
 const state=bridge().read();if(!same(state)){stop('원본이나 출력 규격이 바뀌어 AI 시안을 취소했습니다.');return;}
 const target=$('freeAiCards');target.replaceChildren();let usable=0;
 list.forEach((design,index)=>{
  const card=document.createElement('article'),title=document.createElement('h3');title.textContent='시안 '+(index+1)+' · 그림 '+(design.artSide==='left'?'왼쪽':'오른쪽');card.append(title);
  try{
   const result=bridge().preview(context.width,context.height,design),image=result.image,preview=document.createElement('img');preview.src=image;preview.alt=title.textContent;card.append(preview);if(result.omitted.length){const note=document.createElement('p');note.textContent='생략 예정: '+result.omitted.join(', ');card.append(note);}
   const button=document.createElement('button');button.type='button';button.className='doc-btn';button.textContent='이 시안 적용';button.onclick=()=>{
    const current=bridge().read();if(!same(current)){stop('요소나 출력 규격이 바뀌었습니다. 새 AI 시안을 만들어 주세요.');return;}
    applying=true;try{if(bridge().apply(context.width,context.height,design)){const next=bridge().read();context.epoch=next.epoch;context.revision=next.revision;sourceSeen=globalThis.getLayerAnalysisSource?.()?.key||null;panel.dataset.model=model;status('AI 시안을 적용했습니다. 실행 취소와 레이어별 수정이 가능합니다.');}}finally{applying=false;}
   };card.append(button);++usable;
  }catch(error){const why=document.createElement('p');why.textContent='적용 보류: '+error.message;card.append(why);}
  target.append(card);
 });
 panel.dataset.engine='webllm';panel.dataset.model=model;status(usable?usable+'개 AI 시안이 잘림·겹침 검사를 통과했습니다. 마음에 드는 시안을 선택하세요.':'AI 제안이 현재 요소의 안전 검사를 통과하지 못했습니다. 출력 크기·잠금·우선순위를 확인해 주세요.',!usable);
}
$('freeAiCancel').onclick=()=>stop();
$('freeAiGenerate').onclick=()=>{
 if(!aiPolicy.enabled){status(aiPolicy.reason);return;}
 if(globalThis.coexPhotoDesignBusy?.()){status('사진 AI가 끝난 뒤 배치 AI를 실행해 주세요. 이 PC의 메모리를 함께 보호합니다.',true);return;}
 const state=bridge()?.read(),width=Number($('layerWidth').value),height=Number($('layerHeight').value);
 const source=globalThis.getLayerAnalysisSource?.(),scene=globalThis.coexLayerLayout?.read();
 if(scene&&!scene.linked&&source?.key&&(scene.sourceKey?scene.sourceKey!==source.key:sceneSourceSeen!==source.key)){status('새 파일의 요소 인식이 끝날 때까지 기다려 주세요. 분리가 어려운 파일은 원본 전체 보호로 리사이징할 수 있습니다.',true);return;}
 if(!state||$('layerWork').hidden){status('먼저 파일을 열어 요소를 인식하거나 레이어 원본을 열어 주세요.',true);return;}
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>12000||height>12000||width*height>24000000){status('출력 크기를 먼저 확인해 주세요.',true);return;}
 stop('무료 AI를 준비합니다. 처음에는 모델 다운로드가 필요합니다.');busy=true;const ticket=job;
 context={epoch:state.epoch,revision:state.revision,width,height,w:$('layerWidth').value,h:$('layerHeight').value};sourceSeen=globalThis.getLayerAnalysisSource?.()?.key||null;
 $('freeAiGenerate').disabled=true;$('freeAiCancel').hidden=false;panel.setAttribute('aria-busy','true');
 worker=new Worker(new URL('./free-ai-worker.mjs',import.meta.url),{type:'module'});
 worker.onmessage=({data})=>{
  if(ticket!==job||data.job!==ticket)return;
  if(data.kind==='progress')status('무료 AI 준비 '+Math.round(data.progress*100)+'% · 첫 실행에는 모델 수백 MB를 내려받습니다.');
  if(data.kind==='inference')status('브라우저의 AI가 배치 시안을 생각하고 있습니다…');
  if(data.kind==='error'){stop('AI 실행을 완료하지 못했습니다. '+data.message);return;}
  if(data.kind==='complete'){
   busy=false;$('freeAiGenerate').disabled=false;$('freeAiCancel').hidden=true;panel.removeAttribute('aria-busy');
   try{designs=validateDesigns(data.text);cards(designs,data.model);}catch(error){status(error.message,true);}
   worker?.terminate();worker=null;
  }
 };
 worker.onerror=()=>{if(ticket===job)stop('무료 AI 실행기를 불러오지 못했습니다. 인터넷 연결과 GPU 가속을 확인해 주세요.');};
 worker.postMessage({job:ticket,messages:designMessages(state.items,width,height,$('freeAiBrief').value)});
};
for(const event of ['coex:layer-source','coex:history-source','coex:layer-edit'])window.addEventListener(event,()=>{if(!applying&&(busy||context))stop('원본이나 요소가 바뀌었습니다. 새 AI 시안을 만들 수 있습니다.');});
window.addEventListener('coex:history-source',()=>{sceneSourceSeen=globalThis.getLayerAnalysisSource?.()?.key||null;});
$('resetBtn').addEventListener('click',()=>{stop('새 파일을 선택해 시작하세요.');$('freeAiBrief').value='';$('allowPriorityOmit').checked=false;$('priorityMinText').value='12';$('preserveWholeSource').checked=true;});
for(const [element,event]of [[$('fileInput'),'change'],[$('dropzone'),'drop']])element.addEventListener(event,()=>{if(busy||context)stop('새 파일을 선택해 AI 작업을 취소했습니다.');},true);
document.addEventListener('paste',e=>{if(e.clipboardData?.files?.length&&(busy||context))stop('새 파일을 붙여 넣어 AI 작업을 취소했습니다.');},true);
for(const [id,event]of [['freeAiBrief','input'],['allowPriorityOmit','change'],['priorityMinText','input'],['preserveWholeSource','change']])$(id).addEventListener(event,()=>{if(busy||context)stop('AI 시안의 기준 요청이 바뀌었습니다. 새 시안을 만들어 주세요.');});
const monitor=setInterval(()=>{if(context&&(sourceSeen!==(globalThis.getLayerAnalysisSource?.()?.key||null)||!same(bridge()?.read())))stop('원본·요소 또는 출력 크기가 바뀌어 AI 시안을 정리했습니다.');},400);
window.addEventListener('pagehide',()=>{worker?.terminate();clearInterval(monitor);});
// Keep a flattened original intact whenever editable reflow is unavailable.
const protect=()=>{$('fitMode').value='auto';};
const originalSettings=globalThis.readCompositionSettings;globalThis.readCompositionSettings=function(){const settings=originalSettings();settings.mode='auto';settings.resizeBehavior='auto';return settings;};

let sizeTimer=null;
function connected(){const state=globalThis.coexLayerLayout?.read(),source=globalThis.getLayerAnalysisSource?.();return state&&(state.linked||state.sourceKey&&state.sourceKey===source?.key)?state:null;}
const originalSchedule=globalThis.scheduleRender;globalThis.scheduleRender=function(...args){
 if($('preserveWholeSource').checked)protect();
 const state=connected(),w=Number($('wInput').value),h=Number($('hInput').value);
 if(!bridge().busy&&$('allowPriorityOmit').checked&&state&&Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&w<=12000&&h<=12000&&w*h<=24000000&&(w!==state.width||h!==state.height)){
  clearTimeout(sizeTimer);globalThis.invalidate();const epoch=state.epoch,revision=state.revision;
  sizeTimer=setTimeout(()=>{const next=connected();if(next&&next.epoch===epoch&&next.revision===revision&&Number($('wInput').value)===w&&Number($('hInput').value)===h)bridge().apply(w,h);},180);return;
 }
 return originalSchedule(...args);
};
const originalPreset=globalThis.applyPreset;globalThis.applyPreset=function(p){
 if($('preserveWholeSource').checked)protect();
 if($('allowPriorityOmit').checked&&connected()){
  clearTimeout(sizeTimer);if(bridge().apply(p.w,p.h)){if(typeof activePreset!=='undefined')activePreset=p;globalThis.renderPresetCards?.();globalThis.renderActiveInfo?.();}return;
 }
 return originalPreset(p);
};
$('preserveWholeSource').onchange=()=>{if($('preserveWholeSource').checked)protect();globalThis.scheduleRender();};

// Lazy capability check only: no model, worker, download or inference.
let gpuHelpChecked=false;
$('freeAiGpuHelp').addEventListener('toggle',async()=>{
 if(!$('freeAiGpuHelp').open||gpuHelpChecked)return;gpuHelpChecked=true;
 $('freeAiGpuStatus').textContent='WebGPU 지원 여부를 확인하고 있습니다…';
 try{const adapter=await navigator.gpu?.requestAdapter();$('freeAiGpuStatus').textContent=adapter?'이 브라우저에서 WebGPU 계산 장치를 확인했습니다. AI 보류 설정은 그대로 유지됩니다.':'WebGPU 계산 장치를 찾지 못했습니다. 그래픽 가속·브라우저·드라이버를 확인하세요. 일반 규격 변경은 계속 사용할 수 있습니다.';}
 catch{$('freeAiGpuStatus').textContent='WebGPU 지원 여부를 확인하지 못했습니다. 일반 규격 변경은 계속 사용할 수 있습니다.';}
});
