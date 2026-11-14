import {withSeparationVisibility} from './source-background-separation.mjs';
import {outsideFitBounds,inferOutsideOriginalFrame} from './outside-fit.mjs';
import {hasTrustedOutsideCandidate} from './final-outside-overlay.mjs';
import {planAnchoredFooter} from './anchored-band.mjs';
import {partialConnectionReview} from './partial-solid-review.mjs';
import {capturePartialSource,planPartialSolid,applyPartialSolid} from './partial-solid-transaction.mjs';
import {tightNativeBox} from './family-master.mjs';
import {captureRightEdge,applyRightEdge} from './right-edge-anchors.mjs';
import {solidBackgroundColor,extendSolidBackground} from './solid-background.mjs';
import {masonryTextureProfile,paperTextureProfile,extendPaperTexture,installTextureBackgroundRenderer} from './texture-background.mjs';
import {captureFooterSource,applyFooterAfterResize} from './band-runtime.mjs';


// Runtime evidence only: a verified full-frame native texture may be inset by
// the initial whole-design fit. Never deserialize this provenance from JSON.
const initialTextureFits=new WeakMap();
// Import-inferred bitmap metadata is advisory, never proof of an empty
// background. Keep these compatibility exports for saved-project cleanup.
export function revokeNativeBitmapProvenance(o){if(o)delete o.nativeBitmapProvenance;}
export function canonicalBitmapProvenance(){return null;}
// A preceding photo must be verified flat before another photo may cover it.
// Cache only immutable image elements; never infer a flat image by sampling.
const flatPhotoCache=new WeakMap();
function flatPrecedingPhoto(o,objects){
 if(String(o.type).toLowerCase()!=='image'||o.sourceText||o.clipPath||o.shadow||o.filters?.length||o.globalCompositeOperation&&o.globalCompositeOperation!=='source-over')return false;
 const at=objects.indexOf(o),under=objects.slice(0,at).filter(x=>x.visible!==false).at(-1),color=solidBackgroundColor(under),bb=under?.getBoundingRect(),ob=o.getBoundingRect();
 if(!color||!bb||ob.left<bb.left-1||ob.top<bb.top-1||ob.left+ob.width>bb.left+bb.width+1||ob.top+ob.height>bb.top+bb.height+1)return false;
 const e=o.getElement?.(),w=e?.naturalWidth||e?.width,h=e?.naturalHeight||e?.height;
 if(!e||!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>8000000)return false;
 const key=(e.currentSrc||e.src||'')+':'+w+'x'+h+':'+color,old=flatPhotoCache.get(e);if(e.tagName==='IMG'&&old?.key===key)return old.result;
 let c,ok=false;try{c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(e,0,0);const p=ctx.getImageData(0,0,w,h).data;let rgb=null,count=0;ok=true;
  for(let i=0;i<p.length;i+=4){const n=i/4,x=n%w,y=Math.floor(n/w),edge=x===0||x===w-1||y===0||y===h-1;if(p[i+3]<(edge?128:254)){ok=false;break;}if(!rgb)rgb=[p[i],p[i+1],p[i+2]];if(Math.abs(p[i]-rgb[0])>2||Math.abs(p[i+1]-rgb[1])>2||Math.abs(p[i+2]-rgb[2])>2){ok=false;break;}count++;}const plate=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));ok=ok&&count===w*h&&rgb.every((v,i)=>Math.abs(v-plate[i])<=1);
 }catch{ok=false;}finally{if(c)c.width=c.height=0;}if(e.tagName==='IMG')flatPhotoCache.set(e,{key,result:ok});return ok;
}
function sameBox(a,b){return ['left','top','width','height'].every(k=>Math.abs(a[k]-b[k])<=2);}
function matchedInitialTextureFit(o,state,box){const m=initialTextureFits.get(o);return !!m&&state.inputKind===m.kind&&state.sourceFormat===m.format&&state.epoch===m.epoch&&state.width===m.width&&state.height===m.height&&o.getElement?.()===m.element&&o.getSrc?.()===m.src&&sameBox(m.box,box);}
export function trackNativeBackgroundFit(state,callback){
 const candidates=partitionBackground(state).backgrounds.filter(p=>p.textureProfile).map(p=>({object:p.object,element:p.object.getElement?.(),src:p.object.getSrc?.()}));
 const result=callback();
 for(const c of candidates){const o=c.object;if(o.getElement?.()!==c.element||o.getSrc?.()!==c.src)continue;initialTextureFits.set(o,{element:c.element,src:c.src,kind:state.inputKind,format:state.sourceFormat,epoch:state.epoch,width:state.width,height:state.height,box:{...o.getBoundingRect()}});}
 return result;
}

// A role inferred from a large rectangle is not proof of an empty background.
// Retain all ambiguous images, paper, text and ornaments in the foreground.
export function partitionBackground(state){
 const backgrounds=[],foreground=[],unresolved=[];
 for(const [id,o] of state.objects.entries()){
  if(o.visible===false)continue;
  const type=String(o.type).toLowerCase(),text=typeof o.text==='string'||!!o.sourceText;
  const box=o.getBoundingRect(),full=Math.abs(box.left)<=2&&Math.abs(box.top)<=2&&Math.abs(box.left+box.width-state.width)<=2&&Math.abs(box.top+box.height-state.height)<=2;
  const safe=(full||matchedInitialTextureFit(o,state,box))&&!text&&o.layerRole==='background'&&!o.clipPath&&!o.shadow&&!o.angle&&!o.skewX&&!o.skewY&&!o.flipX&&!o.flipY&&!(o.cropX||o.cropY)&&!o.filters?.length&&(!o.globalCompositeOperation||o.globalCompositeOperation==='source-over')&&(o.opacity??1)===1;
  const plain=safe&&!!solidBackgroundColor(o);
  const opaqueStop=stop=>{if((stop.opacity??1)!==1||!CSS.supports('color',stop.color))return false;const c=document.createElement('canvas');c.width=c.height=1;try{const ctx=c.getContext('2d');ctx.fillStyle=stop.color;ctx.fillRect(0,0,1,1);return ctx.getImageData(0,0,1,1).data[3]===255;}finally{c.width=c.height=0;}};
  const gradient=safe&&type==='rect'&&Array.isArray(o.fill?.colorStops)&&o.fill.colorStops.length>=2&&o.fill.colorStops.every(opaqueStop)&&!o.rx&&!o.ry&&(!o.stroke||!o.strokeWidth);
  // A slide-fill name or a background role does not prove that a raster is
  // free of baked-in lettering/products. Non-flat rasters remain protected.
  const texture=safe&&type==='image'?(paperTextureProfile(o,state)||masonryTextureProfile(o,state)):null;
  // Only an explicitly separated photo with its original and foreground parts can be fitted independently.
  // Keep the original paint order; callers must review image cropping and transparent pixels.
  const group=o.photoInstanceGroup;
  const photo=type==='image'&&o.photoInstanceKind==='background'&&o.layerRole==='background'&&!!group&&!o.layerLocked&&o.width>0&&o.height>0&&!o.clipPath&&!o.shadow&&!o.angle&&!o.skewX&&!o.skewY&&!o.flipX&&!o.flipY&&!(o.cropX||o.cropY)&&!o.filters?.length&&(!o.globalCompositeOperation||o.globalCompositeOperation==='source-over')&&(o.opacity??1)===1&&state.objects.filter(x=>x.photoInstanceGroup===group&&x.photoInstanceKind==='background'&&x.visible!==false).length===1&&state.objects.some(x=>x.photoInstanceGroup===group&&x.photoInstanceKind==='source'&&x.visible===false&&x.originalPhotoSource)&&state.objects.some(x=>x.photoInstanceGroup===group&&x.photoInstanceKind==='part'&&x.visible!==false)&&state.objects.slice(0,id).every(x=>x.visible===false||backgrounds.some(p=>p.object===x)||flatPrecedingPhoto(x,state.objects));
  const evidence=plain?'verified-full-frame-single-colour':gradient?'verified-full-frame-opaque-gradient':texture?.evidence||(photo?'separated-photo-cover':null);
  const item={id,object:o,evidence,textureProfile:texture,name:o.layerName||o.type};
  if(evidence)backgrounds.push(item);else{foreground.push(item);if(o.layerRole==='background')unresolved.push({id,name:item.name,reason:'분리 근거가 없는 이미지·도형은 보호 요소로 유지'});}
 }
 // Extending a background painted above a foreground could newly cover it.
 const first=foreground.length?Math.min(...foreground.map(x=>x.id)):Infinity;
 for(let i=backgrounds.length-1;i>=0;i--)if(backgrounds[i].id>first&&backgrounds[i].evidence!=='separated-photo-cover'){const item=backgrounds.splice(i,1)[0];foreground.push(item);unresolved.push({id:item.id,name:item.name,reason:'전경 위에 있는 배경 후보는 원본 위치 유지'});}
 foreground.sort((a,b)=>a.id-b.id);
 return {backgrounds,foreground,unresolved,separated:state.inputKind!=='raster'&&backgrounds.length>0};
}

// A raster built to cover the frame can overshoot by less than one source
// pixel due to integer bitmap dimensions. Use the visible canvas boundary for
// fit calculation only; never alter/delete pixels or trust JSON as provenance.
export function gridVisibleFitBox(o,b,state){
 const m=o?.gridExpansion,g=m?.original,el=o?.getElement?.(),s=o?.scaleX,bottom=m?.bottom??0;
 if(!g||String(o.type).toLowerCase()!=='image'||o.layerRole!=='subject'||o.angle||o.skewX||o.skewY||o.flipX||o.flipY||o.clipPath||o.cropX||o.cropY||o.originX!=='left'||o.originY!=='top'||!Number.isFinite(s)||s<=0||![g.left,g.top,g.width,g.height,g.scaleX,g.scaleY,m.left,o.width,o.height,o.left,o.top,o.scaleY,state.width,state.height].every(Number.isFinite)||!Number.isInteger(m.left)||m.left<0||!Number.isInteger(bottom)||bottom<0||g.width<1||g.height<1||m.left+g.width>o.width||o.height!==g.height+bottom||Math.abs(s-g.scaleX)>.000001||Math.abs(o.scaleY-g.scaleY)>.000001||Math.abs(o.left-(g.left-m.left*s))>.001||Math.abs(o.top-g.top)>.001||el?.naturalWidth!==o.width||el?.naturalHeight!==o.height)return b;
 const out={...b},right=b.left+b.width,epsilon=Math.min(2,s+.001);if(b.left<0&&b.left>=-epsilon)out.left=0;if(right>state.width&&right<=state.width+epsilon)out.width=state.width-out.left;else if(out.left!==b.left)out.width=right-out.left;const edge=b.top+b.height,ey=Math.min(2,o.scaleY+.001);if(bottom&&edge>state.height&&edge<=state.height+ey)out.height=state.height-b.top;return out;
}
export function trustedOutsideFitBoxes(boxes,objects,isTrusted=hasTrustedOutsideCandidate){
 return boxes.filter(box=>{const matches=objects.filter(o=>o.visible!==false&&o.sourceElementId===box.id);return matches.length===1&&isTrusted(matches[0]);});
}
export function resizeBackgroundOnly(state,width,height,{includeWholePictures=true}={}){
 installTextureBackgroundRenderer(state.F);
 if(state.fontError)throw Error(state.fontError);
 const __partialReview=partialConnectionReview(state);
 // Only explicitly registered semantic evidence may authorize partial extension.
 const __partialProofs=state.objects.map(o=>capturePartialSource(state,o)).filter(Boolean); const parts=partitionBackground(state),edge=captureRightEdge(state,parts);
 const footerSource=parts.separated&&parts.unresolved.length===0?captureFooterSource(state):null;
 const sourceItems=footerSource?.items.map(item=>({...item,outputBox:item.sourceBox}));
 const footerEvidence=sourceItems?planAnchoredFooter({...footerSource,items:sourceItems,targetWidth:state.width,targetHeight:state.height}):null;
 const footerIds=new Set(footerEvidence?[footerEvidence.bandId,...footerEvidence.textMoves.map(m=>m.id)]:[]);
 let originalFrame=parts.backgrounds.find(p=>p.textureProfile)?.object.textureBackgroundFrame||{x:0,y:0,w:state.width,h:state.height};
 let __outsideFit=outsideFitBounds(state,{foreground:parts.foreground,outputWidth:width,outputHeight:height,frame:originalFrame});
 let hasSavedOutside=state.sourceFormat==='json'&&parts.foreground.some(p=>p.object.visible!==false&&p.object.trialOutsideRestore),outsideFrameFailure=null;
 if(hasSavedOutside){
  const recovered=inferOutsideOriginalFrame(state,{foreground:parts.foreground,fit:__outsideFit});
  globalThis.__outsideRecoveredFrame=recovered;
  if(!recovered.frame){outsideFrameFailure=recovered.reason;hasSavedOutside=false;}
  else {originalFrame=recovered.frame;__outsideFit=outsideFitBounds(state,{foreground:parts.foreground,outputWidth:width,outputHeight:height,frame:originalFrame});}
 }
 const boxFor=({object:o})=>{
  const b=o.getBoundingRect(),t=typeof o.text==='string'?tightNativeBox(o,b):null;
  if(!includeWholePictures&&o.sourceElementType==='picture'&&o.cutoutMethod==='pptx-original-object'&&o.originX==='center'&&o.originY==='center'){
   const left=Math.max(originalFrame.x,b.left),top=Math.max(originalFrame.y,b.top),right=Math.min(originalFrame.x+originalFrame.w,b.left+b.width),bottom=Math.min(originalFrame.y+originalFrame.h,b.top+b.height);
   // Keep the original-frame fit without moving any individual decoration.
   // The complete asset can still render in whatever new margins are available.
   return right>left&&bottom>top?{left,top,width:right-left,height:bottom-top}:{left:originalFrame.x,top:originalFrame.y,width:0,height:0};
  }
  return t?{left:t.x,top:t.y,width:t.w,height:t.h}:gridVisibleFitBox(o,b,state);
 };
 // Whole source pictures participate in one shared fit when selected. The
 // alternate original-frame mode keeps the former frame placement; trusted
 // outside patches participate only when the whole-picture mode is selected.
 // On a cross-checked saved frame, an already-expanded footer is not part of the
 // original content bounds; the existing footer routine will place it later.
 const boxes=parts.foreground.filter(({id})=>!hasSavedOutside||!footerIds.has(id)).map(boxFor);
 // A source-checked outside patch can extend the shared fit only in the
 // explicitly selected whole-picture mode. JSON metadata alone is not trust.
 if(includeWholePictures)boxes.push(...trustedOutsideFitBoxes(__outsideFit.boxes,state.objects));
 const l=Math.min(originalFrame.x,...boxes.map(b=>b.left)),t=Math.min(originalFrame.y,...boxes.map(b=>b.top));
 const r=Math.max(originalFrame.x+originalFrame.w,...boxes.map(b=>b.left+b.width)),b=Math.max(originalFrame.y+originalFrame.h,...boxes.map(b=>b.top+b.height));
 const scale=Math.min(width/(r-l),height/(b-t)),x=(width-(r-l)*scale)/2,y=(height-(b-t)*scale)/2;
 const offsetX=x-l*scale,offsetY=y-t*scale;
 const clipped=__outsideFit.boxes.filter(q=>offsetX+q.left*scale<0||offsetY+q.top*scale<0||offsetX+(q.left+q.width)*scale>width||offsetY+(q.top+q.height)*scale>height);
 globalThis.__outsideFitBefore={...__outsideFit,needsFit:false,clipped:clipped.map(q=>q.id)};
 globalThis.__outsideFitPlacement={margin:0,footerReserve:0,scale};
 const backgroundSet=new Set(parts.backgrounds.map(p=>p.object));
 // For a very different aspect ratio, cover can remove the entire supporting
 // surface. Stretch only the isolated background photo; never products/text.
 const needsStretch=p=>p.evidence==='separated-photo-cover'&&Math.max((width/height)/(p.object.width/p.object.height),(p.object.width/p.object.height)/(width/height))>1.75;
 const stretchPhoto=parts.backgrounds.some(needsStretch);
 for(const o of state.objects){
  if(backgroundSet.has(o)){
   const item=parts.backgrounds.find(p=>p.object===o);
   if(item.textureProfile){extendPaperTexture(o,state,width,height,scale,{x:x-l*scale,y:y-t*scale});continue;}
   if(needsStretch(item)){o.set({originX:'left',originY:'top',left:0,top:0,scaleX:width/o.width,scaleY:height/o.height});o.setCoords();continue;}
   if(extendSolidBackground(o,width,height))continue;
   if(String(o.type).toLowerCase()==='rect')o.set({left:0,top:0,originX:'left',originY:'top',scaleX:width/o.width,scaleY:height/o.height});
   else{const k=Math.max(width/o.width,height/o.height);o.set({originX:'left',originY:'top',left:(width-o.width*k)/2,top:(height-o.height*k)/2,scaleX:k,scaleY:k});}
   o.setCoords();continue;
  }
  const center=o.getCenterPoint();o.set({scaleX:o.scaleX*scale,scaleY:o.scaleY*scale});
  o.setPositionByOrigin(new state.F.Point(x+(center.x-l)*scale,y+(center.y-t)*scale),'center','center');o.setCoords();
 }
 const rightEdge=applyRightEdge(state,edge,width,height);
 const footerPlan=footerSource?applyFooterAfterResize(footerSource,state,width,height):null;
 globalThis.coexFooterPrototype=footerPlan;
 const partial=[];for(const proof of __partialProofs){const verified=o=>parts.backgrounds.some(p=>p.object===o&&p.evidence==='verified-full-frame-single-colour');const plan=planPartialSolid(state,proof,{width,height,scale,offset:{x:x-l*scale,y:y-t*scale}},verified);if(plan&&applyPartialSolid(state,plan))partial.push({id:proof.index,oldBox:plan.oldBox,newBox:plan.newBox});}
 globalThis.coexPartialSolidTrial=partial;
 const texture=parts.backgrounds.some(p=>p.textureProfile),photo=parts.backgrounds.some(p=>p.evidence==='separated-photo-cover');
 const reason=(parts.separated?'배경만 새 규격에 맞췄습니다. 글씨·로고·상품의 상대 위치·겹침·비율을 유지합니다.':'독립 배경을 확인하지 못해 원본 전체를 보호했습니다. 배경 분리는 완료되지 않았습니다.')+(includeWholePictures?' 원본 그림의 전체 범위까지 함께 맞추므로 전체 디자인이 더 작아질 수 있습니다.':' 원본 프레임 기준으로 맞춥니다. 새 여백이 없는 방향의 바깥 장식은 잘릴 수 있습니다.');
 const outsideReport=globalThis.coexGetOutsideRecoveryReport?.(),unresolvedOutside=includeWholePictures&&outsideReport&&((outsideReport.records||[]).some(r=>!r.candidate)||outsideReport.omitted>0);
 const outsideNotice=(clipped.length?' 원본 배치를 유지하여 일부 바깥 장식은 출력 경계 밖에 남습니다.':'')+(__outsideFit.skipped.length?` 바깥 연결 ${__outsideFit.skipped.length}개는 원본, 효과, 범위 또는 출력 크기 확인이 필요해 전체 맞춤에서 제외되어 잘릴 수 있습니다.`:'')+(unresolvedOutside?' 원본 전체를 확인하지 못한 바깥 장식은 잘릴 수 있습니다.':'')+(outsideFrameFailure?' 저장된 원본 영역을 확인하지 못해 기존 방식으로 크기를 조정했습니다. 장식 잘림과 반복 규격 변경 결과를 확인해 주세요.':'')+(__outsideFit.notes.length?' '+__outsideFit.notes.join(' '):'');
 return {policy:'background-only-v1',sourceEpoch:state.epoch,width,height,inputKind:state.inputKind||'layered',path:'background-only',method:'background-only',status:!parts.separated||parts.unresolved.length||texture||photo||partial.length||__partialReview.review||__outsideFit.skipped.length||__outsideFit.notes.length||__outsideFit.boxes.length||unresolvedOutside?'review':'ready',reason:reason+(partial.length?' 독립 단색 영역을 양 끝에 연결했습니다. 영역 용도와 경계를 확인하세요.':'')+(__partialReview.edited||!partial.length?__partialReview.reason:'')+outsideNotice,backgroundScope:photo?(stretchPhoto?'분리된 배경 사진을 화면에 늘려 맞췄습니다. 배경의 모양과 투명 영역을 확인하세요.':'분리된 배경 사진을 비율을 유지해 화면에 맞췄습니다. 가장자리 잘림과 투명 영역을 확인하세요.'):texture?'분리된 종이·벽돌 배경 질감을 바깥 영역에 반사 연결했습니다. 배경 추정·반복 무늬·이음선 검토 필요; AI 생성 아님':'확인된 단색·벡터 배경만 확장',crop:photo&&!stretchPhoto?'background-cover':'none',stretch:stretchPhoto,rightEdge,foregroundScale:scale,foregroundOffset:{x:x-l*scale,y:y-t*scale},separation:{status:parts.separated?'separated':'unseparated',backgrounds:parts.backgrounds.map(({id,name,evidence,textureProfile})=>({id,name,evidence,textureProfile})),foregroundIds:parts.foreground.map(p=>p.id),unresolved:parts.unresolved}};
}

export function separationPreviews(state,snapshot,parts=partitionBackground(state)){
 const result={};
 for(const kind of ['background','foreground'])result[kind]=withSeparationVisibility(state,parts,kind,()=>{
  const c=snapshot(state.width,state.height);try{return c.toDataURL('image/png');}finally{c.width=c.height=0;}
 });
 return {parts,...result};
}
