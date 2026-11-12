import {aiPolicy} from './resize-policy.mjs';
import './design-targets.mjs';
import {composeReflow} from './responsive-layout.mjs';
const $=id=>document.getElementById(id),api=()=>globalThis.coexLayerLayout;
const panel=document.createElement('section');panel.id='photoDesign';panel.className='card design-candidates';
panel.innerHTML=`<h3>원본을 보호하며 배경 연결하기</h3><p>상품·인물을 늘리거나 자르지 않고, 비는 바깥쪽 배경을 연결합니다. 글씨·로고는 편집 가능한 요소로 유지합니다. 후보를 적용하기 전에는 원본을 바꾸지 않습니다.</p><p>AI가 새로 그린 배경에는 경계·반복 무늬·원치 않는 사물이 생길 수 있습니다. 복잡한 사진은 검토용 후보이며 자동으로 적용하지 않습니다.</p><label>배경으로 이어 그리거나 새 사진 후보를 만들 이미지<select id="photoDesignSource"><option value="">이미지 요소 선택</option></select></label><p>단색·그라데이션 연결은 이 브라우저에서 바로 만듭니다. 단순한 배경은 원래 색상 흐름을 자동으로 이어 연결합니다. 복잡한 사진 배경은 AI가 원본 사진의 배경과 구도를 참고해 확장하며, 새 사진 후보와 함께 이 PC의 무료 사진 AI로 처리해 시간이 더 걸립니다.</p><label>원하는 배경 또는 새 사진 설명<input id="photoDesignPrompt" maxlength="600" placeholder="예: warm bakery interior, wooden table, soft natural light"></label><p>사진 AI의 설명은 영어가 더 정확합니다. 글씨와 로고는 사진 AI가 새로 그리지 않습니다.</p><div class="design-actions"><button id="photoQuick" class="doc-btn" type="button">빠른 배경 연결 후보</button><button id="photoOutpaint" class="doc-btn" type="button">AI 배경 확장 후보 만들기</button></div><details><summary>상품·인물의 새 사진도 후보로 비교</summary><p>원본과 다른 상품·인물이 만들어질 수 있습니다. 자동 교체하지 않으며, 미리 본 뒤 직접 선택한 경우에만 적용됩니다.</p><button id="photoReplace" class="doc-btn" type="button">선택 이미지의 새 사진 후보 만들기</button></details><p id="photoDesignStatus" role="status">배경 또는 사진 이미지 요소를 선택하세요.</p><button id="photoCancel" class="doc-btn" type="button" hidden>사진 AI 중지 요청</button><details><summary>무료 사진 AI 실행 안내</summary><p>이 PC에서 프로젝트의 ‘무료사진AI_실행.cmd’를 실행하세요. 첫 AI 생성 때 공개 모델 약 2GB 이상을 내려받습니다. 창을 열어 둔 동안 사용할 수 있습니다. 브라우저가 로컬 네트워크 연결을 물으면 이 PC의 사진 AI 연결에만 허용하세요. 연결이 어려우면 아래 로컬 편집기를 여세요.</p><a href="http://127.0.0.1:8179" target="_blank" rel="noopener">이 PC의 사진 AI 편집기 열기</a><p>Stable Diffusion Inpainting + Diffusers, 유료 API 사용 없음. 이 PC의 Intel 내장 그래픽 환경에서는 CPU로 실행하므로 수 분 이상 걸릴 수 있습니다. 품질은 미리보기에서 확인하세요.</p></details><div id="photoDesignCards" class="design-results"></div>`;
const backgroundOptions=document.createElement('details');backgroundOptions.id='backgroundConnectionOptions';backgroundOptions.className='card background-connection-options';
const backgroundSummary=document.createElement('summary');backgroundSummary.textContent='배경 연결 · 필요할 때 열기';backgroundOptions.append(backgroundSummary,panel);
$('designSuggestions').after(backgroundOptions);
const endpoint='http://127.0.0.1:8179/api',imageType=o=>String(o.type).toLowerCase()==='image';
let context=null,ticket=0,activeJob=null,controller=null,applying=false,lastList='',sceneKeyAtLoad=globalThis.getLayerAnalysisSource?.()?.key||null;
globalThis.coexPhotoDesignBusy=()=>!!controller;
const say=(s,error=false)=>{$('photoDesignStatus').textContent=s;$('photoDesignStatus').classList.toggle('error',error);};
function cancel(clear=true){++ticket;controller?.abort();controller=null;if(activeJob){void fetch(endpoint+'/jobs/'+activeJob+'/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{});activeJob=null;}$('photoCancel').hidden=true;for(const id of ['photoQuick','photoOutpaint','photoReplace'])$(id).disabled=false;if(clear){context=null;$('photoDesignCards').replaceChildren();$('photoReplace').textContent='선택 이미지의 새 사진 후보 만들기';}}
function current(){const s=api()?.read();return context&&s&&s.epoch===context.epoch&&s.revision===context.revision&&Number($('layerWidth').value)===context.w&&Number($('layerHeight').value)===context.h&&(globalThis.getLayerAnalysisSource?.()?.key||null)===context.key;}
function setup(){
 cancel();const s=api()?.read(),index=Number($('photoDesignSource').value),w=Number($('layerWidth').value),h=Number($('layerHeight').value),source=globalThis.getLayerAnalysisSource?.();
 if(!s||$('photoDesignSource').value===''||!imageType(s.objects[index])||s.objects[index].layerRole==='logo'||s.objects[index].sourceText)throw Error('글씨·로고를 제외한 사진 이미지 요소를 선택하세요.');
 if(source?.key&&s.sourceKey!==source.key&&sceneKeyAtLoad!==source.key)throw Error('현재 파일의 요소 인식이 끝난 뒤 사진을 선택하세요.');
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<64||h<64||w>12000||h>12000||w*h>24000000)throw Error('사진 후보의 출력 크기는 한 변 64~12,000px, 전체 2,400만 픽셀 이하로 지정하세요.');
 const o=s.objects[index],bounds=o.getBoundingRect(),sw=bounds.width,sh=bounds.height;
 if(!sw||!sh||sw*sh>24000000)throw Error('사진 후보의 원본 이미지는 2,400만 픽셀 이하로 사용해 주세요.');
 let c;const visible=o.visible;
 // Respect native PPTX photo crops and masks, including hidden preserved sources.
 try{o.set('visible',true);c=o.toCanvasElement({multiplier:1,withoutTransform:false,withoutShadow:true,enableRetinaScaling:false});}
 finally{o.set('visible',visible);}
 // Extend the coordinate envelope when text/logos lie outside the selected photo.
 // Only the photo is sent to the image model; other editable objects stay separate.
 const others=s.objects.filter(item=>item.visible&&item!==o&&item.layerRole!=='background').map(item=>item.getBoundingRect());
 const left=Math.min(bounds.left,...others.map(b=>b.left)),top=Math.min(bounds.top,...others.map(b=>b.top)),right=Math.max(bounds.left+c.width,...others.map(b=>b.left+b.width)),bottom=Math.max(bounds.top+c.height,...others.map(b=>b.top+b.height));
 const fw=Math.ceil(right-left),fh=Math.ceil(bottom-top);if(fw*fh>24000000)throw Error('사진과 주변 요소를 포함한 영역이 너무 큽니다. 요소 위치를 확인하세요.');
 if(left!==bounds.left||top!==bounds.top||fw!==c.width||fh!==c.height){const padded=document.createElement('canvas');padded.width=fw;padded.height=fh;padded.getContext('2d').drawImage(c,bounds.left-left,bounds.top-top);c=padded;}
 context={epoch:s.epoch,revision:s.revision,w,h,index,key:source?.key||null,base:globalThis.coexLayerHistory.capture(),F:s.F,source:c,protectedFrame:{left,top,width:c.width,height:c.height}};return context;
}
function background(source,w,h,gradient){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d'),sample=document.createElement('canvas');sample.width=sample.height=8;const sc=sample.getContext('2d');sc.drawImage(source,0,0,8,8);const pixels=sc.getImageData(0,0,8,8).data,average=indices=>{const sum=[0,0,0];for(const i of indices)for(let j=0;j<3;j++)sum[j]+=pixels[i*4+j];return 'rgb('+sum.map(v=>Math.round(v/indices.length)).join(',')+')';},top=average([0,1,6,7]),bottom=average([56,57,62,63]);if(gradient){const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,top);g.addColorStop(1,bottom);ctx.fillStyle=g;}else ctx.fillStyle=average([0,7,56,63]);ctx.fillRect(0,0,w,h);const scale=Math.min(1,w/source.width,h/source.height),sw=Math.round(source.width*scale),sh=Math.round(source.height*scale);ctx.drawImage(source,Math.floor((w-sw)/2),Math.floor((h-sh)/2),sw,sh);return c.toDataURL('image/png');}
function continueSimple(source,w,h){
 const sample=document.createElement('canvas');sample.width=sample.height=96;const sc=sample.getContext('2d',{willReadFrequently:true});sc.drawImage(source,0,0,96,96);const d=sc.getImageData(0,0,96,96).data,pixel=(x,y)=>Array.from(d.slice((y*96+x)*4,(y*96+x)*4+4)),a=pixel(0,0),right=pixel(95,0),bottom=pixel(0,95),bx=right.map((v,i)=>v-a[i]),by=bottom.map((v,i)=>v-a[i]);let wrong=0,total=0;
 for(let i=0;i<96;i++)for(const [x,y]of [[i,0],[i,95],[0,i],[95,i]]){const p=pixel(x,y);++total;if(p[3]<250||p.slice(0,3).some((v,k)=>Math.abs(v-a[k]-bx[k]*x/95-by[k]*y/95)>3))++wrong;}
 if(wrong/total>.04)return null;
 const scale=Math.min(1,w/source.width,h/source.height),sw=Math.round(source.width*scale),sh=Math.round(source.height*scale),left=Math.floor((w-sw)/2),top=Math.floor((h-sh)/2),c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d'),image=ctx.createImageData(w,h),out=image.data;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const at=(y*w+x)*4;for(let k=0;k<3;k++)out[at+k]=Math.max(0,Math.min(255,Math.round(a[k]+bx[k]*(x-left)/Math.max(1,sw-1)+by[k]*(y-top)/Math.max(1,sh-1))));out[at+3]=255;}
 ctx.putImageData(image,0,0);ctx.drawImage(source,left,top,sw,sh);return c.toDataURL('image/png');
}
async function objectsFor(asset,mode,ctx){
 const {F}=ctx,objects=await F.util.enlivenObjects(ctx.base.scene.objects);let photo;
 try{if(mode==='background'){
   const frame=ctx.protectedFrame,scale=Math.min(1,ctx.w/frame.width,ctx.h/frame.height),left=Math.floor((ctx.w-Math.round(frame.width*scale))/2),top=Math.floor((ctx.h-Math.round(frame.height*scale))/2);
   for(const item of objects){const center=item.getCenterPoint();item.set({scaleX:item.scaleX*scale,scaleY:item.scaleY*scale});item.setPositionByOrigin(new F.Point(left+(center.x-frame.left)*scale,top+(center.y-frame.top)*scale),'center','center');item.setCoords();}
  }else if(ctx.base.width!==ctx.w||ctx.base.height!==ctx.h)composeReflow({objects,width:ctx.base.width,height:ctx.base.height,F},ctx.w,ctx.h,{});
  const original=objects[ctx.index],bitmap=await F.FabricImage.fromURL(asset),name=original.layerName||'사진';
  if(mode==='background'){
   objects.filter(o=>o.layerRole==='background').forEach(o=>o.set('visible',false));original.set('visible',false);
   bitmap.set({left:0,top:0,scaleX:ctx.w/bitmap.width,scaleY:ctx.h/bitmap.height,layerName:'이어 그린 배경 · '+name,layerRole:'background',layerLocked:true});objects.unshift(bitmap);
  }else{
   const b=original.getBoundingRect(),scale=Math.min(b.width/bitmap.width,b.height/bitmap.height);original.set('visible',false);
   bitmap.set({left:b.left+(b.width-bitmap.width*scale)/2,top:b.top+(b.height-bitmap.height*scale)/2,scaleX:scale,scaleY:scale,layerName:'새 사진 후보 · '+name,layerRole:original.layerRole||'subject',layerPriority:original.layerPriority||'keep'});objects.splice(ctx.index+1,0,bitmap);
  }
  photo=bitmap;return objects;
 }catch(error){photo?.dispose();objects.forEach(o=>o.dispose());throw error;}
}
async function addCard(asset,label,mode,ctx,jobTicket){
 const objects=await objectsFor(asset,mode,ctx);let preview;
 try{const scale=Math.min(1,800/Math.max(ctx.w,ctx.h)),c=new ctx.F.StaticCanvas(null,{width:Math.round(ctx.w*scale),height:Math.round(ctx.h*scale),enableRetinaScaling:false,renderOnAddRemove:false});try{c.setViewportTransform([scale,0,0,scale,0,0]);c.add(...objects);c.renderAll();preview=c.toDataURL({format:'png'});}finally{c.remove(...objects);c.dispose();}}
 finally{objects.forEach(o=>o.dispose());}
 if(ticket!==jobTicket||!current())return;
 const card=document.createElement('article');card.className='design-card';const image=new Image();image.src=preview;image.alt=label;image.style.width='100%';const title=document.createElement('h4');title.textContent=label+` · ${ctx.w} × ${ctx.h}px`;const button=document.createElement('button');button.className='doc-btn';button.type='button';button.textContent='이 후보 적용';button.onclick=async()=>{
  if(!current()){cancel();say('규격이나 요소가 바뀌었습니다. 새 후보를 만들어 주세요.',true);return;}
  button.disabled=true;let result;
  try{result=await objectsFor(asset,mode,ctx);if(context!==ctx||!current()){result.forEach(o=>o.dispose());return;}applying=true;api().applyDesign(result,ctx.w,ctx.h,{epoch:ctx.epoch,revision:ctx.revision});result=null;ctx.revision=api().read().revision;ctx.key=globalThis.getLayerAnalysisSource?.()?.key||null;const selectedIndex=String(mode==='background'?0:ctx.index+1),picker=$('photoDesignSource');if(![...picker.options].some(o=>o.value===selectedIndex))picker.add(new Option('선택한 새 이미지',selectedIndex));picker.value=selectedIndex;say(label+'을 적용했습니다. 원본 요소는 남아 있으며 실행 취소로 복원할 수 있습니다.');}
  catch(error){result?.forEach(o=>o.dispose());say(error.message,true);}finally{applying=false;button.disabled=false;}
 };const info=document.createElement('div');info.className='design-card-info';info.append(title,button);card.append(image,info);$('photoDesignCards').append(card);
}
$('photoQuick').onclick=async()=>{try{const ctx=setup(),jobTicket=ticket;say('원본 비율을 유지한 배경 연결 후보를 만듭니다…');const natural=continueSimple(ctx.source,ctx.w,ctx.h);if(natural)await addCard(natural,'원본 배경색 흐름 자동 연장','background',ctx,jobTicket);if(ticket!==jobTicket)return;await addCard(background(ctx.source,ctx.w,ctx.h,false),'단색 배경 연결','background',ctx,jobTicket);if(ticket!==jobTicket)return;await addCard(background(ctx.source,ctx.w,ctx.h,true),'그라데이션 배경 연결','background',ctx,jobTicket);if(ticket===jobTicket)say(`${natural?3:2}개 배경 후보를 준비했습니다. 상품·인물은 늘리거나 확대하지 않았습니다.`);}catch(error){say(error.message,true);}};
async function generate(mode){
 if(!aiPolicy.enabled){say(aiPolicy.reason);return;}
 if(!$('freeAiCancel').hidden){say('AI 배치 제안이 끝난 뒤 사진 AI를 실행해 주세요. 이 PC의 메모리를 함께 보호합니다.',true);return;}
 let jobTicket=ticket;
 try{let ctx;if(mode==='replace'&&context?.kind==='replace'&&current()&&$('photoDesignSource').value===String(context.index)){if($('photoDesignCards').children.length>=3){say('새 사진 후보 3개를 비교해 선택하세요. 요청을 바꾸면 새 후보를 만들 수 있습니다.');return;}cancel(false);ctx=context;}else ctx=setup();ctx.kind=mode;jobTicket=ticket;controller=new AbortController();const signal=controller.signal;
  for(const id of ['photoQuick','photoOutpaint','photoReplace'])$(id).disabled=true;$('photoCancel').hidden=false;say('이 PC의 무료 사진 AI에 연결합니다…');
  const health=await fetch(endpoint+'/health',{signal}).then(r=>r.json());if(health.service!=='coex-local-photo-ai')throw Error('사진 AI 연결을 확인하지 못했습니다.');
  const selected=ctx.base.scene.objects[ctx.index];let w=ctx.w,h=ctx.h;if(mode==='replace'){w=Math.max(64,Math.min(2048,Math.round(selected.width*Math.abs(selected.scaleX||1))));h=Math.max(64,Math.min(2048,Math.round(selected.height*Math.abs(selected.scaleY||1))));}
  const response=await fetch(endpoint+'/jobs',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({mode,width:w,height:h,source:ctx.source.toDataURL('image/png'),prompt:$('photoDesignPrompt').value,steps:12})});const queued=await response.json();if(!response.ok)throw Error(queued.error||'사진 AI 요청 실패');activeJob=queued.id;
  for(;;){if(ticket!==jobTicket)return;const result=await fetch(endpoint+'/jobs/'+activeJob,{signal}).then(r=>r.json());if(result.status==='error')throw Error(result.message);if(result.status==='cancelled')throw Error('사진 AI를 중지했습니다.');if(result.status==='complete'){activeJob=null;const simple=result.method==='simple-background-continuation',unchanged=mode==='background'&&result.generated===false&&!simple;await addCard(result.image,simple?'단순 배경 자동 연장':unchanged?'원본 유지 · 확장할 빈 공간 없음':mode==='background'?'AI 배경 확장 · 검토용':'선택형 새 사진 후보 '+($('photoDesignCards').children.length+1),mode,ctx,jobTicket);if(ticket===jobTicket){if(mode==='replace')$('photoReplace').textContent='새 사진 후보 추가 · 최대 3개';say(simple?'원본과 같은 단순 배경을 이어 연결했습니다. 사진 AI는 실행하지 않아 새 장식이나 글씨를 만들지 않았습니다.':unchanged?'현재 규격에는 확장할 빈 공간이 없어 사진 AI를 실행하지 않고 원본을 유지했습니다.':'후보가 준비됐습니다. 원본과 비교한 뒤 직접 선택해 적용하세요.');}break;}say(result.message?.includes('downloads')?'사진 AI 모델을 준비합니다. 처음에는 약 2GB 이상을 내려받습니다.':`사진 AI가 ${mode==='background'?'바깥 배경을 이어 그리는':'새 사진 후보를 만드는'} 중입니다 · ${result.progress||0}% · 이 PC에서는 수 분 이상 걸릴 수 있습니다.`);await new Promise(r=>setTimeout(r,1200));}
 }catch(error){if(error.name!=='AbortError')say(error.message==='Failed to fetch'?'이 PC의 무료 사진 AI가 연결되지 않았습니다. 실행 안내에서 로컬 프로그램을 먼저 실행하세요.':error.message,true);}
 finally{if(ticket===jobTicket){controller=null;$('photoCancel').hidden=true;for(const id of ['photoQuick','photoOutpaint','photoReplace'])$(id).disabled=false;}}
}
$('photoOutpaint').onclick=()=>generate('background');$('photoReplace').onclick=()=>generate('replace');$('photoCancel').onclick=()=>{cancel();say('사진 AI에 중지 요청을 보냈습니다. 모델 파일 준비 중이면 준비가 마무리될 수 있습니다.');};
for(const id of ['photoDesignSource','photoDesignPrompt','layerWidth','layerHeight','wInput','hInput'])$(id)?.addEventListener('input',()=>{if(context){cancel();say('원본·규격·요청이 바뀌어 이전 사진 후보를 정리했습니다.');}});
for(const event of ['coex:layer-source','coex:layer-edit','coex:history-source'])window.addEventListener(event,()=>{if(!applying){cancel();lastList='';}});
window.addEventListener('coex:history-source',()=>{sceneKeyAtLoad=globalThis.getLayerAnalysisSource?.()?.key||null;});
for(const [id,event]of [['fileInput','change'],['dropzone','drop']])$(id)?.addEventListener(event,()=>cancel(),true);
document.addEventListener('paste',e=>{if(e.clipboardData?.files?.length)cancel();},true);
const timer=setInterval(()=>{const s=api()?.read(),sig=s?`${s.epoch}:${s.revision}`:'none';if(context&&!applying&&!current()){cancel();say('규격이나 요소가 바뀌었습니다. 새 사진 후보를 만들어 주세요.');}if(sig===lastList)return;lastList=sig;const select=$('photoDesignSource'),previous=select.value;select.replaceChildren(new Option('이미지 요소 선택',''));const backgrounds=[];s?.objects.forEach((o,i)=>{if(imageType(o)&&o.layerRole!=='logo'&&!o.sourceText){select.add(new Option((o.layerRole==='background'?'배경 · ':'사진 · ')+(o.layerName||String(i+1)),String(i)));if(o.visible&&o.layerRole==='background')backgrounds.push(i);}});if(previous&&[...select.options].some(o=>o.value===previous))select.value=previous;else if(backgrounds.length===1)select.value=String(backgrounds[0]);},350);
window.addEventListener('coex:design-target-ready',()=>{const s=api()?.read(),selected=s?.objects[Number($('photoDesignSource').value)];if(!controller&&$('photoDesignSource').value!==''&&selected?.layerRole==='background')$('photoQuick').click();});
window.addEventListener('pagehide',()=>{cancel();clearInterval(timer);});
