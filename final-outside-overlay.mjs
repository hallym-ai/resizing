// Scratch prototype, not runtime-tested: preserve the visible source frame,
// then composite verified local PPTX outside candidates over the new space.
// Trust is an in-memory object capability, never metadata loaded from JSON.
const sessions=new WeakMap();
const finite=(...v)=>v.every(Number.isFinite);
const fields=(m)=>{const b=m?.original,p=m?.outer,s=m?.slide;return m&&b&&p&&s?[m.baseSourceDigest,b.left,b.top,b.width,b.height,b.scaleX,b.scaleY,b.cropX,b.cropY,p.src,p.left,p.top,p.width,p.height,s.width,s.height]:null;};
const sameFields=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));

function anchorValid(r){
 const o=r.ref,canvas=r.canvas,el=o?.getElement?.();
 if(r.revoked||!canvas.getObjects?.().includes(o)||String(o.type).toLowerCase()!=='image'||
    o.visible!==false||o.layerLocked!==true||o.selectable!==false||o.layerRole!=='background'||
    el!==r.element||o.getSrc?.()!==r.src||o.width!==r.w||o.height!==r.h||
    o.group||o.clipPath||o.shadow||o.filters?.length||o.angle||o.flipX||o.flipY||o.skewX||o.skewY||(o.stroke&&o.strokeWidth)||
    (o.cropX??0)!==0||(o.cropY??0)!==0||(o.opacity??1)!==1||
    (o.globalCompositeOperation&&o.globalCompositeOperation!=='source-over'))return false;
 const m=o.calcTransformMatrix?.();
 return !!m&&m.length===6&&finite(...m)&&Math.abs(m[1])<1e-8&&Math.abs(m[2])<1e-8&&m[0]>0&&m[3]>0&&
   Math.abs(m[0]-m[3])<=Math.max(1e-6,Math.max(m[0],m[3])*.0001);
}
function anchorFrame(r){
 if(!anchorValid(r))return null;
 const m=r.ref.calcTransformMatrix(),frame={x:m[4]-m[0]*r.w/2,y:m[5]-m[3]*r.h/2,w:m[0]*r.w,h:m[3]*r.h};
 return finite(frame.x,frame.y,frame.w,frame.h)&&frame.w>0&&frame.h>0?frame:null;
}
export function hasTrustedOutsideReference(canvas){const r=canvas&&sessions.get(canvas);return !!r&&anchorValid(r);}
export function hasTrustedOutsideCandidate(o){const r=o?.canvas&&sessions.get(o.canvas);return !!r&&anchorValid(r)&&!!candidate(o,r);}
function release(r){
 if(!r||r.revoked)return;r.revoked=true;
 if(sessions.get(r.canvas)===r)sessions.delete(r.canvas);
 r.canvas.off?.('object:modified',r.onObjectModified);
 window.removeEventListener('coex:layer-edit',r.onLayerEdit);
 if(r.canvas._renderOverlay===r.wrapper){r.canvas._renderOverlay=r.previousOverlay;r.canvas.controlsAboveOverlay=r.previousControls;}
}
function requestRelease(r){
 if(r.releaseQueued)return;r.releaseQueued=true;
 queueMicrotask(()=>{release(r);if(!r.canvas.disposed&&!r.canvas.destroyed)r.canvas.requestRenderAll?.();});
}

// Called once for a freshly imported PPTX scene, before its initial fit and
// before a resize transaction. The native project and the independent hidden
// comparison image must agree exactly. Reloaded/untrusted JSON is not bound.
export function registerTrustedOutsideReference(state,source){
 const d=source?.nativeProject,objects=state?.objects,serialized=d?.scene?.objects;
 if(!state||state.sourceFormat!=='pptx'||state.sceneManual||state.revision!==0||!source||source.sourceFormat!=='pptx'||source.key!==state.sourceKey||
    d?.analysis?.engine!=='pptx-original-objects'||!Array.isArray(objects)||!Array.isArray(serialized)||objects.length!==serialized.length||!objects.length||
    !Number.isSafeInteger(d.width)||!Number.isSafeInteger(d.height)||d.width<=0||d.height<=0||d.width*d.height>24000000)return false;
 const ref=objects[0],expected=serialized[0],canvas=ref?.canvas;
 if(!canvas||typeof canvas._renderOverlay!=='function'||expected?.type!=='Image'||expected.visible!==false||expected.layerLocked!==true||expected.layerRole!=='background'||
    expected.left!==0||expected.top!==0||expected.width!==d.width||expected.height!==d.height||expected.scaleX!==1||expected.scaleY!==1||
    expected.originX!=='left'||expected.originY!=='top'||typeof expected.src!=='string'||!/^data:image\/png;base64,/i.test(expected.src)||
    ref.getSrc?.()!==expected.src||ref.width!==d.width||ref.height!==d.height)return false;
 const old=sessions.get(canvas);if(old)release(old);
 const trusted=new WeakMap();let count=0;
 for(let i=1;i<objects.length;i++){
  const o=objects[i],m=o?.trialOutsideRestore,stored=serialized[i]?.outsideRecovery;
  if(!m||!stored||stored.status!=='unverified'||String(o.sourceElementId||'')!==String(serialized[i].sourceElementId||'')||
     o.getSrc?.()!==serialized[i].src||!sameFields(fields(m),fields(stored))||m.slide.width!==d.width||m.slide.height!==d.height)continue;
  const record={meta:m,original:m.original,outer:m.outer,slide:m.slide,values:fields(m),base:o.getElement?.(),src:o.getSrc?.()};
  if(!record.base||!record.src)continue;
  trusted.set(o,record);count++;
 }
 if(!count)return false;
 const r={canvas,ref,element:ref.getElement?.(),src:ref.getSrc?.(),w:d.width,h:d.height,trusted,epoch:state.epoch,sourceKey:state.sourceKey,revoked:false,releaseQueued:false};
 if(!r.element||!anchorValid(r))return false;
 r.previousOverlay=canvas._renderOverlay;r.previousControls=canvas.controlsAboveOverlay;
 r.wrapper=function(ctx){r.previousOverlay.call(this,ctx);paint(r,ctx);};
 r.onObjectModified=e=>{const t=e?.target;if(t===r.ref||t?.getObjects?.().includes(r.ref))release(r);};
 r.onLayerEdit=()=>{if(!anchorValid(r))release(r);};
 canvas.controlsAboveOverlay=true;canvas._renderOverlay=r.wrapper;
 canvas.on?.('object:modified',r.onObjectModified);window.addEventListener('coex:layer-edit',r.onLayerEdit);sessions.set(canvas,r);
 return true;
}

function candidate(o,r){
 const t=r.trusted.get(o),m=o?.trialOutsideRestore,b=m?.original,p=m?.outer,s=m?.slide,im=o?.__outsideTrialImage,id=String(o?.sourceElementId||'');
 if(!t||!id||!m||!b||!p||!s||!im||!o.__outsideRenderInstalled||m!==t.meta||b!==t.original||p!==t.outer||s!==t.slide||!sameFields(fields(m),t.values)||
    o.getElement?.()!==t.base||o.getSrc?.()!==t.src||o.__outsideBaseElement!==t.base||o.__outsideBaseSource!==t.src||
    typeof p.src!=='string'||(im.currentSrc||im.src)!==p.src||o.width!==b.width||o.height!==b.height||
    (o.cropX??0)!==b.cropX||(o.cropY??0)!==b.cropY||o.originX!=='left'||o.originY!=='top'||
    o.group||o.clipPath||o.shadow||o.filters?.length||o.angle||o.flipX||o.flipY||o.skewX||o.skewY||
    (o.globalCompositeOperation&&o.globalCompositeOperation!=='source-over')||
    !finite(b.left,b.top,b.width,b.height,b.scaleX,b.scaleY,p.left,p.top,p.width,p.height,s.width,s.height,o.opacity??1)||
    b.width<=0||b.height<=0||b.scaleX<=0||b.scaleY<=0||s.width!==r.w||s.height!==r.h||
    !Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<=0||p.height<=0||p.width*p.height>4000000||
    im.naturalWidth!==p.width||im.naturalHeight!==p.height||(o.opacity??1)<0||(o.opacity??1)>1)return null;
 const matrix=o.calcTransformMatrix?.();
 if(!matrix||matrix.length!==6||!finite(...matrix)||Math.abs(matrix[1])>1e-8||Math.abs(matrix[2])>1e-8||matrix[0]<=0||matrix[3]<=0)return null;
 return {o,id,b,p,im,matrix};
}
function markReview(objects,passed){
 let changed=false;
 for(const o of objects){const problem=!passed.has(o);if(!!o.__outsideReview!==problem){o.__outsideReview=problem;changed=true;}}
 if(changed)queueMicrotask(()=>window.dispatchEvent(new Event('coex:outside-recovery-change')));
}
function paint(r,ctx){
 const canvas=r.canvas,objects=canvas.getObjects?.()||[],active=objects.filter(o=>o?.visible!==false&&o.__outsideTrialVisible&&o.trialOutsideRestore);
 if(!anchorValid(r)){markReview(active,new Set());requestRelease(r);return;}
 if(!active.length)return;
 const none=new Set(),frame=anchorFrame(r);
 if(globalThis.coexDisableOutsideTrial||!frame||!ctx||!ctx.canvas||ctx.canvas.width*ctx.canvas.height>24000000||objects.length>200||canvas.clipPath||canvas.overlayImage||canvas.overlayColor){markReview(active,none);return;}
 const all=active.map(o=>candidate(o,r)),counts=new Map();for(const p of all)if(p)counts.set(p.id,(counts.get(p.id)||0)+1);
 const patches=all.filter(p=>p&&counts.get(p.id)===1),passed=new Set(patches.map(p=>p.o));
 if(!patches.length){markReview(active,none);return;}
 const viewport=canvas.viewportTransform;if(!Array.isArray(viewport)||viewport.length!==6||!finite(...viewport)){markReview(active,none);return;}
 // Candidate patches may overlap each other, as in the old final-composite
 // trial. Protect every other foreground's bounding box outside the frame.
 const foreground=objects.filter(o=>o&&o.visible!==false&&o.layerRole!=='background'&&!passed.has(o));
 let ok=false;ctx.save();try{
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.transform(...viewport);const tr=ctx.getTransform();
  if(!tr.is2D||Math.abs(tr.b)>1e-8||Math.abs(tr.c)>1e-8||tr.a<=0||tr.d<=0)return;
  const rect=(x,y,w,h,pad=0)=>{const l=Math.floor(tr.e+tr.a*x-pad),t=Math.floor(tr.f+tr.d*y-pad),rr=Math.ceil(tr.e+tr.a*(x+w)+pad),bb=Math.ceil(tr.f+tr.d*(y+h)+pad);return [l,t,rr-l,bb-t];};
  const l=Math.ceil(tr.e+tr.a*frame.x-.5),t=Math.ceil(tr.f+tr.d*frame.y-.5),right=Math.ceil(tr.e+tr.a*(frame.x+frame.w)-.5),bottom=Math.ceil(tr.f+tr.d*(frame.y+frame.h)-.5);
  ctx.setTransform(1,0,0,1,0,0);
  const subtract=q=>{ctx.beginPath();ctx.rect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.rect(...q);ctx.clip('evenodd');};
  subtract([l,t,right-l,bottom-t]);
  for(const o of foreground){const q=o.getBoundingRect?.();if(!q||!finite(q.left,q.top,q.width,q.height)||q.width<0||q.height<0)return;subtract(rect(q.left,q.top,q.width,q.height,1));}
  ctx.setTransform(tr);
  for(const {o,b,p,im,matrix} of patches){const x=(p.left-b.left)/b.scaleX-o.width/2,y=(p.top-b.top)/b.scaleY-o.height/2;ctx.save();try{ctx.transform(...matrix);ctx.globalAlpha*=o.opacity??1;ctx.drawImage(im,x,y,p.width,p.height);}finally{ctx.restore();}}
  ok=true;
 }catch{}finally{ctx.restore();markReview(active,ok?passed:none);}
}
