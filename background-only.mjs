import {outsideFitBounds,inferOutsideOriginalFrame} from './outside-fit.mjs';
import {planAnchoredFooter} from './anchored-band.mjs';
import {partialConnectionReview} from './partial-solid-review.mjs';
import {capturePartialSource,planPartialSolid,applyPartialSolid,inferInitialPptxSolid} from './partial-solid-transaction.mjs';
import {tightNativeBox} from './family-master.mjs';
import {captureRightEdge,applyRightEdge} from './right-edge-anchors.mjs';
import {solidBackgroundColor,extendSolidBackground} from './solid-background.mjs';
import {masonryTextureProfile,paperTextureProfile,extendPaperTexture,installTextureBackgroundRenderer} from './texture-background.mjs';
import {captureFooterSource,applyFooterAfterResize} from './band-runtime.mjs';


// Runtime evidence only: a verified full-frame native texture may be inset by
// the initial whole-design fit. Never deserialize this provenance from JSON.
const initialTextureFits=new WeakMap();
// A native full-slide bitmap is still only an inferred background. Keep its
// import-time fit as in-memory evidence, never as a trust grant in project JSON.
const initialBitmapFits=new WeakMap(),bitmapAlphaCache=new WeakMap();
const bitmapEvidence='pptx-native-bitmap-stretch-review',jsonBitmapEvidence='json-independent-bitmap-stretch-review';
function usableBitmapAlpha(o){
 const el=o.getElement?.(),w=el?.naturalWidth||el?.width,h=el?.naturalHeight||el?.height,src=o.getSrc?.();
 if(!el||!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>8000000||typeof src!=='string'||!/^data:image\/png;base64,/i.test(src)||o.width!==w||o.height!==h)return false;
 const key=src+':'+w+'x'+h,old=bitmapAlphaCache.get(el);if(el.tagName==='IMG'&&old?.key===key)return old.ok;
 let c,ok=false;try{c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});if(!x)return false;x.drawImage(el,0,0);const p=x.getImageData(0,0,w,h).data;ok=true;for(let i=3;i<p.length;i+=4)if(p[i]<32){ok=false;break;}}
 catch{ok=false;}finally{if(c)c.width=c.height=0;}if(el.tagName==='IMG')bitmapAlphaCache.set(el,{key,ok});return ok;
}
// Checks accidental source changes, not an authenticity signature. A project
// claiming this metadata is still subject to every structural/pixel check.
function bitmapSourceKey(src){if(typeof src!=='string'||src.length>50*1024*1024)return null;let a=2166136261,b=2246822519;for(let i=0;i<src.length;i++){const c=src.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489917);}return src.length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16);}
function validBitmapReviewMetadata(o){const p=o?.nativeBitmapProvenance,key=bitmapSourceKey(o?.getSrc?.());return !!p&&typeof key==='string'&&p.version===1&&p.lockOrigin==='import-inferred'&&p.sourceKey===key;}
export function revokeNativeBitmapProvenance(o){initialBitmapFits.delete(o);if(o)delete o.nativeBitmapProvenance;}
export function canonicalBitmapProvenance(state,o){if(!nativeBitmapCandidate(state,o,true,true))return null;return {version:1,lockOrigin:'import-inferred',sourceKey:bitmapSourceKey(o.getSrc?.())};}
function nativeBitmapCandidate(state,o,allowRecordedFit=true,forSave=false){
 if(state.inputKind!=='layered'||!['pptx','json'].includes(state.sourceFormat)||!o||o.visible===false||o.layerRole!=='background'||o.layerRoleInferred!==true||o.layerLocked!==true||o.layoutManualRole||o.layoutManualGroup||o.sourceElementType!=='picture'||o.cutoutMethod!=='pptx-original-object'||!/^slide:\d+$/.test(o.sourceElementId||'')||String(o.type).toLowerCase()!=='image'||o.sourceText||o.text||o.sourceImageFill||o.group||o.clipPath||o.shadow||o.filters?.length||o.angle||o.skewX||o.skewY||o.flipX||o.flipY||o.cropX||o.cropY||(o.opacity??1)!==1||o.globalCompositeOperation&&o.globalCompositeOperation!=='source-over'||!(o.scaleX>0&&o.scaleY>0))return false;
 if(state.sourceFormat==='json'&&!validBitmapReviewMetadata(o))return false;
 const index=state.objects.indexOf(o),box=o.getBoundingRect(),tol=2,full=Math.abs(box.left)<=tol&&Math.abs(box.top)<=tol&&Math.abs(box.left+box.width-state.width)<=tol&&Math.abs(box.top+box.height-state.height)<=tol;
 const fit=initialBitmapFits.get(o),recorded=allowRecordedFit&&fit&&fit.epoch===state.epoch&&fit.width===state.width&&fit.height===state.height&&fit.element===o.getElement?.()&&fit.src===o.getSrc?.()&&['left','top','width','height'].every(k=>Math.abs(fit.box[k]-box[k])<=.01);
 const saveFit=forSave&&state.sourceFormat==='pptx'&&fit&&fit.epoch===state.epoch&&fit.element===o.getElement?.()&&fit.src===o.getSrc?.()&&full;
 // A restored history scene has new Fabric objects and no WeakMap entry.
 // Prior saved metadata is advisory only; source, full-frame geometry,
 // locks, effects, paint order, matte and alpha are independently rechecked.
 const restoredFit=state.sourceFormat==='pptx'&&full&&validBitmapReviewMetadata(o);
 if(index<0||!(allowRecordedFit?(recorded||saveFit||restoredFit||state.sourceFormat==='json'&&full):full))return false;
 const below=state.objects.slice(0,index).filter(x=>x.visible!==false),under=below[0],b=under?.getBoundingRect();
 if(below.length!==1||!b||Math.abs(b.left)>tol||Math.abs(b.top)>tol||Math.abs(b.left+b.width-state.width)>tol||Math.abs(b.top+b.height-state.height)>tol||!solidBackgroundColor(under))return false;
 const later=state.objects.slice(index+1).filter(x=>x.visible!==false&&x.sourceElementId&&x.cutoutMethod==='pptx-original-object');
 return later.length>=2&&usableBitmapAlpha(o);
}
// Lock edits revoke the import-time inference, even if the user later relocks.
if(typeof window!=='undefined')window.addEventListener('coex:layer-edit',()=>{try{const s=globalThis.coexLayerLayout?.read?.();for(const o of s?.objects||[]){const fit=initialBitmapFits.get(o);if(fit&&(o.layerLocked!==fit.locked||o.layerRoleInferred!==true||o.layerRole!=='background'||o.layoutManualRole||o.layoutManualGroup))initialBitmapFits.delete(o);}}catch{}});
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
 const before=state.objects.map(o=>({o,box:o.getBoundingRect?.(),element:o.getElement?.(),src:o.getSrc?.()}));
 const native=before.filter(e=>nativeBitmapCandidate(state,e.o,false));
 const result=callback();
 for(const c of candidates){const o=c.object;if(o.getElement?.()!==c.element||o.getSrc?.()!==c.src)continue;initialTextureFits.set(o,{element:c.element,src:c.src,kind:state.inputKind,format:state.sourceFormat,epoch:state.epoch,width:state.width,height:state.height,box:{...o.getBoundingRect()}});}
 for(const e of native){const b=e.o.getBoundingRect(),k=b.width/e.box.width,ky=b.height/e.box.height,dx=b.left-e.box.left*k,dy=b.top-e.box.top*k;if(!Number.isFinite(k)||k<=0||k>1.00001||Math.abs(k-ky)>.002||e.element!==e.o.getElement?.()||e.src!==e.o.getSrc?.())continue;
  const same=before.every(v=>{if(v.o.visible===false||v.o.layerRole==='background'||!v.box)return true;const q=v.o.getBoundingRect();return Math.abs(q.left-(v.box.left*k+dx))<=2&&Math.abs(q.top-(v.box.top*k+dy))<=2&&Math.abs(q.width-v.box.width*k)<=2&&Math.abs(q.height-v.box.height*k)<=2;});
  if(same)initialBitmapFits.set(e.o,{epoch:state.epoch,width:state.width,height:state.height,element:e.element,src:e.src,box:{...b},locked:e.o.layerLocked});
 }
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
  const bitmap=!plain&&!gradient&&!texture&&!photo&&nativeBitmapCandidate(state,o);
  const evidence=plain?'verified-full-frame-single-colour':gradient?'verified-full-frame-opaque-gradient':texture?.evidence||(photo?'separated-photo-cover':bitmap?(state.sourceFormat==='json'?jsonBitmapEvidence:bitmapEvidence):null);
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
export function resizeBackgroundOnly(state,width,height){
 installTextureBackgroundRenderer(state.F);
 if(state.fontError)throw Error(state.fontError);
 const __partialReview=partialConnectionReview(state);
 const __partialBudget={remaining:8_000_000};for(const o of state.objects)inferInitialPptxSolid(state,o,__partialBudget); const __partialProofs=state.objects.map(o=>capturePartialSource(state,o)).filter(Boolean); const parts=partitionBackground(state),edge=captureRightEdge(state,parts);
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
 const boxFor=({object:o})=>{const b=o.getBoundingRect(),t=typeof o.text==='string'?tightNativeBox(o,b):null;return t?{left:t.x,top:t.y,width:t.w,height:t.h}:gridVisibleFitBox(o,b,state);};
 // Foreground layout is computed from the original visible frame alone. Do not
 // shrink/move it to include extension pixels: those are rendered separately.
 // On a cross-checked saved frame, an already-expanded footer is not part of the
 // original content bounds; the existing footer routine will place it later.
 const boxes=parts.foreground.filter(({id})=>!hasSavedOutside||!footerIds.has(id)).map(boxFor);
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
 const needsStretch=p=>(p.evidence===bitmapEvidence||p.evidence===jsonBitmapEvidence)||p.evidence==='separated-photo-cover'&&Math.max((width/height)/(p.object.width/p.object.height),(p.object.width/p.object.height)/(width/height))>1.75;
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
 // Preserve only independently revalidated background evidence as part of the
 // same resize transaction. Other foreground edits must not revoke it.
 for(const item of parts.backgrounds){if(item.evidence!==bitmapEvidence&&item.evidence!==jsonBitmapEvidence)continue;const p=canonicalBitmapProvenance({...state,width,height},item.object);if(p)item.object.set('nativeBitmapProvenance',p);}
 const rightEdge=applyRightEdge(state,edge,width,height);
 const footerPlan=footerSource?applyFooterAfterResize(footerSource,state,width,height):null;
 globalThis.coexFooterPrototype=footerPlan;
 const partial=[];for(const proof of __partialProofs){const verified=o=>parts.backgrounds.some(p=>p.object===o&&p.evidence==='verified-full-frame-single-colour');const plan=planPartialSolid(state,proof,{width,height,scale,offset:{x:x-l*scale,y:y-t*scale}},verified);if(plan&&applyPartialSolid(state,plan))partial.push({id:proof.index,oldBox:plan.oldBox,newBox:plan.newBox});}
 globalThis.coexPartialSolidTrial=partial;
 const texture=parts.backgrounds.some(p=>p.textureProfile),photo=parts.backgrounds.some(p=>p.evidence==='separated-photo-cover'),bitmap=parts.backgrounds.some(p=>p.evidence===bitmapEvidence||p.evidence===jsonBitmapEvidence);
 const reason=bitmap?'독립된 전체 화면 그림을 배경 후보로 늘렸습니다. 그림 안의 글씨·로고 포함 여부와 왜곡은 확인이 필요합니다.':parts.separated?'배경만 새 규격에 맞췄습니다. 글씨·로고·상품의 상대 위치·겹침·비율을 유지합니다.':'독립 배경을 확인하지 못해 원본 전체를 보호했습니다. 배경 분리는 완료되지 않았습니다.';
 const outsideNotice=(clipped.length?' 원본 배치를 유지하여 일부 바깥 장식은 출력 경계 밖에 남습니다.':'')+(__outsideFit.skipped.length?` 바깥 연결 ${__outsideFit.skipped.length}개는 원본, 효과, 범위 또는 출력 크기 확인이 필요해 전체 맞춤에서 제외되어 잘릴 수 있습니다.`:'')+(outsideFrameFailure?' 저장된 원본 영역을 확인하지 못해 기존 방식으로 크기를 조정했습니다. 장식 잘림과 반복 규격 변경 결과를 확인해 주세요.':'')+(__outsideFit.notes.length?' '+__outsideFit.notes.join(' '):'');
 return {policy:'background-only-v1',sourceEpoch:state.epoch,width,height,inputKind:state.inputKind||'layered',path:'background-only',method:'background-only',status:!parts.separated||parts.unresolved.length||texture||photo||bitmap||partial.length||__partialReview.review||__outsideFit.skipped.length||__outsideFit.notes.length||__outsideFit.boxes.length?'review':'ready',reason:reason+(partial.length?' 독립 단색 영역을 양 끝에 연결했습니다. 영역 용도와 경계를 확인하세요.':'')+(__partialReview.edited||!partial.length?__partialReview.reason:'')+outsideNotice,backgroundScope:bitmap?'독립 그림을 배경 후보로 비균등 확대했습니다. 이미지에 포함된 글씨·로고와 배경 왜곡을 직접 확인하세요. AI 생성이 아닙니다.':photo?(stretchPhoto?'분리된 배경 사진을 화면에 늘려 맞췄습니다. 배경의 모양과 투명 영역을 확인하세요.':'분리된 배경 사진을 비율을 유지해 화면에 맞췄습니다. 가장자리 잘림과 투명 영역을 확인하세요.'):texture?'분리된 종이·벽돌 배경 질감을 바깥 영역에 반사 연결했습니다. 배경 추정·반복 무늬·이음선 검토 필요; AI 생성 아님':'확인된 단색·벡터 배경만 확장',crop:photo&&!stretchPhoto?'background-cover':'none',stretch:stretchPhoto,rightEdge,foregroundScale:scale,foregroundOffset:{x:x-l*scale,y:y-t*scale},separation:{status:parts.separated?'separated':'unseparated',backgrounds:parts.backgrounds.map(({id,name,evidence,textureProfile})=>({id,name,evidence,textureProfile})),foregroundIds:parts.foreground.map(p=>p.id),unresolved:parts.unresolved}};
}

export function separationPreviews(state,snapshot){
 const p=partitionBackground(state),visible=state.objects.map(o=>o.visible),result={},canvas=state.objects.find(o=>o.canvas)?.canvas,backdrop=canvas?.backgroundColor;
 if(canvas)canvas.backgroundColor='';
 try{for(const [key,items]of [['background',p.backgrounds],['foreground',p.foreground]]){const set=new Set(items.map(v=>v.object));state.objects.forEach(o=>o.visible=set.has(o));const c=snapshot(state.width,state.height);try{result[key]=c.toDataURL('image/png');}finally{c.width=c.height=0;}}}
 finally{state.objects.forEach((o,i)=>o.visible=visible[i]);if(canvas)canvas.backgroundColor=backdrop;}
 return {parts:p,...result};
}
