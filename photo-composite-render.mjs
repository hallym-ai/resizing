// When an AI split is still exactly aligned, draw the immutable source once.
// Independently resampling the two transparent halves introduces colour seams
// at their boundary even though they partitioned the original pixels exactly.
// This capability exists only on the live objects created by the transaction.
// Unknown, edited, reopened or independently reordered objects fail closed.
const NOOP=()=>{};
const registrations=new WeakMap();
export function hasPhotoCompositeGuard(background){return registrations.has(background);}
export function photoCompositeMode(background){return registrations.get(background)?.mode?.()?.kind||'independent';}
// Positions and sizes use a small absolute tolerance even at enormous canvas
// coordinates. A relative tolerance there could conceal a visible movement.
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-6;
const closePosition=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-5;
const closeCoefficient=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.min(1e-6,1e-9*Math.max(1,Math.abs(a),Math.abs(b)));
const sameMatrix=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===6&&b.length===6&&a.every((n,i)=>(i<4?closeCoefficient:closePosition)(n,b[i]));
// A restored outside patch can use an object-local renderer. Substituting a
// prototype renderer would silently drop it, even if current pixels match.
function unsafeMetadata(o){return !!o&&(!!o.outsideRecovery||!!o.trialOutsideRestore||!!o.__outsideRenderInstalled||!!o.__outsideTrialVisible||!!o.outsideRecoveryReview);}
export function unsafePhotoSourceRenderer(o){return !!o&&(Object.hasOwn(o,'_render')||unsafeMetadata(o));}
function safeImage(o){
 return !!o&&!o.group&&!o.clipPath&&!o.shadow&&!o.filters?.length&&!o.cropX&&!o.cropY&&
  (!o.globalCompositeOperation||o.globalCompositeOperation==='source-over')&&!(o.stroke&&o.strokeWidth)&&
  !o.textureBackgroundFrame&&typeof o.calcTransformMatrix==='function'&&typeof o.getElement==='function'&&typeof o.getSrc==='function';
}
function sourceKey(o){try{return o.getSrc();}catch{return null;}}
// Only a live, already verified extension plan may register its source frame.
// This cannot be restored from arbitrary project JSON or claimed by role names.
export function authorizePhotoCompositeExtension({background,originalElement,element,x,y,width,height}){
 const entry=registrations.get(background);
 if(!entry||entry.originalElement!==originalElement||!element||String(element.tagName||'').toUpperCase()!=='IMG'||
  ![x,y,width,height].every(Number.isSafeInteger)||x<0||y<0||width<1||height<1||
  x+entry.source.width>width||y+entry.source.height>height)return false;
 const src=element.currentSrc||element.src;if(typeof src!=='string'||!src)return false;
 entry.extensions.set(element,{x,y,width,height,src});return true;
}
export function installPhotoCompositeGuard({canvas,source,background,foreground,group}){
 if(!canvas||!source||unsafePhotoSourceRenderer(source)||!background||unsafePhotoSourceRenderer(background)||!foreground||unsafePhotoSourceRenderer(foreground)||!group||typeof canvas.getObjects!=='function'||
  !safeImage(source)||!safeImage(background)||!safeImage(foreground)||
  typeof background._render!=='function'||typeof foreground._render!=='function')return NOOP;
 const elements=[source,background,foreground].map(o=>o.getElement()),keys=[source,background,foreground].map(sourceKey);
 // Canvas elements can change pixels without changing identity; only images with
 // a stable source are eligible for the exact composite shortcut.
 if(elements.some(e=>!e||String(e.tagName||'').toUpperCase()!=='IMG')||keys.some(k=>typeof k!=='string'||!k))return NOOP;
 const backgroundRender=background._render,foregroundRender=foreground._render;
 const entry={source,originalElement:elements[1],extensions:new WeakMap()};registrations.set(background,entry);
 const eligible=()=>{
  try{
   const objects=canvas.getObjects(),at=objects.indexOf(source);
   if(at<0||objects[at+1]!==background||objects[at+2]!==foreground||
    source.canvas!==canvas||background.canvas!==canvas||foreground.canvas!==canvas||
    source.visible!==false||!source.layerLocked||unsafePhotoSourceRenderer(source)||unsafeMetadata(background)||unsafeMetadata(foreground)||
    background._render!==renderBackground||foreground._render!==renderForeground||background.visible===false||foreground.visible===false||
    ![source,background,foreground].every(safeImage)||
    [source,foreground].some((o,i)=>o.getElement()!==elements[i===0?0:2]||sourceKey(o)!==keys[i===0?0:2])||
    [source,background,foreground].some(o=>o.photoInstanceGroup!==group)||
    source.photoInstanceKind!=='source'||background.photoInstanceKind!=='background'||foreground.photoInstanceKind!=='part'||
    background.cutoutMethod!=='photo-ai-residual-background'||
    foreground.cutoutMethod!=='photo-ai-estimated-part'||!source.originalPhotoSource||
    !close(foreground.width,source.width)||!close(foreground.height,source.height)||
    ![background,foreground].every(o=>close(o.opacity??1,source.opacity??1)))return null;
   const matrix=source.calcTransformMatrix(),bgMatrix=background.calcTransformMatrix();
   if(!sameMatrix(matrix,foreground.calcTransformMatrix()))return null;
   if(background.getElement()===elements[1]&&sourceKey(background)===keys[1]&&
      close(background.width,source.width)&&close(background.height,source.height)&&sameMatrix(matrix,bgMatrix))return {kind:'original'};
   const currentElement=background.getElement(),frame=entry.extensions.get(currentElement);
   if(!frame||(currentElement.currentSrc||currentElement.src)!==frame.src||sourceKey(background)!==frame.src||!close(background.width,frame.width)||!close(background.height,frame.height)||
      !matrix.slice(0,4).every((v,i)=>closeCoefficient(v,bgMatrix[i])))return null;
   const dx=frame.x+source.width/2-frame.width/2,dy=frame.y+source.height/2-frame.height/2;
   if(!closePosition(matrix[4],bgMatrix[4]+bgMatrix[0]*dx+bgMatrix[2]*dy)||!closePosition(matrix[5],bgMatrix[5]+bgMatrix[1]*dx+bgMatrix[3]*dy))return null;
   return {kind:'extended',dx,dy};
  }catch{return false;}
 };
 entry.mode=eligible;
 // Fabric renders objects separately into pixelFindContext for hit testing.
 // Keep the real halves there so either layer can still be selected.
 const hit=ctx=>ctx===canvas.pixelFindContext;
 const renderBackground=function(ctx){
  const plan=!hit(ctx)&&eligible();if(!plan)return backgroundRender.call(this,ctx);
  if(plan.kind==='original')return backgroundRender.call(source,ctx);
  // Paint only the outside extension. Draw the original photo once inside its
  // frame so the subject/background boundary is resampled a single time.
  ctx.save();try{ctx.beginPath();ctx.rect(-background.width/2,-background.height/2,background.width,background.height);ctx.rect(plan.dx-source.width/2,plan.dy-source.height/2,source.width,source.height);ctx.clip('evenodd');backgroundRender.call(background,ctx);}finally{ctx.restore();}
  ctx.save();try{ctx.translate(plan.dx,plan.dy);return backgroundRender.call(source,ctx);}finally{ctx.restore();}
 };
 const renderForeground=function(ctx){if(!hit(ctx)&&eligible())return;return foregroundRender.call(this,ctx);};
 background._render=renderBackground;foreground._render=renderForeground;
 return ()=>{if(registrations.get(background)===entry)registrations.delete(background);if(background._render===renderBackground)delete background._render;if(foreground._render===renderForeground)delete foreground._render;};
}
