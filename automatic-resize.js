// One local policy for canvas preview, individual encoding and ZIP targets.
// Alpha-empty trimming is exact; sampled background colour is not outpainting.
(function(){
 const aliases=new WeakMap(),decisions=new WeakMap(),profiles=new WeakMap();
 const dimensions=s=>({w:s?.naturalWidth||s?.width,h:s?.naturalHeight||s?.height});
 function origin(source){return aliases.get(source)?.source||source;}
 function inherit(source,frozen){const state=globalThis.coexLayerLayout?.read();aliases.set(frozen,{source:origin(source),epoch:state?.epoch,revision:state?.revision});}
 function profile(source){
  const {w,h}=dimensions(source);if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>24000000)throw Error('출력 원본 크기를 확인하세요.');
  const immutable=String(source.tagName).toUpperCase()==='IMG'||aliases.has(source),key=source.currentSrc||source.src||'frozen',old=profiles.get(source);if(immutable&&old?.key===key&&old.w===w&&old.h===h)return old;
  const sample=document.createElement('canvas');sample.width=sample.height=128;const ctx=sample.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,128,128);const rgba=ctx.getImageData(0,0,128,128).data,buckets=new Map();
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){if(x>1&&x<126&&y>1&&y<126)continue;const i=(y*128+x)*4;if(rgba[i+3]<254)continue;const rgb=[...rgba.slice(i,i+3)],k=rgb.map(v=>v>>4).join(':');if(!buckets.has(k))buckets.set(k,{n:0,sum:[0,0,0]});const b=buckets.get(k);b.n++;rgb.forEach((v,j)=>b.sum[j]+=v);}
  const dominant=[...buckets.values()].sort((a,b)=>b.n-a.n)[0],background=dominant?'#'+dominant.sum.map(v=>Math.round(v/dominant.n).toString(16).padStart(2,'0')).join(''):null;
  let content={x:0,y:0,w,h},trimProof='none';
  // If even one sampled corner is transparent, inspect every actual alpha
  // byte before trimming. Downsampled zero alone never proves empty pixels.
  if([3,127*4+3,(127*128)*4+3,(128*128-1)*4+3].some(i=>rgba[i]===0)){
   const full=document.createElement('canvas');full.width=w;full.height=h;const fc=full.getContext('2d',{willReadFrequently:true});fc.drawImage(source,0,0);const p=fc.getImageData(0,0,w,h).data;let l=w,t=h,r=-1,b=-1;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(p[(y*w+x)*4+3]>0){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
   if(r>=l){content={x:l,y:t,w:r-l+1,h:b-t+1};trimProof='all-source-alpha-bytes';}full.width=full.height=0;
  }
  sample.width=sample.height=0;const answer={key,w,h,content,trimProof,background};if(immutable)profiles.set(source,answer);return answer;
 }
 function sourceInputKind(source){const info=globalThis.getLayerAnalysisSource?.();if(info&&origin(source)===info.source)return info.inputKind||(info.nativeProject?'layered':'raster');const state=globalThis.coexLayerLayout?.read();if(globalThis.isLayerOutputSource?.(origin(source))&&state?.linked)return state.inputKind||'layered';return 'raster';}
 function decide(source,w,h,settings={}){
  const raster=sourceInputKind(source)==='raster',material=raster&&!settings.transparent?globalThis.coexMainRasterBackground?.profile(origin(source)):null;
  if(material)return{policy:'background-only-v1',inputKind:'raster',path:'background-only',width:w,height:h,status:'review',method:'protected-poster-texture-margins',reason:'원본 이미지 전체를 보존하고 노출된 배경 질감을 새 여백에 연결했습니다. 글씨·상품을 개별 분리한 것은 아닙니다.',crop:'none',stretch:false,backgroundScope:'가장자리 질감의 추정 반복 · 숨은 원본 복원 아님 · 이음선 확인 필요',backgroundEvidence:{kind:material.kind,sourcePatches:material.sourcePatches},background:settings.background||'#ffffff'};
  const known=(!raster?decisions.get(source):null)||globalThis.getAutomaticSceneDecision?.(origin(source),w,h);
  if(known&&known.width===w&&known.height===h)return{...known,path:known.path||(known.method==='native-reflow'?'redesign':'whole-fit'),inputKind:known.inputKind||'raster',crop:'none',stretch:false};
  const p=profile(source),same=Math.abs(Math.log((p.w/p.h)/(w/h)))<1e-6,trimmed=p.trimProof==='all-source-alpha-bytes'&&(p.content.w<p.w||p.content.h<p.h),solid=globalThis.resolveCompositionBackgroundColor?.(origin(source));
  return{policy:'background-only-v1',inputKind:sourceInputKind(source),path:'background-only',width:w,height:h,status:'review',method:'unseparated-source-fit',reason:'독립 배경을 확인하지 못해 원본 전체를 보호했습니다. 배경 분리는 완료되지 않았습니다.',crop:trimmed?'verified-alpha-empty-only':'none',stretch:false,content:trimmed?p.content:{x:0,y:0,w:p.w,h:p.h},background:solid||p.background||settings.background||'#ffffff',backgroundEvidence:solid?'verified-flat':p.background?'sampled-edge-colour':'default',backgroundScope:solid?'단색 배경 연결':p.background?'대표색 단색 바탕 · 사진/패턴 확장 아님':'기본 바탕',trimProof:p.trimProof};
 }
 function record(source,decision){decision={...decision,inputKind:decision.inputKind||(sourceInputKind(source)),path:decision.path||(decision.method==='native-reflow'?'redesign':'whole-fit')};decisions.set(source,decision);globalThis.coexLastResizeResult=decision;try{const key='coex-resize-decisions-v1',items=JSON.parse(localStorage.getItem(key)||'[]'),last=items.at(-1),entry={inputKind:decision.inputKind,path:decision.path,reason:decision.reason,backgroundTreatment:decision.backgroundTreatment||null,width:decision.width,height:decision.height,status:decision.status,method:decision.method};if(JSON.stringify(last?.result)!==JSON.stringify(entry)){items.push({at:new Date().toISOString(),result:entry});localStorage.setItem(key,JSON.stringify(items.slice(-30)));}}catch{}return decision;}
 function draw(ctx,source,w,h,settings={}){
  const decision=decide(source,w,h,settings),canvas=globalThis.resolveLayerCompositionSource?.(source,w,h)||source,sz=dimensions(canvas),box=decision.content&&canvas===source?decision.content:{x:0,y:0,w:sz.w,h:sz.h};
  if(settings.type==='image/jpeg'||!settings.transparent){ctx.fillStyle=decision.background||settings.background||'#ffffff';ctx.fillRect(0,0,w,h);}
  const scale=Math.min(w/box.w,h/box.h),dw=box.w*scale,dh=box.h*scale,x=(w-dw)/2,y=(h-dh)/2;if(decision.method==='protected-poster-texture-margins')globalThis.coexMainRasterBackground?.draw(ctx,origin(source),w,h,{x,y,dw,dh});ctx.drawImage(canvas,box.x,box.y,box.w,box.h,x,y,dw,dh);record(source,decision);return decision;
 }
 function describe(d){return (d.inputKind==='layered'?'레이어 입력':'이미지 입력')+' · '+(d.path==='background-only'?'배경만 리사이징':d.path==='redesign'?'요소 재설계':'원본 전체 맞춤')+' · '+(d.status==='review'?'분리·배경 검토 필요 · ':'자동 처리 · ')+(d.reason||d.method)+(d.backgroundScope?' '+d.backgroundScope+'.':'');}
 globalThis.coexAutoResizePolicy={profile,decide,draw,describe,origin,inherit,alias:source=>aliases.get(source),get:source=>decisions.get(source),record};
})();
