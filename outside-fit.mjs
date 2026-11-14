// Scratch trial only. Candidates are deliberately subject to the same source
// and rendering restrictions as the existing outside restoration renderer.
const cache = new WeakMap();
const finite = (...values) => values.every(Number.isFinite);
function alphaBounds(image, width, height) {
  const old = cache.get(image);
  if (old && old.width === width && old.height === height) return old.bounds;
  const canvas = document.createElement('canvas');
  try {
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let left=width, top=height, right=0, bottom=0;
    for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
      if (pixels[(y*width+x)*4+3] !== 0) {
        left=Math.min(left,x); top=Math.min(top,y);
        right=Math.max(right,x+1); bottom=Math.max(bottom,y+1);
      }
    }
    const bounds=right>left && bottom>top ? {left,top,right,bottom} : null;
    cache.set(image,{width,height,bounds});
    return bounds;
  } finally { canvas.width=canvas.height=0; }
}

// Output is measured in current scene coordinates; applies the same affine
// scaling to every foreground item. It never moves individual decorations.
export function outsideFitBounds(state,{foreground=state.objects,outputWidth=state.width,outputHeight=state.height,frame={x:0,y:0,w:state.width,h:state.height}}={}) {
  const boxes=[], skipped=[], notes=[];
  let budget=8_000_000;
  if (globalThis.coexDisableOutsideTrial) return {boxes,skipped,notes};
  const foregroundSet=new Set(foreground.map(v=>v.object||v));
  const validFrame=finite(frame.x,frame.y,frame.w,frame.h,outputWidth,outputHeight)&&frame.w>0&&frame.h>0&&outputWidth>0&&outputHeight>0;
  const outputSupported=validFrame&&outputWidth*outputHeight<=24_000_000;
  const sceneCanvas=state.objects.find(o=>o.canvas)?.canvas?.lowerCanvasEl;
  const previewSupported=!sceneCanvas||sceneCanvas.width*sceneCanvas.height<=24_000_000;
  // Saved projects validate source/image structure but are not authenticated:
  // review is mandatory and a corrupt or forged outer patch is not proof.
  if(state.sourceFormat==='json')notes.push('저장된 프로젝트의 바깥 연결 원본은 독립적으로 인증되지 않았습니다.');
  for (const o of state.objects) {
    const m=o.trialOutsideRestore, image=o.__outsideTrialImage;
    if (!m || o.visible===false) continue;
    const b=m.original, p=m.outer, id=o.sourceElementId||o.layerName||'';
    if(!foregroundSet.has(o)){skipped.push({id,reason:'background'});continue;}
    if(!outputSupported||!previewSupported){skipped.push({id,reason:'render-limit'});continue;}
    if(!['pptx','json'].includes(state.sourceFormat)){skipped.push({id,reason:'unsupported-format'});continue;}
    const invalid=!b||!p||!image||!o.__outsideRenderInstalled||
      !o.__outsideBaseElement||o.getElement?.()!==o.__outsideBaseElement||
      o.getSrc?.()!==o.__outsideBaseSource||o.width!==b.width||o.height!==b.height||
      typeof p.src!=='string'||(image.currentSrc||image.src)!==p.src||
      (o.cropX??0)!==b.cropX||(o.cropY??0)!==b.cropY||
      o.group||o.clipPath||o.shadow||o.filters?.length||o.angle||o.flipX||o.flipY||o.skewX||o.skewY||
      (o.globalCompositeOperation&&o.globalCompositeOperation!=='source-over')||
      o.originX!=='left'||o.originY!=='top'||
      !finite(b.left,b.top,b.scaleX,b.scaleY,p.left,p.top,p.width,p.height)||
      b.scaleX<=0||b.scaleY<=0||!Number.isInteger(p.width)||!Number.isInteger(p.height)||
      p.width<=0||p.height<=0||p.width*p.height>4_000_000||
      image.naturalWidth!==p.width||image.naturalHeight!==p.height||
      p.width*p.height>budget;
    if(invalid){skipped.push({id,reason:'unsupported-or-budget'});continue;}
    budget-=p.width*p.height;
    let alpha; try { alpha=alphaBounds(image,p.width,p.height); } catch { skipped.push({id,reason:'pixel-read'});continue; }
    if(!alpha){skipped.push({id,reason:'empty'});continue;}
    const matrix=o.calcTransformMatrix?.();
    if(!matrix||matrix.length!==6||!finite(...matrix)||Math.abs(matrix[1])>1e-8||Math.abs(matrix[2])>1e-8||matrix[0]<=0||matrix[3]<=0){skipped.push({id,reason:'transform'});continue;}
    const ox=(p.left-b.left)/b.scaleX-o.width/2, oy=(p.top-b.top)/b.scaleY-o.height/2;
    const left=matrix[0]*(ox+alpha.left)+matrix[4], top=matrix[3]*(oy+alpha.top)+matrix[5];
    const right=matrix[0]*(ox+alpha.right)+matrix[4], bottom=matrix[3]*(oy+alpha.bottom)+matrix[5];
    if(!finite(left,top,right,bottom)||right<=left||bottom<=top){skipped.push({id,reason:'geometry'});continue;}
    // Restored original decorations can extend outside the source, but extreme
    // coordinates (including forged project metadata) must not silently shrink
    // the whole composition. A reasonable candidate can still need review.
    const maxX=frame.w*.40+2,maxY=frame.h*.40+2;
    if(left<frame.x-maxX||right>frame.x+frame.w+maxX||top<frame.y-maxY||bottom>frame.y+frame.h+maxY){skipped.push({id,reason:'outside-range'});continue;}
    boxes.push({left,top,width:right-left,height:bottom-top,id});
    if(o.layerLocked)notes.push('잠긴 요소도 문서 전체의 균등 크기 조절에는 함께 포함됩니다.');
  }
  return {boxes,skipped,notes:[...new Set(notes)]};
}

// JSON does not authenticate metadata. Cross-check every available restored
// object and reject ambiguous/moved scenes; never turn that into provenance.
// The recovered frame is a geometric hint only and requires visual review.
export function inferOutsideOriginalFrame(state,{foreground,fit}) {
  if(state.sourceFormat!=='json')return {frame:null,reason:'not-json'};
  if(!fit||fit.skipped.length||fit.boxes.length<2)return {frame:null,reason:'insufficient-or-skipped'};
  const eligible=foreground.map(v=>v.object||v).filter(o=>o.visible!==false&&o.trialOutsideRestore);
  if(eligible.length!==fit.boxes.length)return {frame:null,reason:'inconsistent-candidates'};
  const ids=eligible.map(o=>o.sourceElementId);
  if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)return {frame:null,reason:'duplicate-id'};
  let result=null,slideWidth=0,slideHeight=0;
  for(const o of eligible){
    const metadata=o.trialOutsideRestore,b=metadata.original,s=metadata.slide,m=o.calcTransformMatrix?.();
    if(!b||!s||!m||m.length!==6||!finite(b.left,b.top,b.width,b.height,b.scaleX,b.scaleY,s.width,s.height,...m)||
       b.scaleX<=0||b.scaleY<=0||s.width<=0||s.height<=0||Math.abs(m[1])>1e-8||Math.abs(m[2])>1e-8)return {frame:null,reason:'invalid-transform'};
    const sx=m[0]/b.scaleX,sy=m[3]/b.scaleY;
    if(sx<=0||sy<=0||Math.abs(sx-sy)>Math.max(1e-6,Math.max(sx,sy)*.0001))return {frame:null,reason:'nonuniform-transform'};
    const candidate={x:m[4]-sx*(b.left+b.width*b.scaleX/2),y:m[5]-sy*(b.top+b.height*b.scaleY/2),w:s.width*sx,h:s.height*sy};
    if(!finite(candidate.x,candidate.y,candidate.w,candidate.h)||candidate.w<=0||candidate.h<=0)return {frame:null,reason:'invalid-frame'};
    if(!result){result=candidate;slideWidth=s.width;slideHeight=s.height;continue;}
    if(s.width!==slideWidth||s.height!==slideHeight)return {frame:null,reason:'inconsistent-slide'};
    const tolerance=Math.max(2,state.width*.001,state.height*.001);
    if(['x','y','w','h'].some(k=>Math.abs(candidate[k]-result[k])>tolerance))return {frame:null,reason:'objects-moved'};
  }
  const tolerance=Math.max(2,state.width*.002,state.height*.002);
  if(result.x < -tolerance || result.y < -tolerance || result.x+result.w > state.width+tolerance || result.y+result.h > state.height+tolerance || result.w < state.width*.02 || result.h < state.height*.02)return {frame:null,reason:'frame-outside-scene'};
  return {frame:result,reason:'cross-checked-untrusted-json'};
}
