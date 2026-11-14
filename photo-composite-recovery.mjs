import {installPhotoCompositeGuard,hasPhotoCompositeGuard,unsafePhotoSourceRenderer,authorizePhotoCompositeExtension} from './photo-composite-render.mjs';

// Serialized role names and group ids do not prove pixel ownership. Reopened
// projects may recover the live renderer only after every pixel is checked.
export function verifyPhotoPartition(source,background,foreground){
 if(!source||!background||!foreground||source.length!==background.length||source.length!==foreground.length||source.length%4)return false;
 for(let i=0;i<source.length;i+=4){
  const a=source[i+3],b=background[i+3],f=foreground[i+3];
  if(!a){if(b||f)return false;continue;}
  if((b===a&&f===0)===(f===a&&b===0))return false;
  const chosen=b?background:foreground;
  if(chosen[i]!==source[i]||chosen[i+1]!==source[i+1]||chosen[i+2]!==source[i+2])return false;
 }
 return true;
}

// A failed pixel check is cached only for those exact loaded images. Temporary
// geometry mismatch is never cached: moving a part back can permit recovery.
const tried=new WeakMap();
function signature(objects){try{return objects.flatMap(o=>[o.getElement(),o.getSrc(),o.width,o.height]);}catch{return null;}}
function sameSignature(a,b){return !!a&&!!b&&a.length===b.length&&a.every((v,i)=>v===b[i]);}
const closePosition=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-5;
const closeCoefficient=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.min(1e-6,1e-9*Math.max(1,Math.abs(a),Math.abs(b)));
// Derive the embedded source frame from the actual Fabric transforms; never
// accept an x/y/crop claim from serialized metadata as proof.
export function inferPhotoFrame(source,background,foreground){
 try{
  const s=source.calcTransformMatrix(),b=background.calcTransformMatrix(),f=foreground.calcTransformMatrix();
  if(!Array.isArray(s)||!Array.isArray(b)||!Array.isArray(f)||s.length!==6||b.length!==6||f.length!==6||
   !s.every((n,i)=>(i<4?closeCoefficient:closePosition)(n,f[i]))||!s.slice(0,4).every((n,i)=>closeCoefficient(n,b[i])))return null;
  const det=b[0]*b[3]-b[1]*b[2];if(!Number.isFinite(det)||Math.abs(det)<1e-12)return null;
  const wx=s[4]-b[4],wy=s[5]-b[5],dx=(b[3]*wx-b[2]*wy)/det,dy=(-b[1]*wx+b[0]*wy)/det;
  const fx=dx+background.width/2-source.width/2,fy=dy+background.height/2-source.height/2,x=Math.round(fx),y=Math.round(fy);
  if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||Math.abs(fx-x)>1e-5||Math.abs(fy-y)>1e-5||x<0||y<0||
    x+source.width>background.width||y+source.height>background.height)return null;
  return {x,y,width:background.width,height:background.height};
 }catch{return null;}
}
export function verifyExtendedPhotoPartition(source,background,foreground,w,h,frame){
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||!frame||
   ![frame.x,frame.y,frame.width,frame.height].every(Number.isSafeInteger)||frame.x<0||frame.y<0||
   frame.x+w>frame.width||frame.y+h>frame.height||frame.width*frame.height>8000000||
   source?.length!==w*h*4||foreground?.length!==source.length||background?.length!==frame.width*frame.height*4)return false;
 for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++){
  const j=(y*frame.width+x)*4,inside=x>=frame.x&&x<frame.x+w&&y>=frame.y&&y<frame.y+h;
  if(!inside){if(background[j+3]!==255)return false;continue;}
  const i=((y-frame.y)*w+x-frame.x)*4,a=source[i+3],b=background[j+3],f=foreground[i+3];
  if(!a){if(b||f)return false;continue;}
  if((b===a&&f===0)===(f===a&&b===0))return false;
  const owner=b?background:foreground,k=b?j:i;
  if(owner[k]!==source[i]||owner[k+1]!==source[i+1]||owner[k+2]!==source[i+2])return false;
 }
 return true;
}
function pixels(o,w,h){
 const c=document.createElement('canvas');c.width=w;c.height=h;
 try{const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Canvas unavailable');ctx.drawImage(o.getElement(),0,0,w,h);return ctx.getImageData(0,0,w,h).data;}
 finally{c.width=c.height=0;}
}
function exactImageSize(o,w,h){const e=o.getElement?.();return !!e&&String(e.tagName||'').toUpperCase()==='IMG'&&(e.naturalWidth||e.width)===w&&(e.naturalHeight||e.height)===h;}
export function recoverPhotoCompositeGuards(api){
 const state=api?.read?.(),objects=state?.objects;if(!state||!Array.isArray(objects))return 0;
 const canvas=objects.find(o=>o.canvas)?.canvas;if(!canvas)return 0;let restored=0;
 for(let i=0;i+2<objects.length;i++){
  const [source,bg,fg]=objects.slice(i,i+3),group=source.photoInstanceGroup;
  if(!group||hasPhotoCompositeGuard(bg)||source.photoInstanceKind!=='source'||bg.photoInstanceKind!=='background'||fg.photoInstanceKind!=='part'||
   bg.photoInstanceGroup!==group||fg.photoInstanceGroup!==group||bg.cutoutMethod!=='photo-ai-residual-background'||fg.cutoutMethod!=='photo-ai-estimated-part'||
   source.visible!==false||!source.layerLocked||unsafePhotoSourceRenderer(source)||!source.originalPhotoSource||!Number.isSafeInteger(source.width)||!Number.isSafeInteger(source.height)||
   source.width<1||source.height<1||source.width*source.height>4000000||!Number.isSafeInteger(bg.width)||!Number.isSafeInteger(bg.height)||bg.width<source.width||bg.height<source.height||bg.width*bg.height>8000000||fg.width!==source.width||fg.height!==source.height||
   !exactImageSize(source,source.width,source.height)||!exactImageSize(fg,source.width,source.height)||!exactImageSize(bg,bg.width,bg.height)||
   objects.filter(o=>o.photoInstanceGroup===group).length!==3)continue;
  try{
   const expanded=bg.width!==source.width||bg.height!==source.height;
   const frame=expanded?inferPhotoFrame(source,bg,fg):null;if(expanded&&!frame)continue;
   const key=signature([source,bg,fg]);if(!key)continue;if(frame)key.push(frame.x,frame.y);if(sameSignature(tried.get(bg),key))continue;
   const s=pixels(source,source.width,source.height),b=pixels(bg,bg.width,bg.height),f=pixels(fg,source.width,source.height);
   const valid=expanded?verifyExtendedPhotoPartition(s,b,f,source.width,source.height,frame):verifyPhotoPartition(s,b,f);
   // Only a completed, negative pixel comparison is remembered. Temporary
   // position, decoding or canvas errors must remain eligible for retry.
   if(!valid){tried.set(bg,key);continue;}
   if(valid){
    const element=bg.getElement();const release=installPhotoCompositeGuard({canvas,source,background:bg,foreground:fg,group});
    if(!hasPhotoCompositeGuard(bg))continue;
    if(expanded&&!authorizePhotoCompositeExtension({background:bg,originalElement:element,element,...frame})){release();continue;}
    restored++;
   }
  }catch{/* Safe fallback: render each actual editable layer normally. */}
 }
 if(restored)canvas.requestRenderAll?.();return restored;
}

export function installPhotoCompositeRecovery(api){
 let timer=null;const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>{timer=null;recoverPhotoCompositeGuards(api());},0);};
 for(const name of ['coex:history-source','coex:layer-edit'])window.addEventListener(name,schedule);
}
