import {extendPhotoBackground} from './photo-background-extension.mjs';

// Pure planning for a *reviewed* partial photo. This module does not mutate a
// Fabric scene or grant authority from serialized fields. The integrating
// editor must hold the photo and mask in a current-session capability, and
// insert each resulting transparent patch immediately below that photo.
const validBox=b=>!!b&&[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0;
const intersect=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const close=(a,b)=>Math.abs(a-b)<=0.05;
const finiteSize=(w,h)=>Number.isSafeInteger(w)&&Number.isSafeInteger(h)&&w>0&&h>0&&w<=12000&&h<=12000;
const dirs=new Set(['left','right','top','bottom']);

// The image may occupy only a *band* of the source design. Horizontal
// extensions are restricted to its original y-range; vertical extensions to
// its original x-range. A source-over patch may never paint inside the source
// slide frame or cover an unrelated lower layer. Later layers remain above it.
export function planPartialPhotoExtension({photo,sourceWidth,sourceHeight,targetWidth,targetHeight,scale,offset,layers,directions=['left','right','top','bottom'],isTrustedPhoto,isVerifiedBase}){
 if(!photo||typeof isTrustedPhoto!=='function'||!isTrustedPhoto(photo)||!finiteSize(sourceWidth,sourceHeight)||!finiteSize(targetWidth,targetHeight)||
   !Number.isFinite(scale)||scale<=0||!offset||![offset.x,offset.y].every(Number.isFinite)||!Array.isArray(layers)||
   !Array.isArray(directions)||directions.some(d=>!dirs.has(d))||new Set(directions).size!==directions.length)return {status:'unavailable',reason:'invalid-or-untrusted'};
 const {sourceBox:s,outputBox:o,object,paintIndex,sourcePixelsWidth:pw,sourcePixelsHeight:ph}=photo;
 if(!object||!validBox(s)||!validBox(o)||!Number.isInteger(paintIndex)||layers[paintIndex]?.object!==(photo.insertBefore||object)||
   !finiteSize(pw,ph)||pw*ph>2000000||photo.axisAligned!==true||photo.opacity!==1||photo.composite!=='source-over'||photo.hasEffects!==false||
   ![close(o.x,s.x*scale+offset.x),close(o.y,s.y*scale+offset.y),close(o.width,s.width*scale),close(o.height,s.height*scale)].every(Boolean)||
   o.x<0||o.y<0||o.x+o.width>targetWidth||o.y+o.height>targetHeight)return {status:'unavailable',reason:'unsupported-geometry'};
 const sourceFrame={x:offset.x,y:offset.y,width:sourceWidth*scale,height:sourceHeight*scale};
 if(!validBox(sourceFrame))return {status:'unavailable',reason:'invalid-frame'};
 const bx=Math.max(0.5,sourceWidth*.0025),by=Math.max(0.5,sourceHeight*.0025);
 if(s.x < -bx||s.y < -by||s.x+s.width>sourceWidth+bx||s.y+s.height>sourceHeight+by)return {status:'unavailable',reason:'source-outside-frame'};
 // Require coverage, not a guess that an inset photo is a background. This
 // rejects off-frame decorations and does not create unverified interior fill.
 const tol=Math.max(.01,Math.min(sourceWidth,sourceHeight)*.00001);
 // Allow only floating-point representation noise, not an actual inset into
 // the source frame: the new patch must remain strictly outside that frame.
 const rounding=1e-7;
 const horizontal=s.x<=tol&&s.x+s.width>=sourceWidth-tol&&o.x<=sourceFrame.x+rounding&&o.x+o.width>=sourceFrame.x+sourceFrame.width-rounding;
 const vertical=s.y<=tol&&s.y+s.height>=sourceHeight-tol&&o.y<=sourceFrame.y+rounding&&o.y+o.height>=sourceFrame.y+sourceFrame.height-rounding;
 const candidates={left:horizontal?{x:0,y:o.y,width:o.x,height:o.height}:null,
  right:horizontal?{x:o.x+o.width,y:o.y,width:targetWidth-o.x-o.width,height:o.height}:null,
  top:vertical?{x:o.x,y:0,width:o.width,height:o.y}:null,
  bottom:vertical?{x:o.x,y:o.y+o.height,width:o.width,height:targetHeight-o.y-o.height}:null};
 const plans=[],blocked=[];
 for(const side of directions){
  const rect=candidates[side];if(!rect||rect.width<=0||rect.height<=0){blocked.push({side,reason:'no-verified-margin'});continue;}
  // An unknown lower object's extent/effects cannot be safely excluded.
  let reason=null;
  for(let i=0;i<paintIndex;i++){
   const layer=layers[i];if(!layer||layer.visible===false)continue;
   if(typeof isVerifiedBase==='function'&&isVerifiedBase(layer,photo))continue;
   if(!validBox(layer.box)||layer.hasEffects!==false||layer.group===true){reason='lower-layer-unknown';break;}
   if(intersect(rect,layer.box)){reason='would-cover-lower-layer';break;}
  }
  if(reason){blocked.push({side,reason});continue;}
  const sx=o.width/pw,sy=o.height/ph;
  const count=Math.ceil((side==='left'||side==='right'?rect.width/sx:rect.height/sy)-1e-10);
  if(!Number.isSafeInteger(count)||count<1){blocked.push({side,reason:'no-verified-margin'});continue;}
  const w=pw+(side==='left'||side==='right'?count:0),h=ph+(side==='top'||side==='bottom'?count:0);
  if(!finiteSize(w,h)||w*h>8000000){blocked.push({side,reason:'size-budget'});continue;}
  const localFrame={x:side==='left'?count:0,y:side==='top'?count:0,width:pw,height:ph};
  const placement={left:o.x-localFrame.x*sx,top:o.y-localFrame.y*sy,scaleX:sx,scaleY:sy};
  plans.push({side,rect:{...rect},localFrame,width:w,height:h,placement,object,pw,ph});
 }
 return {status:plans.length?'review':'unavailable',reason:plans.length?'candidate':'no-safe-side',plans,blocked,
  warning:'사진 가장자리를 반사해 새 여백만 채우는 후보입니다. 반복과 이음, 가려진 영역을 확인하세요.'};
}

// Produces transparent pixels throughout the original image frame. Each side
// is independently checked: a subject touching the left edge must not prevent
// a safe right-edge proposal, nor may it be reflected to the left.
export async function preparePartialPhotoSide(plan,{pixels,foregroundMask,isCurrent,signal}={}){
 if(!plan||typeof isCurrent!=='function'||!isCurrent()||!pixels||!foregroundMask)return {status:'unavailable',reason:'source-changed'};
 const result=await extendPhotoBackground({pixels,width:plan.pw,height:plan.ph,foregroundMask,
  evidence:{kind:'user-reviewed-mask',confirmed:true},targetWidth:plan.width,targetHeight:plan.height,frame:plan.localFrame,signal});
 if(signal?.aborted)return {status:'cancelled',reason:'cancelled'};
 if(!isCurrent())return {status:'unavailable',reason:'source-changed'};
 if(result.status!=='review')return result;
 return {status:'review',side:plan.side,pixels:result.pixels,width:result.width,height:result.height,
  placement:{...plan.placement},clip:{...plan.rect},object:plan.object,warning:result.warning};
}
