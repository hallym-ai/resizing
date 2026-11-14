import {verifiedPictureRecord,blockedVerifiedPicture} from './verified-picture-object.mjs';
import {withSeparationVisibility} from './source-background-separation.mjs';
import {outsideFitBounds,inferOutsideOriginalFrame} from './outside-fit.mjs';
import {hasTrustedOutsideCandidate} from './final-outside-overlay.mjs';
import {partialConnectionReview} from './partial-solid-review.mjs';
import {capturePartialSource,planPartialSolid,applyPartialSolid} from './partial-solid-transaction.mjs';
import {tightNativeBox} from './family-master.mjs';
import {solidBackgroundColor,extendSolidBackground} from './solid-background.mjs';
import {masonryTextureProfile,paperTextureProfile,paperEdgeProfile,extendPaperTexture,installTextureBackgroundRenderer} from './texture-background.mjs';


// Runtime evidence only: a verified full-frame native texture may be inset by
// the initial whole-design fit. Never deserialize this provenance from JSON.
const initialTextureFits=new WeakMap();let verifiedPaperFits=new WeakMap();
export function revokeVerifiedPaperFits(){verifiedPaperFits=new WeakMap();}
// Import-inferred bitmap metadata is advisory, never proof of an empty
// background. Keep these compatibility exports for saved-project cleanup.
export function revokeNativeBitmapProvenance(o){if(o)delete o.nativeBitmapProvenance;}
export function canonicalBitmapProvenance(){return null;}
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
  // Photo background layers may contain foreground-shaped transparent holes.
  // Keep them with all other foreground objects even when marked background.
  const separatedPhoto=type==='image'&&o.photoInstanceKind==='background';
  const blockedPaper=blockedVerifiedPicture(o,state)||(state.sourceFormat==='json'&&o.textureBackgroundFrame?.mode==='edge-strip-v1');
  const safe=!blockedPaper&&!separatedPhoto&&(full||matchedInitialTextureFit(o,state,box))&&!text&&o.layerRole==='background'&&!o.clipPath&&!o.shadow&&!o.angle&&!o.skewX&&!o.skewY&&!o.flipX&&!o.flipY&&!(o.cropX||o.cropY)&&!o.filters?.length&&(!o.globalCompositeOperation||o.globalCompositeOperation==='source-over')&&(o.opacity??1)===1;
  // A source-verified native picture may cover the slide by a tiny bleed.
  // Its inferred subject role alone never grants permission: verify session
  // provenance, paint order, image identity and bounded frame coverage first.
  const epsX=state.width*.0025,epsY=state.height*.0025;
  const bleed=box.left<=0&&box.top<=0&&box.left>=-epsX&&box.top>=-epsY&&box.left+box.width>=state.width&&box.left+box.width<=state.width+epsX&&box.top+box.height>=state.height&&box.top+box.height<=state.height+epsY;
  const remembered=verifiedPaperFits.get(o),samePaper=remembered&&!blockedPaper&&o.layerRole===remembered.role&&!!o.layerLocked===remembered.locked&&o.layerRoleInferred&&!o.layoutManualRole&&state.sourceFormat==='pptx'&&remembered.epoch===state.epoch&&o.getElement?.()===remembered.element&&o.getSrc?.()===remembered.src&&o.textureBackgroundFrame&&full;
  const verifiedPaper=!blockedPaper&&((!o.layerLocked&&o.layerRole==='subject')||(o.layerLocked&&o.layerRole==='background'))&&o.layerRoleInferred&&!o.layoutManualRole&&!separatedPhoto&&type==='image'&&!text&&!o.clipPath&&!o.shadow&&!o.angle&&!o.skewX&&!o.skewY&&!o.flipX&&!o.flipY&&!(o.cropX||o.cropY)&&!o.filters?.length&&(!o.globalCompositeOperation||o.globalCompositeOperation==='source-over')&&(o.opacity??1)===1&&state.objects.slice(0,id).every(x=>x.visible===false||backgrounds.some(p=>p.object===x))&&(samePaper||bleed&&verifiedPictureRecord(o,state,box));
  const plain=safe&&!!solidBackgroundColor(o);
  const opaqueStop=stop=>{if((stop.opacity??1)!==1||!CSS.supports('color',stop.color))return false;const c=document.createElement('canvas');c.width=c.height=1;try{const ctx=c.getContext('2d');ctx.fillStyle=stop.color;ctx.fillRect(0,0,1,1);return ctx.getImageData(0,0,1,1).data[3]===255;}finally{c.width=c.height=0;}};
  const gradient=safe&&type==='rect'&&Array.isArray(o.fill?.colorStops)&&o.fill.colorStops.length>=2&&o.fill.colorStops.every(opaqueStop)&&!o.rx&&!o.ry&&(!o.stroke||!o.strokeWidth);
  // A slide-fill name or a background role does not prove that a raster is
  // free of baked-in lettering/products. Non-flat rasters remain protected.
  const needsCaptureProof=state.sourceFormat==='pptx'&&o.layerRoleInferred&&o.layerRole==='background'&&o.cutoutMethod==='pptx-original-object';
  const edge=verifiedPaper?paperEdgeProfile(o,state):null;
  const texture=verifiedPaper?(edge?paperTextureProfile(o,state,{allowWarmLowContrast:o.layerRole==='background'}):null):safe&&!needsCaptureProof&&type==='image'?(paperTextureProfile(o,state)||masonryTextureProfile(o,state)):null;
  if(texture&&verifiedPaper&&!samePaper)verifiedPaperFits.set(o,{epoch:state.epoch,element:o.getElement?.(),src:o.getSrc?.(),role:o.layerRole,locked:!!o.layerLocked});
  const evidence=plain?'verified-full-frame-single-colour':gradient?'verified-full-frame-opaque-gradient':texture?.evidence||null;
  const item={id,object:o,evidence,textureProfile:texture,edgeStrip:!!(verifiedPaper&&edge&&texture),name:o.layerName||o.type};
  if(evidence)backgrounds.push(item);else{foreground.push(item);if(o.layerRole==='background')unresolved.push({id,name:item.name,reason:'분리 근거가 없는 이미지·도형은 보호 요소로 유지'});}
 }
 // Extending a background painted above a foreground could newly cover it.
 const first=foreground.length?Math.min(...foreground.map(x=>x.id)):Infinity;
 for(let i=backgrounds.length-1;i>=0;i--)if(backgrounds[i].id>first){const item=backgrounds.splice(i,1)[0];foreground.push(item);unresolved.push({id:item.id,name:item.name,reason:'전경 위에 있는 배경 후보는 원본 위치 유지'});}
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
 const __partialProofs=state.objects.map(o=>capturePartialSource(state,o)).filter(Boolean); const parts=partitionBackground(state);
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
 // Keep every foreground element in the same source-relative layout, including
 // solid strips and their text, even when a saved frame is recovered.
 const boxes=parts.foreground.map(boxFor);
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
 for(const o of state.objects){
  if(backgroundSet.has(o)){
   const item=parts.backgrounds.find(p=>p.object===o);
   if(item.textureProfile){extendPaperTexture(o,state,width,height,scale,{x:x-l*scale,y:y-t*scale},item.edgeStrip?'edge-strip-v1':undefined);continue;}
   if(extendSolidBackground(o,width,height))continue;
   if(String(o.type).toLowerCase()==='rect')o.set({left:0,top:0,originX:'left',originY:'top',scaleX:width/o.width,scaleY:height/o.height});
   else{const k=Math.max(width/o.width,height/o.height);o.set({originX:'left',originY:'top',left:(width-o.width*k)/2,top:(height-o.height*k)/2,scaleX:k,scaleY:k});}
   o.setCoords();continue;
  }
  const center=o.getCenterPoint();o.set({scaleX:o.scaleX*scale,scaleY:o.scaleY*scale});
  o.setPositionByOrigin(new state.F.Point(x+(center.x-l)*scale,y+(center.y-t)*scale),'center','center');o.setCoords();
 }
 // Role inferred from geometry is not permission to move or stretch an item.
 const rightEdge=null;
 globalThis.coexFooterPrototype=null;
 const partial=[];for(const proof of __partialProofs){const verified=o=>parts.backgrounds.some(p=>p.object===o&&p.evidence==='verified-full-frame-single-colour');const plan=planPartialSolid(state,proof,{width,height,scale,offset:{x:x-l*scale,y:y-t*scale}},verified);if(plan&&applyPartialSolid(state,plan))partial.push({id:proof.index,oldBox:plan.oldBox,newBox:plan.newBox});}
 globalThis.coexPartialSolidTrial=partial;
 const texture=parts.backgrounds.some(p=>p.textureProfile);
 const reason=(parts.separated?'배경만 새 규격에 맞췄습니다. 글씨·로고·상품의 상대 위치·겹침·비율을 유지합니다.':'독립 배경을 확인하지 못해 원본 전체를 보호했습니다. 배경 분리는 완료되지 않았습니다.')+(includeWholePictures?' 원본 그림의 전체 범위까지 함께 맞추므로 전체 디자인이 더 작아질 수 있습니다.':' 원본 프레임 기준으로 맞춥니다. 새 여백이 없는 방향의 바깥 장식은 잘릴 수 있습니다.');
 const outsideReport=globalThis.coexGetOutsideRecoveryReport?.(),unresolvedOutside=includeWholePictures&&outsideReport&&((outsideReport.records||[]).some(r=>!r.candidate)||outsideReport.omitted>0);
 const outsideNotice=(clipped.length?' 원본 배치를 유지하여 일부 바깥 장식은 출력 경계 밖에 남습니다.':'')+(__outsideFit.skipped.length?` 바깥 연결 ${__outsideFit.skipped.length}개는 원본, 효과, 범위 또는 출력 크기 확인이 필요해 전체 맞춤에서 제외되어 잘릴 수 있습니다.`:'')+(unresolvedOutside?' 원본 전체를 확인하지 못한 바깥 장식은 잘릴 수 있습니다.':'')+(outsideFrameFailure?' 저장된 원본 영역을 확인하지 못해 기존 방식으로 크기를 조정했습니다. 장식 잘림과 반복 규격 변경 결과를 확인해 주세요.':'')+(__outsideFit.notes.length?' '+__outsideFit.notes.join(' '):'');
 return {policy:'background-only-v1',sourceEpoch:state.epoch,width,height,inputKind:state.inputKind||'layered',path:'background-only',method:'background-only',status:!parts.separated||parts.unresolved.length||texture||partial.length||__partialReview.review||__outsideFit.skipped.length||__outsideFit.notes.length||__outsideFit.boxes.length||unresolvedOutside?'review':'ready',reason:reason+(partial.length?' 독립 단색 영역을 양 끝에 연결했습니다. 영역 용도와 경계를 확인하세요.':'')+(__partialReview.edited||!partial.length?__partialReview.reason:'')+outsideNotice,backgroundScope:texture?'종이·벽돌로 추정한 그림을 바깥 영역에 반사 연결한 검토 후보입니다. 가장자리 글씨·상품 반복과 무늬·이음선을 확인하세요. AI 생성 아님':'확인된 단색·벡터 배경만 확장',crop:'none',stretch:false,rightEdge,foregroundScale:scale,foregroundOffset:{x:x-l*scale,y:y-t*scale},separation:{status:parts.separated?'separated':'unseparated',backgrounds:parts.backgrounds.map(({id,name,evidence,textureProfile})=>({id,name,evidence,textureProfile})),foregroundIds:parts.foreground.map(p=>p.id),unresolved:parts.unresolved}};
}

export function separationPreviews(state,snapshot,parts=partitionBackground(state)){
 const result={};
 for(const kind of ['background','foreground'])result[kind]=withSeparationVisibility(state,parts,kind,()=>{
  const c=snapshot(state.width,state.height);try{return c.toDataURL('image/png');}finally{c.width=c.height=0;}
 });
 return {parts,...result};
}
