import {planPartialSolidExtension,isOpaqueSolidRgba} from './partial-solid-planner.mjs';
const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<0.01;
const dimensions=o=>({x:o.left,y:o.top,w:o.width*o.scaleX,h:o.height*o.scaleY});
// Advisory change detection only; not a cryptographic signature. Every field
// and the full image still goes through the independent safety checks below.
function sourceKey(src){if(typeof src!=='string'||src.length>20_000_000)return null;let a=2166136261,b=2246822519;for(let i=0;i<src.length;i++){let c=src.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489917);}return src.length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16);}
function geometry(o){return Object.fromEntries(['left','top','width','height','scaleX','scaleY'].map(k=>[k,o[k]]));}
function validReopenedEvidence(state,o){const p=o.partialSolidProvenance,g=p?.geometry,key=sourceKey(o.getSrc?.());return !!p&&p.version===1&&p.sourceKey===key&&!!key&&p.frame?.width===state.width&&p.frame?.height===state.height&&g&&Object.keys(geometry(o)).every(k=>near(g[k],o[k]))&&o.gridSourceUserEdited!==true&&!o.layerLocked;}
const geomEqual=(a,b)=>['x','y','w','h'].every(k=>near(a[k],b[k]));
const stable=o=>!!o&&['rect','image'].includes(String(o.type).toLowerCase())&&o.originX==='left'&&o.originY==='top'&&o.visible!==false&&!o.layerLocked&&!o.userEdited&&!o.gridSourceUserEdited&&!o.group&&!o.clipPath&&!o.shadow&&!o.filters?.length&&!o.angle&&!o.skewX&&!o.skewY&&!o.flipX&&!o.flipY&&!o.cropX&&!o.cropY&&!(o.rx||o.ry)&&!(o.stroke&&o.strokeWidth)&&!o.text&&!o.sourceText&&(o.opacity??1)===1&&(!o.globalCompositeOperation||o.globalCompositeOperation==='source-over')&&(String(o.type).toLowerCase()==='image'||/^#[0-9a-f]{6}$/i.test(o.fill||''))&&[o.left,o.top,o.width,o.height,o.scaleX,o.scaleY].every(Number.isFinite)&&o.width>0&&o.height>0&&o.scaleX>0&&o.scaleY>0;
// Trust is session-local. An importer or explicit user action must issue the
// capability after inspecting the independent object and semantic background.
// A role name, serialized flag or geometry alone is not sufficient evidence.
const capabilities=new WeakMap();
if(typeof window!=='undefined')window.addEventListener('coex:layer-edit',()=>{try{for(const o of globalThis.coexLayerLayout?.read?.()?.objects||[])capabilities.delete(o);}catch{}});
const solidScanCache=new WeakMap();
function imageEvidence(o,budget){
 if(String(o.type).toLowerCase()!=='image')return {kind:'rect'};
 const el=o.getElement?.(),src=o.getSrc?.(),w=el?.naturalWidth,h=el?.naturalHeight;
 if(el?.tagName!=='IMG'||!el.complete||(el.currentSrc||el.src)!==src||typeof src!=='string'||!/^data:image\/png;base64,/i.test(src)||src.length>20_000_000||!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>2_000_000||o.width!==w||o.height!==h)return null;
 const prior=solidScanCache.get(el);if(prior&&prior.src===src&&prior.w===w&&prior.h===h)return prior.ok?{kind:'image',el,src}:null; if(!budget||!Number.isFinite(budget.remaining)||budget.remaining<w*h)return null;budget.remaining-=w*h;
 let c;try{c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)return null;ctx.drawImage(el,0,0);const pixels=ctx.getImageData(0,0,w,h).data;const ok=isOpaqueSolidRgba({pixels,width:w,height:h});solidScanCache.set(el,{src,w,h,ok});if(!ok)return null;return {kind:'image',el,src};}
 catch{return null}finally{if(c)c.width=c.height=0;}
}
function sameImage(o,e){return e?.kind==='rect'?String(o.type).toLowerCase()==='rect':e?.kind==='image'&&String(o.type).toLowerCase()==='image'&&o.getElement?.()===e.el&&o.getSrc?.()===e.src&&(e.el.currentSrc||e.el.src)===e.src&&e.el.complete&&o.width===e.el.naturalWidth&&o.height===e.el.naturalHeight;}
export function registerIndependentRegion(state,o,evidence,budget={remaining:8_000_000}){
 if(!state?.objects?.includes(o)||!stable(o)||evidence?.independent!==true||!['import-source','user-confirmed','independent-pptx-review'].includes(evidence.kind)||evidence.object!==o||evidence.epoch!==state.epoch)return false;
 const image=imageEvidence(o,budget);if(!image)return false;capabilities.set(o,{epoch:state.epoch,fill:o.fill,image});return true;
}
export function revokeIndependentRegion(o){capabilities.delete(o);}
export function capturePartialSource(state,o){
 const cap=capabilities.get(o),i=state?.objects?.indexOf(o);
 if(!cap||cap.epoch!==state.epoch||cap.fill!==o.fill||!sameImage(o,cap.image)||!stable(o)||i<0)return null;
 return {object:o,epoch:state.epoch,revision:state.revision,index:i,objects:[...state.objects],box:dimensions(o),fill:o.fill,width:state.width,height:state.height};
}
// Call after the normal whole-design resize but before the atomic snapshot.
// The original region's source pixels remain in the same output coordinates.
export function planPartialSolid(state,proof,{width,height,scale,offset},isVerifiedBase){
 const o=proof?.object,cap=capabilities.get(o);
 if(!proof||!cap||state.epoch!==proof.epoch||state.revision!==proof.revision||state.objects[proof.index]!==o||state.objects.length!==proof.objects.length||state.objects.some((v,i)=>v!==proof.objects[i])||!stable(o)||o.fill!==proof.fill||cap.fill!==proof.fill||!sameImage(o,cap.image)||!(scale>0)||!Number.isFinite(offset?.x)||!Number.isFinite(offset?.y))return null;
 const output=dimensions(o),expected={x:proof.box.x*scale+offset.x,y:proof.box.y*scale+offset.y,w:proof.box.w*scale,h:proof.box.h*scale};
 if(!geomEqual(output,expected)||[output.x,output.y,output.x+output.w,output.y+output.h].some(v=>Math.abs(v-Math.round(v))>1e-6))return null;
 // Existing grid and anchored-footer handlers own their objects.
 if(o.gridExpansion||o.gridSourceProvenance||o.textureBackgroundFrame||o.anchoredBand||o.footerExpansion)return null;
 const objects=[];
 for(const [i,item] of state.objects.entries()){
  if(item===o||item.visible===false)continue;
  if(i<proof.index&&(item.shadow||item.filters?.length||item.__outsideTrialVisible||item.trialOutsideRestore||item.clipPath||item.group||String(item.type).toLowerCase()==='group'))return null;
  const b=item.getBoundingRect?.();if(!b||![b.left,b.top,b.width,b.height].every(Number.isFinite))return null;
  objects.push({id:i,paintIndex:i,visible:true,outputBox:{x:b.left,y:b.top,w:b.width,h:b.height},isVerifiedBaseBackground:!!isVerifiedBase?.(item,i)});
 }
 const result=planPartialSolidExtension({sourceWidth:proof.width,sourceHeight:proof.height,targetWidth:width,targetHeight:height,region:{id:proof.index,sourceBox:proof.box,outputBox:output,independent:true,role:'background',roleEvidence:'source-verified',visible:true,locked:false,opacity:1,composite:'source-over',verifiedSolid:true,paintIndex:proof.index},objects});
 return result.status==='candidate'?{...result,object:o,epoch:proof.epoch,revision:proof.revision,fill:o.fill,index:proof.index,outputFrame:{width,height},scene:state.objects.map(item=>({object:item,visible:item.visible,box:item.getBoundingRect?.()}))}:null;
}
// Exact source object remains the only object, in the same paint position.
// Atomic host capture/restore must include left/top/scaleX/scaleY.
export function applyPartialSolid(state,plan){
 const o=plan?.object;if(!plan||state.objects.length!==plan.scene.length||plan.scene.some((p,i)=>{const item=state.objects[i],a=p.box,b=item?.getBoundingRect?.();return item!==p.object||item.visible!==p.visible||!!a!==!!b||a&&['left','top','width','height'].some(k=>!near(a[k],b[k]));})||!capabilities.has(o)||!sameImage(o,capabilities.get(o).image)||state.epoch!==plan.epoch||state.revision!==plan.revision||state.objects[plan.index]!==o||!stable(o)||o.fill!==plan.fill||!geomEqual(dimensions(o),plan.oldBox))return false;
 const b=plan.newBox;if(b.x>plan.oldBox.x+0.01||b.y>plan.oldBox.y+0.01||b.x+b.w<plan.oldBox.x+plan.oldBox.w-0.01||b.y+b.h<plan.oldBox.y+plan.oldBox.h-0.01)return false;
 const geom={left:b.x,top:b.y,width:o.width,height:o.height,scaleX:b.w/o.width,scaleY:b.h/o.height};const key=sourceKey(o.getSrc?.());
 o.set({...geom,partialSolidProvenance:key?{version:1,sourceKey:key,frame:{...plan.outputFrame},geometry:{...geom}}:undefined});o.setCoords();return true;
}







// Conservative automatic inference for initial, unedited independent PPTX
// pictures only. A uniformly coloured picture can still have semantic meaning;
// this produces a REVIEW candidate, not a proof of artistic intent.
export function inferInitialPptxSolid(state,o,budget={remaining:8_000_000}){
 if(!['pptx','json'].includes(state?.sourceFormat)||state.inputKind!=='layered'||String(o?.type).toLowerCase()!=='image'||o.layerRoleInferred!==true||o.layerRole!=='subject'||o.sourceElementType!=='picture'||o.cutoutMethod!=='pptx-original-object'||!/^slide:\d+$/.test(o.sourceElementId||'')||o.layoutManualRole||o.layoutManualGroup||o.gridSourceUserEdited||o.sourceImageFill||o.gridExpansion||o.gridSourceProvenance||o.textureBackgroundFrame||!stable(o))return false;
 if(state.sourceFormat==='json'&&!validReopenedEvidence(state,o))return false;
 const b=dimensions(o),w=state.width,h=state.height,t=Math.max(1,Math.min(w,h)*.002),left=Math.abs(b.x)<=t,right=Math.abs(b.x+b.w-w)<=t,top=Math.abs(b.y)<=t,bottom=Math.abs(b.y+b.h-h)<=t;
 if(![w,h].every(v=>Number.isFinite(v)&&v>0)||b.x< -t||b.y< -t||b.x+b.w>w+t||b.y+b.h>h+t)return false;
 const horizontal=left&&right&&b.h>=h*.08&&b.h<=h*.45,vertical=top&&bottom&&b.w>=w*.08&&b.w<=w*.45;
 if(!horizontal&&!vertical)return false;
 // Require an independently drawn later foreground; no flattened poster can pass.
 const i=state.objects.indexOf(o);if(i<0||!state.objects.slice(i+1).some(x=>x.visible!==false&&(typeof x.text==='string'||x.sourceElementType==='picture')&&x.sourceElementId))return false;
 return registerIndependentRegion(state,o,{object:o,independent:true,epoch:state.epoch,kind:'independent-pptx-review'},budget);
}







