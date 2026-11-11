import {verifyRasterSeparation} from './raster-separation-proof.mjs';
import {aiPolicy} from './resize-policy.mjs';
import {looksLikePhoto} from './photo-ai-flow.mjs';
import {assessSplit} from './split-quality.mjs';
/* Automatic local recognition: no language/model/start/import controls. */
import './layers.mjs';
const $=id=>document.getElementById(id),MAX_REGIONS=140,MAX_PIXELS=8000000;
const panel=document.createElement('section');panel.className='card auto-layer-entry';panel.id='autoLayerPanel';
panel.innerHTML=`<div class="auto-heading"><span class="auto-dot" aria-hidden="true"></span><strong>자동 요소 인식</strong></div><p id="autoStatus" role="status" aria-live="polite">파일을 열면 글자와 그림을 자동으로 인식합니다.</p><progress id="autoBusy" max="100" value="0" hidden></progress><details><summary>인식 안내</summary><p>이미지·PDF 페이지는 자동 인식하고, PPTX는 원래 글자·그림 객체를 직접 분리해 아래 편집기에 레이어로 엽니다. 한국어·영어를 함께 읽고 필요한 글자 영역만 다시 확인합니다. 불확실한 한글은 정밀 모델로 자동 재확인할 수 있습니다. 처음 인식기를 준비할 때는 시간이 걸릴 수 있습니다.</p><p>로고·글자·그림은 단색에 가까운 주변 배경을 투명하게 분리하며, 투명한 곳은 요소 선택에서 제외합니다. 글자 내용은 요소를 선택해 확인·수정할 수 있습니다. 글자·그림 영역이 겹치거나 복잡한 배경을 구별하지 못하면 자동 레이어 생성을 중단하고 원본 리사이징을 유지합니다. 인식하지 못한 겹침은 남을 수 있으므로 가장자리·이동 후 드러나는 부분을 확인하세요. PPTX는 원래 객체를 직접 가져오며 사진 한 장 속 글자를 원본 객체로 복원하지는 않습니다. 한 글자로 오인한 도형은 글자로 확정하지 않습니다. 분석은 긴 변 2400px·800만 픽셀·140영역·최대 2분, 한글 부분 재확인은 최대 12곳·정밀 재확인은 3곳입니다. 사진 AI는 현재 보류 중이며 자동 모델 다운로드와 추론을 실행하지 않습니다. 아래는 향후 AI 재개 시 사용할 기존 경로 안내입니다. BiRefNet 512 모델을 별도로 준비해 브라우저에서 실행하는 방식입니다. GPU·CPU가 공유하는 모델 약165MB와 실행 파일이 처음 한 번 필요하며 캐시를 재사용합니다. AI 결과는 전경·배경 추정이며 글자가 섞인 사진은 개별 재배치를 자동 적용하지 않습니다. 파일은 외부로 전송하지 않습니다.</p><p>Tesseract.js 6.0.1 · 공식 tessdata_fast / tessdata_best 한국어 모델 (Apache-2.0). 언어를 선택할 필요 없이 한국어·영어를 함께 처리합니다. 다른 언어·작은 글자·장식 글꼴은 오인식할 수 있습니다. <a href="./vendor/ocr/vendor-lock.json" target="_blank" rel="noopener">출처·버전</a></p></details>`;
$('layerPanel').before(panel);
const sourceNow=()=>globalThis.getLayerAnalysisSource?.();
const sameSource=(a,b)=>!!a&&!!b&&a.source===b.source&&a.key===b.key;
const equalSource=(a,b)=>a===b||sameSource(a,b);
const status=(text,error=false)=>{$('autoStatus').textContent=text;panel.classList.toggle('error',error);};
const slots={fast:{worker:null,pending:null,language:null},best:{worker:null,pending:null,language:null}};
let job=0,busy=false,observed=null,ignored=null,pending=null,idleTimer=null,libraryPromise=null,regionWorker=null,regionReject=null,cutoutWorker=null,cutoutReject=null,importAbort=null,disposed=false,photoAbort=null;
const current=(token,source)=>!disposed&&token===job&&sameSource(source,sourceNow())&&!sameSource(source,ignored);
function check(token,source){if(!current(token,source))throw Error('CANCELLED');}
function terminateWorkers(){for(const slot of Object.values(slots)){void slot.worker?.terminate().catch(()=>{});slot.worker=null;slot.language=null;}}
function cancelJob(){
 photoAbort?.abort();photoAbort=null;globalThis.clearPhotoAIResult?.();
 ++job;clearTimeout(pending);pending=null;clearTimeout(idleTimer);idleTimer=null;importAbort?.abort();importAbort=null;
 if(busy)terminateWorkers();busy=false;panel.setAttribute('aria-busy','false');$('autoBusy').hidden=true;
 const reject=regionReject;regionReject=null;regionWorker?.terminate();regionWorker=null;reject?.(Error('CANCELLED'));
 const maskReject=cutoutReject;cutoutReject=null;cutoutWorker?.terminate();cutoutWorker=null;maskReject?.(Error('CANCELLED'));
 if(!disposed)idleTimer=setTimeout(terminateWorkers,60000);
}
function loadLibrary(){
 if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('./vendor/ocr/tesseract.min.js',import.meta.url).href;script.onload=()=>globalThis.Tesseract?resolve():reject(Error('인식기를 준비하지 못했습니다.'));script.onerror=()=>reject(Error('인식 파일을 읽지 못했습니다. 온라인 사이트 또는 시작.cmd로 실행해 주세요.'));document.head.append(script);}).catch(e=>{libraryPromise=null;throw e;});return libraryPromise;
}
async function acquire(model,languages,token,source){
 const slot=slots[model];
 if(slot.pending){await slot.pending.catch(()=>{});check(token,source);}
 if(!slot.worker){
  const startup=Tesseract.createWorker(languages,1,{workerPath:new URL('./vendor/ocr/worker.min.js',import.meta.url).href,corePath:new URL('./vendor/ocr/core/',import.meta.url).href,langPath:new URL(model==='best'?'./vendor/ocr/best':'./vendor/ocr/lang',import.meta.url).href,cachePath:model==='best'?'coex-auto-best-e12c65':'coex-auto-fast-874164',cacheMethod:model==='best'?'none':'write',gzip:false,workerBlobURL:false,logger:message=>{if(busy&&current(token,source))$('autoBusy').value=Math.round((message.progress||0)*70);}}).then(async worker=>{if(!current(token,source)){await worker.terminate();throw Error('CANCELLED');}slot.worker=worker;slot.language=languages;return worker;});slot.pending=startup;
  try{await startup;}finally{if(slot.pending===startup)slot.pending=null;}
 }
 check(token,source);
 const worker=slot.worker;
 if(slot.language!==languages){await worker.reinitialize(languages,1);check(token,source);slot.language=languages;}
 return worker;
}
const parameters=psm=>({tessedit_pageseg_mode:String(psm),preserve_interword_spaces:'1',user_defined_dpi:'200'});
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
function clampBox(b,w,h){const x=Math.max(0,Math.floor(b.x)),y=Math.max(0,Math.floor(b.y)),right=Math.min(w,Math.ceil(b.x+b.w)),bottom=Math.min(h,Math.ceil(b.y+b.h));return {...b,x,y,w:right-x,h:bottom-y};}
function linesFrom(data,scale,w,h){
 const regions=[];let skipped=0;
 for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[]){
  const text=(line.text||line.words?.map(word=>word.text).join(' ')||'').trim(),box=line.bbox,confidence=Number(line.confidence??paragraph.confidence??block.confidence??0);
  if(!text||!box)continue;
  if(text.replace(/[^\p{L}\p{N}]/gu,'').length<2||!Number.isFinite(confidence)||confidence<25){skipped++;continue;}
  const b=clampBox({x:(box.x0-2)/scale,y:(box.y0-2)/scale,w:(box.x1-box.x0+4)/scale,h:(box.y1-box.y0+4)/scale},w,h);
  if(b.w>=3&&b.h>=3)regions.push({...b,type:'text',text:text.slice(0,20000),confidence,include:true,method:'tesseract-auto'});
 }
 return {regions:regions.slice(0,100),skipped:skipped+Math.max(0,regions.length-100)};
}
async function refineKorean(text,image,token,source){
 const candidates=text.regions.filter(b=>/[가-힣]/.test(b.text)||b.confidence<85).slice(0,12);if(!candidates.length)return;
 const worker=await acquire('fast','kor',token,source);await worker.setParameters(parameters(7));check(token,source);
 const uncertain=[];
 for(const b of candidates){
  check(token,source);status('글자 영역을 자동으로 확인하는 중…');
  const crop=document.createElement('canvas'),scale=b.h<32?2:1;crop.width=b.w*scale;crop.height=b.h*scale;
  const ctx=crop.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,crop.width,crop.height);ctx.drawImage(image,b.x,b.y,b.w,b.h,0,0,crop.width,crop.height);
  try{
   const result=await worker.recognize(crop,{}, {text:true,blocks:true});check(token,source);improve(b,result.data);
   if(/[가-힣]/.test(b.text)&&b.confidence<70&&uncertain.length<3)uncertain.push({b,crop});else crop.width=crop.height=0;
  }catch(e){crop.width=crop.height=0;throw e;}
 }
 if(uncertain.length){
  try{status('읽기 어려운 글자를 자동으로 확인하는 중…');const precise=await acquire('best','kor',token,source);await precise.setParameters(parameters(7));
   for(const {b,crop}of uncertain){check(token,source);const result=await precise.recognize(crop,{}, {text:true,blocks:true});check(token,source);improve(b,result.data);}
  }finally{uncertain.forEach(({crop})=>crop.width=crop.height=0);}
 }
}
function improve(b,data){
 const candidate=String(data.text||'').trim(),confidence=Number(data.confidence);
 if(candidate.replace(/[^\p{L}\p{N}]/gu,'').length>=2&&/[가-힣]/.test(candidate)&&Number.isFinite(confidence)&&confidence>b.confidence&&(/[가-힣]/.test(b.text)||confidence>=85)){b.text=candidate.slice(0,20000);b.confidence=confidence;}
}
function graphics(pixels,w,h,textBoxes){return new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('./region-worker.js',import.meta.url));regionWorker=worker;regionReject=reject;
 const finish=(error,value)=>{worker.terminate();if(regionWorker===worker){regionWorker=null;regionReject=null;}error?reject(error):resolve(value);};
 worker.onmessage=e=>e.data.error?finish(Error(e.data.error)):finish(null,e.data);worker.onerror=()=>finish(Error('그림 영역을 읽지 못했습니다.'));worker.postMessage({width:w,height:h,pixels:pixels.buffer,textBoxes},[pixels.buffer]);
});}
function photoRequired(message,textMixed){const error=Error(message);error.photoAI=true;error.textMixed=textMixed;return error;}
async function analyze(source){
 const token=job;busy=true;clearTimeout(idleTimer);panel.setAttribute('aria-busy','true');$('autoBusy').hidden=false;$('autoBusy').value=0;status('글자와 그림을 자동으로 인식하는 중…');
 const started=performance.now();let image=null;
 const timeout=setTimeout(()=>{if(current(token,source)){cancelJob();status('인식 시간이 초과되었습니다. 원본 이미지 리사이징은 계속 사용할 수 있습니다.',true);}},120000);
 try{
  if(source.nativeError)throw Error(source.nativeError+' 원본 리사이징은 사용할 수 있습니다. PPTX를 이미지 OCR로 임의 분리하지 않았습니다.');
  if(source.nativeProject){
   status('PPTX 원래 글자·그림 객체를 레이어로 여는 중…');check(token,source);
   const doc={...source.nativeProject,inputKind:'layered',sourceFormat:'pptx'},blob=new Blob([JSON.stringify(doc)],{type:'application/json'});if(blob.size>48*1024*1024)throw Error('PPTX 레이어가 너무 큽니다.');
   importAbort=new AbortController();const loaded=await globalThis.layerFileImport(new File([blob],source.name+'.json',{type:'application/json'}),{origin:'auto',sourceKey:source.key,signal:importAbort.signal,beforeCommit:()=>current(token,source)});check(token,source);
   if(!loaded)throw Error('PPTX 객체 레이어를 열지 못했습니다.');
   status(`PPTX 원본 객체 ${doc.analysis.objectCount}개 · 독립 글자 ${doc.analysis.textCount}개를 열었습니다. OCR로 그림과 글자를 다시 자르지 않았습니다. ${doc.analysis.warnings.join(' ')}`);
   globalThis.prepareInitialNativeFrame?.();
   globalThis.scheduleRender?.();
   panel.dataset.completedKey=source.key;panel.dataset.durationMs=String(Math.round(performance.now()-started));panel.dataset.sourceEngine='pptx-original-objects';return;
  }
  delete panel.dataset.sourceEngine;
  const sw=source.source.naturalWidth||source.source.width,sh=source.source.naturalHeight||source.source.height,scale=Math.min(1,2400/Math.max(sw,sh),Math.sqrt(MAX_PIXELS/(sw*sh)));
  image=document.createElement('canvas');image.width=Math.max(1,Math.round(sw*scale));image.height=Math.max(1,Math.round(sh*scale));image.getContext('2d').drawImage(source.source,0,0,image.width,image.height);
  await loadLibrary();check(token,source);const worker=await acquire('fast','kor+eng',token,source);await worker.setParameters(parameters(11));check(token,source);
  const ocr=document.createElement('canvas');ocr.width=image.width;ocr.height=image.height;const ctx=ocr.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,ocr.width,ocr.height);ctx.drawImage(image,0,0);
  let result;try{result=await worker.recognize(ocr,{}, {text:true,blocks:true});}finally{ocr.width=ocr.height=0;}check(token,source);
  const text=linesFrom(result.data,1,image.width,image.height);
  try{await refineKorean(text,image,token,source);}catch(error){check(token,source);text.qualityLimited=true;terminateWorkers();}
  check(token,source);
  $('autoBusy').value=85;const detected=await graphics(image.getContext('2d').getImageData(0,0,image.width,image.height).data,image.width,image.height,text.regions);check(token,source);
  const regions=[...text.regions,...detected.boxes.map(b=>({...b,type:'image',text:'',include:true,confidence:null,method:'colour-region'}))].slice(0,MAX_REGIONS);
  const quality=assessSplit(regions,image.width,image.height);
  // A product photograph does not make a flat poster an inseparable photo.
  const d={source,image,regions,splitQuality:quality,photographic:looksLikePhoto(image),background:detected.background,name:source.name,sourceWidth:sw,sourceHeight:sh};
  status('인식한 요소를 편집기에 준비하는 중…');const doc=await projectFor(d,token);check(token,source);
  const blob=new Blob([JSON.stringify(doc)],{type:'application/json'});if(blob.size>48*1024*1024)throw Error('인식 레이어가 너무 큽니다. 원본 리사이징은 계속 사용할 수 있습니다.');
  importAbort=new AbortController();const loaded=await globalThis.layerFileImport(new File([blob],source.name+'.json',{type:'application/json'}),{origin:'auto',sourceKey:source.key,signal:importAbort.signal,beforeCommit:()=>current(token,source)});check(token,source);
  if(!loaded)throw Error('인식한 레이어를 열지 못했습니다. 원본 리사이징은 계속 사용할 수 있습니다.');
  const elapsed=((performance.now()-started)/1000).toFixed(1);status(`글자 ${text.regions.length}개 · 그림 후보 ${detected.boxes.length}개를 자동으로 열었습니다. (${elapsed}초) 아래에서 요소를 선택해 수정하세요.${d.maskStats.unresolved?' 배경이 복잡한 '+d.maskStats.unresolved+'개 영역은 분리 상태를 확인하세요.':''}${d.separationProof?.passed?' 원본 픽셀 재합성·단색 배경판 검증을 통과했습니다. 글자는 원본 이미지 조각이며 OCR 내용·상품 연결은 확인하세요.':''}${scale<1?' 분석 크기로 축소되었습니다.':''}${text.qualityLimited?' 일부 글자 재확인을 완료하지 못해 기본 인식 결과를 사용했습니다.':''}`);
  panel.dataset.completedKey=source.key;panel.dataset.durationMs=String(Math.round(performance.now()-started));
 }catch(e){
  if(current(token,source)&&e.photoAI){
   if(!aiPolicy.enabled){status('이미지 입력 · 원본 전체 맞춤 · '+e.message+' 생성형 AI는 실행하지 않았습니다.',true);window.dispatchEvent(new CustomEvent('coex:layer-unavailable',{detail:{key:source.key,reason:e.message}}));return;}
   clearTimeout(timeout);terminateWorkers();photoAbort=new AbortController();const signal=photoAbort.signal;
   try{
    status('사진 AI를 준비합니다. 첫 실행에는 모델과 실행 파일 다운로드가 필요합니다.');
    const {processPhotoSource}=await import('./photo-ai-flow.mjs');check(token,source);
    const result=await processPhotoSource({source,image,signal,textMixed:e.textMixed,current:()=>current(token,source),onProgress:event=>{if(!current(token,source))return;if(event.phase==='backend')status(event.provider==='webgpu'?'GPU 실행 · 공용 사진 모델 약165MB를 처음 한 번 준비합니다.':'CPU 실행 · 공용 사진 모델 약165MB를 처음 한 번 준비합니다.');if(event.phase==='download'){status('사진 모델 준비 '+event.progress+'% · 파일은 외부로 보내지 않습니다.');$('autoBusy').value=event.progress;}if(event.phase==='prepare')status('사진 AI 실행기를 준비하는 중…');if(event.phase==='inference')status('브라우저에서 사진 전경·배경을 분리하는 중… 다른 파일 선택으로 취소할 수 있습니다.');}});check(token,source);
    status(result.imported?'사진 AI 전경을 투명 배경의 레이어로 열었습니다. 가장자리와 배경 제거 결과를 확인하세요.':'사진 AI 전경 PNG를 준비했습니다. 글자가 포함되어 개별 글자·그림 재배치는 적용하지 않았습니다. 정확한 재배치는 원본 PPTX를 사용하세요.');
    panel.dataset.completedKey=source.key;panel.dataset.durationMs=String(Math.round(performance.now()-started));panel.dataset.sourceEngine='birefnet-photo';
    if(!result.imported)window.dispatchEvent(new CustomEvent('coex:layer-unavailable',{detail:{key:source.key,reason:'사진 AI PNG를 받거나 원본 PPTX로 개별 객체를 재배치하세요.'}}));
   }catch(error){if(current(token,source)){status('사진 AI를 완료하지 못했습니다. '+error.message+' 원본 리사이징은 계속 가능합니다.',true);window.dispatchEvent(new CustomEvent('coex:layer-unavailable',{detail:{key:source.key,reason:'사진 AI 실행에 실패했습니다. 원본 리사이징을 사용하세요.'}}));}}
   finally{if(token===job)photoAbort=null;}
  }else if(current(token,source)){status('자동 인식을 완료하지 못했습니다. '+e.message,true);terminateWorkers();window.dispatchEvent(new CustomEvent('coex:layer-unavailable',{detail:{key:source.key,reason:e.message}}));}
 }
 finally{clearTimeout(timeout);if(image)image.width=image.height=0;if(token===job){busy=false;importAbort=null;panel.setAttribute('aria-busy','false');$('autoBusy').hidden=true;idleTimer=setTimeout(terminateWorkers,60000);}}
}
function cutout(pixels,w,h,regions,background){return new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('./cutout-worker.mjs',import.meta.url),{type:'module'});cutoutWorker=worker;cutoutReject=reject;
 const finish=(error,result)=>{worker.terminate();if(cutoutWorker===worker){cutoutWorker=null;cutoutReject=null;}error?reject(error):resolve(result);};
 worker.onmessage=e=>e.data.error?finish(Error(e.data.error)):finish(null,e.data);worker.onerror=()=>finish(Error('요소 배경을 분리하지 못했습니다.'));worker.postMessage({width:w,height:h,pixels:pixels.buffer,regions,background},[pixels.buffer]);
});}
async function projectFor(d,token){
 const {image}=d,w=image.width,h=image.height,pixels=image.getContext('2d').getImageData(0,0,w,h).data;
 status('로고·글자·그림의 배경을 투명하게 분리하는 중…');
 const result=await cutout(pixels,w,h,d.regions,d.background);check(token,d.source);const proof=verifyRasterSeparation(image.getContext('2d').getImageData(0,0,w,h).data,w,h,result);d.separationProof=proof;globalThis.coexRasterSeparationResult={sourceKey:d.source.key,...proof};if(result.unresolved||(!proof.passed&&(d.photographic||!d.splitQuality?.safe||result.layers.some(b=>b.cutoutMethod==='boundary-background'))))throw photoRequired('배경·요소 분리 검증 실패: '+(proof.reason||d.splitQuality?.reason),d.regions.some(b=>b.type==='text'));if(proof.passed)for(const b of result.layers)b.cutoutMethod='verified-flat-background';d.maskStats={unresolved:result.unresolved,isolated:result.layers.filter(b=>b.cutoutMethod!=='unresolved').length};
 const layers=[];
 for(let i=0;i<result.layers.length;i++){
  check(token,d.source);const b=result.layers[i],c=document.createElement('canvas');c.width=b.w;c.height=b.h;c.getContext('2d').putImageData(new ImageData(b.rgba,b.w,b.h),0,0);
  const label=b.type==='text'?'인식 글자':'그림 후보',object=imageObject(c.toDataURL('image/png'),b.w,b.h,b.x,b.y,b.type==='text'&&b.text?.trim()?b.text.replace(/\s+/g,' ').trim():`${label} ${i+1}`,b.type==='image'?'subject':'other',false,b.type==='text'?b.text:'');
  object.layerRoleInferred=true;object.sourceElementId='raster-region:'+i;object.cutoutMethod=b.cutoutMethod;object.cutoutBackground=b.cutoutBackground;object.perPixelTargetFind=true;layers.push(object);c.width=c.height=0;b.rgba=null;if(i%4===0)await pause();
 }
 const background=document.createElement('canvas');background.width=w;background.height=h;background.getContext('2d').putImageData(new ImageData(result.background,w,h),0,0);
 const reference=imageObject(image.toDataURL('image/png'),w,h,0,0,'원본 비교용 · 숨김 (분석 해상도)','background',true);reference.visible=false;
 const base=imageObject(background.toDataURL('image/png'),w,h,0,0,'추정 배경 · 이동 후 빈 곳을 확인','background',true);background.width=background.height=0;
 return{format:'coex-layer-project',version:1,inputKind:'raster',sourceFormat:'image',width:w,height:h,name:d.name,analysis:{engine:'tesseract-auto-local',foregroundMask:'flat-or-boundary-matte',rasterSeparationProof:d.separationProof,estimated:true,sourceWidth:d.sourceWidth,sourceHeight:d.sourceHeight},scene:{version:'7.4.0',objects:[reference,base,...layers]}};
}
function imageObject(src,w,h,left,top,name,role,locked,sourceText=''){return{type:'Image',version:'7.4.0',originX:'left',originY:'top',left,top,width:w,height:h,scaleX:1,scaleY:1,angle:0,opacity:1,visible:true,src,layerName:name,layerRole:role,layerLocked:locked,sourceText,crossOrigin:null,filters:[]};}
function observe(){
 if(disposed)return;const source=sourceNow();if(equalSource(source,observed))return;
 observed=source;ignored=null;cancelJob();delete panel.dataset.completedKey;delete panel.dataset.durationMs;
 if(!source){status('파일을 열면 글자와 그림을 자동으로 인식합니다.');return;}
 status('파일을 읽었습니다. 자동 인식을 준비하는 중…');pending=setTimeout(()=>{pending=null;if(equalSource(source,observed)&&!sameSource(source,ignored))void analyze(source);},180);
}
globalThis.notifyLayerAnalysisSource=()=>queueMicrotask(observe);
window.addEventListener('coex:layer-source',()=>{ignored=sourceNow();observed=ignored;cancelJob();delete panel.dataset.completedKey;status('레이어 원본을 열었습니다. 아래에서 요소를 편집하세요.');});
window.addEventListener('coex:layer-edit',()=>{if(!busy&&!pending)return;ignored=sourceNow();observed=ignored;cancelJob();delete panel.dataset.completedKey;status('직접 편집한 내용을 유지했습니다. 진행 중이던 자동 인식은 취소했습니다.');});
const watcher=setInterval(observe,200);observe();
window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;clearInterval(watcher);cancelJob();terminateWorkers();});
