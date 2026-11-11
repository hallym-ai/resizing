import {mountCandidateClickPicker} from './candidate-click.mjs';
import './photo-instance-import.mjs';
const by=id=>document.getElementById(id),endpoint='http://127.0.0.1:8191';
const button=document.createElement('button');button.type='button';button.className='doc-btn';button.id='instanceAnalyze';button.textContent='사진 속 물체 자동 찾기';by('layerImageAdd').after(button);
const panel=document.createElement('details');panel.id='instanceAnalysisPanel';panel.innerHTML='<summary>물체 자동 분리</summary><p class="layer-help">파일을 열면 큰 사진 한 장을 기존 SAM2로 자동 분석합니다. 다른 사진은 선택 후 자동 찾기를 누르세요. 분석은 후보만 표시하며 원본을 바꾸지 않습니다. 선택한 사진에서 물체 후보를 찾습니다. 적용할 그림만 체크한 뒤 분리하세요. 다른 문구·로고는 유지합니다. 이 PC에서 분석하며 외부에 보내지 않습니다.</p><p id="instanceAnalysisStatus" class="layer-help" role="status" aria-live="polite">사진 요소를 선택하거나 자동 찾기를 누르세요.</p><button type="button" id="instanceAnalysisCancel" class="doc-btn" hidden>분석 중지</button><div id="instanceAnalysisCandidates" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"></div><button type="button" id="instanceAnalysisApply" class="doc-btn" hidden>선택한 그림을 각각의 레이어로 분리</button>';
const layout=by('layerStage')?.closest('.layer-layout');
if(layout) layout.before(panel); else by('photoInstancesPanel').before(panel);
let generation=0,busy=false,jobId=null,context=null,results=[],clickPicker=null;
let automaticTimer;const attempted=new WeakSet();
const say=t=>by('instanceAnalysisStatus').textContent=t;
const valid=()=>{const s=globalThis.coexLayerLayout?.read();return s&&context&&s.epoch===context.epoch&&s.revision===context.revision&&s.objects.includes(context.object);};
function eligible(o){return String(o?.type).toLowerCase()==='image'&&o.visible!==false&&!o.layerLocked&&o.layerRole!=='background'&&!o.sourceText&&!o.photoInstanceKind;}
async function stop(){generation++;busy=false;button.disabled=false;by('instanceAnalysisCancel').hidden=true;by('instanceAnalysisApply').hidden=true;results=[];const key=jobId;jobId=null;if(key)try{await fetch(endpoint+'/jobs/'+key+'/cancel',{method:'POST'});}catch{}}
by('instanceAnalysisCancel').onclick=()=>{stop();say('분석을 중지했습니다. 원본은 유지됩니다.');};
async function analyzePhoto(automatic=false,target=null){
 if(busy)return;const s=globalThis.coexLayerLayout?.read();if(!s){say('먼저 파일을 열어 주세요.');return;}const canvas=s.objects.find(o=>o.canvas)?.canvas,active=canvas?.getActiveObject();
 const o=target||(eligible(active)?active:s.objects.filter(eligible).sort((a,b)=>b.width*b.height-a.width*a.height)[0]);if(!o){say('분리할 사진 요소를 선택하세요.');return;}
 clickPicker?.element.remove();clickPicker=null;canvas.setActiveObject(o);canvas.fire('selection:updated');context={epoch:s.epoch,revision:s.revision,object:o};const token=++generation;busy=true;button.disabled=true;panel.open=true;by('instanceAnalysisCandidates').replaceChildren();by('instanceAnalysisApply').hidden=true;by('instanceAnalysisCancel').hidden=false;say((automatic?'파일 속 사진을 SAM2로 자동 분석합니다. ':'')+'로컬 개체 분석을 준비하고 있습니다…');
 try{
  const health=await fetch(endpoint+'/health',{signal:AbortSignal.timeout(5000)}).then(r=>r.json());if(health.service!=='coex-local-instance'||!health.ready)throw Error('로컬 개체 분석 준비를 확인하지 못했습니다.');
  if(health.busy)throw Error('로컬 모델이 다른 작업을 처리 중입니다. 작업 완료 후 자동 찾기를 다시 누르세요.');
  const source=/^data:image\/png;base64,/.test(o.originalPhotoSource||'')?o.originalPhotoSource:o.getSrc();
  const response=await fetch(endpoint+'/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source})});const data=await response.json();if(!response.ok)throw Error(data.error);if(token!==generation){await fetch(endpoint+'/jobs/'+data.id+'/cancel',{method:'POST'});return;}jobId=data.id;
  while(token===generation){
   await new Promise(resolve=>setTimeout(resolve,800));if(token!==generation)return;if(!valid()){await stop();say('원본이나 편집 상태가 바뀌어 분석을 중지했습니다.');return;}
   const job=await fetch(endpoint+'/jobs/'+jobId).then(r=>r.json());say((job.phase||'개체 분석 중')+(job.progress!==undefined?' · '+job.progress+'%':''));
   if(job.status==='failed')throw Error(job.error);if(job.status==='cancelled')return;if(job.status!=='completed')continue;
   results=await Promise.all(job.result.objects.map(async(item,i)=>{const blob=await fetch(endpoint+'/jobs/'+jobId+'/'+item.file).then(r=>r.blob());return {...item,file:new File([blob],'물체-'+(i+1)+'.png',{type:'image/png'})};}));
   if(token!==generation||!valid())return;
   for(const [i,item]of results.entries()){const label=document.createElement('label');label.style.cssText='display:block;border:1px solid var(--border);padding:6px;border-radius:7px';const image=new Image();const url=URL.createObjectURL(item.file);image.src=url;image.onload=()=>URL.revokeObjectURL(url);image.alt=item.name+' · 물체 후보';image.style.cssText='width:100%;height:120px;object-fit:contain;background:#ddd';const check=document.createElement('input');check.type='checkbox';check.dataset.instanceIndex=i;check.checked=false;const text=document.createElement('span');text.textContent=' '+item.name;label.append(image,check,text);by('instanceAnalysisCandidates').append(label);}
   if(results.length){try{clickPicker=await mountCandidateClickPicker({source,items:results,checks:[...by('instanceAnalysisCandidates').querySelectorAll('input')],host:by('instanceAnalysisCandidates'),valid});}catch(e){say('사진 클릭 선택은 사용할 수 없습니다. 아래 후보 목록을 확인하세요.');}}
   by('instanceAnalysisApply').hidden=results.length<2;say(results.length?'후보 '+results.length+'개를 찾았습니다. 배경 조각은 해제하고 분리할 물체를 체크하세요.':'확실한 물체 후보를 찾지 못했습니다. 원본 사진을 유지합니다.');break;
  }
 }catch(e){say('개체 분석 확인 필요: '+e.message+' 원본은 유지했습니다.');}finally{if(token===generation){busy=false;button.disabled=false;by('instanceAnalysisCancel').hidden=true;jobId=null;}}
};
button.onclick=()=>analyzePhoto(false);
function scheduleAutomatic(){
 clearTimeout(automaticTimer);automaticTimer=setTimeout(()=>{
  const s=globalThis.coexLayerLayout?.read();if(!s||busy)return;
  if(s.objects.some(o=>o.photoInstanceKind))return;
  const pictures=s.objects.filter(o=>eligible(o)&&Math.abs(o.width*o.scaleX*o.height*o.scaleY)>=s.width*s.height*.04).sort((a,b)=>Math.abs(b.width*b.scaleX*b.height*b.scaleY)-Math.abs(a.width*a.scaleX*a.height*a.scaleY));
  const target=pictures[0];if(!target||attempted.has(target))return;
  attempted.add(target);analyzePhoto(true,target);
 },900);
}
window.addEventListener('coex:history-source',scheduleAutomatic);
window.addEventListener('coex:layer-source',()=>clearTimeout(automaticTimer));
by('instanceAnalysisApply').onclick=async()=>{if(!valid()){say('원본이 바뀌었습니다. 다시 분석해 주세요.');return;}const chosen=[...by('instanceAnalysisCandidates').querySelectorAll('input:checked')].map(el=>results[Number(el.dataset.instanceIndex)].file);if(chosen.length<2){say('분리할 물체를 두 개 이상 선택하세요.');return;}context.object.canvas.setActiveObject(context.object);context.object.canvas.fire('selection:updated');await globalThis.coexLoadInstanceMasks(chosen);if(!by('photoInstancesApply').hidden){await by('photoInstancesApply').onclick();say(by('photoInstancesStatus').textContent);by('instanceAnalysisApply').hidden=true;}else say(by('photoInstancesStatus').textContent);};
for(const event of ['coex:layer-source','coex:layer-edit'])window.addEventListener(event,()=>{if(busy){stop();say('편집 상태 변경으로 분석을 중지했습니다.');}});
window.addEventListener('coex:layer-source',()=>{clickPicker?.element.remove();clickPicker=null;context=null;results=[];by('instanceAnalysisCandidates').replaceChildren();by('instanceAnalysisApply').hidden=true;});
