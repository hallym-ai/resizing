// An explicit, session-only confirmation grants a review candidate for one
// independent background image. Metadata and reopened JSON never grant trust.
const EPS=1e-5,MAX_PIXELS=4_000_000;
const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=EPS;
const source=o=>o?.getElement?.(),url=o=>o?.getSrc?.();
const box=o=>({x:o.left,y:o.top,w:o.width*o.scaleX,h:o.height*o.scaleY});
const same=(a,b)=>a&&b&&['x','y','w','h'].every(k=>near(a[k],b[k]));
const meta=o=>[o.layerRole,o.layerRoleInferred,o.layoutManualRole,o.sourceElementId,o.sourceElementType,o.cutoutMethod];
const safe=o=>!!o&&String(o.type).toLowerCase()==='image'&&o.visible!==false&&!o.group&&!o.clipPath&&!o.shadow&&!o.filters?.length&&!o.angle&&!o.skewX&&!o.skewY&&!o.flipX&&!o.flipY&&!o.cropX&&!o.cropY&&!(o.stroke&&o.strokeWidth)&&!o.sourceText&&!o.text&&!o.sourceImageFill&&!o.photoInstanceGroup&&!o.originalPhotoSource&&!o.textureBackgroundFrame&&!o.outsideRecovery&&!o.outsideRecoveryReview&&!o.__outsideRenderInstalled&&!o.trialOutsideRestore&&!o.__outsideTrialVisible&&!Object.hasOwn(o,'_render')&&(o.opacity??1)===1&&(!o.globalCompositeOperation||o.globalCompositeOperation==='source-over')&&o.originX==='left'&&o.originY==='top'&&[o.left,o.top,o.width,o.height,o.scaleX,o.scaleY].every(Number.isFinite)&&o.width>0&&o.height>0&&o.scaleX>0&&o.scaleY>0;

// Determine the smallest symmetric crop whose remaining pixels are all opaque.
// A substantial or interior transparent area is ambiguous and is not filled.
export function inspectOpaqueInset({pixels,width,height}){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<8||height<8||width*height>MAX_PIXELS||!(pixels instanceof Uint8Array||pixels instanceof Uint8ClampedArray)||pixels.length!==width*height*4)return null;
 let inset=0,nonopaque=0;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]!==255){nonopaque++;inset=Math.max(inset,1+Math.min(x,y,width-1-x,height-1-y));}
 const limit=Math.max(1,Math.floor(Math.min(width,height)*.02));if(inset>limit||width-2*inset<8||height-2*inset<8)return null;
 return {inset,nonopaque,width:width-2*inset,height:height-2*inset};
}

export function createIndependentBackgroundCoverSession({readPixels}){
 if(typeof readPixels!=='function')throw Error('pixel reader required');const records=new WeakMap();let generation=0;
 function invalidate(){generation++;}
 function confirm(state,object,confirmation){
  if(!state||!Array.isArray(state.objects)||!state.objects.includes(object)||!safe(object)||confirmation?.kind!=='user-confirmed-independent-background'||confirmation.object!==object||confirmation.epoch!==state.epoch||confirmation.revision!==state.revision)return false;
  const el=source(object),src=url(object),w=el?.naturalWidth,h=el?.naturalHeight;
  if(String(el?.tagName||'').toUpperCase()!=='IMG'||!el.complete||typeof src!=='string'||!/^data:image\/png;base64,/i.test(src)||(el.currentSrc||el.src)!==src||w!==object.width||h!==object.height||!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w*h>MAX_PIXELS)return false;
  const b=box(object);if(b.x>1||b.y>1||b.x+b.w<state.width-1||b.y+b.h<state.height-1)return false;
  let pixels;try{pixels=readPixels(el,w,h)}catch{return false}const inset=inspectOpaqueInset({pixels,width:w,height:h});if(!inset)return false;
  records.set(object,{epoch:state.epoch,revision:state.revision,generation,el,src,w,h,inset,original:b,metadata:meta(object),order:[...state.objects],sourceWidth:state.width,sourceHeight:state.height});return true;
 }
 function capture(state,object){const r=records.get(object);if(!r||r.generation!==generation||r.epoch!==state?.epoch||r.revision!==state?.revision||!safe(object)||meta(object).some((v,i)=>!Object.is(v,r.metadata[i]))||source(object)!==r.el||url(object)!==r.src||(r.el.currentSrc||r.el.src)!==r.src||r.el.naturalWidth!==r.w||r.el.naturalHeight!==r.h||!same(box(object),r.original)||state.width!==r.sourceWidth||state.height!==r.sourceHeight||state.objects.length!==r.order.length||state.objects.some((v,i)=>v!==r.order[i]))return null;return {object,record:r,index:r.order.indexOf(object)};}
 function plan(state,proof,{width,height,scale,offset},isVerifiedBase,isVerifiedOutside){const r=records.get(proof?.object),o=proof?.object;
  if(!r||r!==proof.record||proof.index!==r.order.indexOf(o)||r.generation!==generation||state?.epoch!==r.epoch||state.revision!==r.revision||!safe(o)||meta(o).some((v,i)=>!Object.is(v,r.metadata[i]))||source(o)!==r.el||url(o)!==r.src||(r.el.currentSrc||r.el.src)!==r.src||r.el.naturalWidth!==r.w||r.el.naturalHeight!==r.h||state.objects.length!==r.order.length||state.objects.some((v,i)=>v!==r.order[i])||!Number.isFinite(scale)||scale<=0||![width,height].every(n=>Number.isSafeInteger(n)&&n>0&&n<=12000)||![offset?.x,offset?.y].every(Number.isFinite))return {status:'unavailable',reason:'source-or-scene-changed'};
  const s=r.original,expected={x:s.x*scale+offset.x,y:s.y*scale+offset.y,w:s.w*scale,h:s.h*scale};if(!same(box(o),expected))return {status:'unavailable',reason:'source-transform-changed'};
  for(const lower of state.objects.slice(0,proof.index)){if(lower.visible===false||isVerifiedBase?.(lower)===true)continue;return {status:'unavailable',reason:'unverified-lower-layer'};}
  for(const upper of state.objects.slice(proof.index+1)){if(upper.visible===false)continue;if(upper.group||upper.clipPath||upper.shadow||upper.filters?.length||(upper.globalCompositeOperation&&upper.globalCompositeOperation!=='source-over'))return {status:'unavailable',reason:'foreground-effects-unknown'};if((upper.outsideRecovery||upper.outsideRecoveryReview||upper.__outsideRenderInstalled||upper.trialOutsideRestore||upper.__outsideTrialVisible||Object.hasOwn(upper,'_render'))&&isVerifiedOutside?.(upper)!==true)return {status:'unavailable',reason:'foreground-outside-unknown'};}
  const crop=r.inset,k=Math.max(width/crop.width,height/crop.height);if(!Number.isFinite(k)||k<=0)return {status:'unavailable',reason:'invalid-cover'};
  return {status:'review',insertAfter:o,element:r.el,cropX:crop.inset,cropY:crop.inset,width:crop.width,height:crop.height,sourceWidth:r.w,sourceHeight:r.h,scale:k,left:(width-crop.width*k)/2,top:(height-crop.height*k)/2,inset:crop.inset,
   warning:'확인한 독립 배경을 비율을 유지해 화면에 맞춘 후보입니다. 배경의 가장자리가 잘리고 원래 배경 배치가 달라질 수 있습니다. 상품·글씨와 결과를 확인하세요.'};
 }
 function advance(proof,oldRevision,newRevision){const r=records.get(proof?.object);if(!r||r!==proof.record||r.generation!==generation||r.revision!==oldRevision||!Number.isSafeInteger(newRevision)||newRevision!==oldRevision+1)return false;r.revision=newRevision;return true;}
 return {confirm,capture,plan,advance,invalidate};
}
