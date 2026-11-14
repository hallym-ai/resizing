import {safeStoredImageHeader} from './safe-image-header.mjs';
// Original pixels are kept in the middle of the composite bitmap;
// source metadata is inert until separately verified. Never delete user data.
import {inspectGridCandidate} from './grid-pattern.mjs';
const MAX_PIXELS=4_000_000, MAX_ENCODED=8*1024*1024, MAX_ORIGINAL=8*1024*1024;
// Estimate straight vertical grid lines across the lower opaque portion. Fit
// the fractional spacing across many lines to avoid integer-tile drift.
export function detectVerticalGridPhase({data,width:w,height:h}){
 if(!data||data.length!==w*h*4||w<64||h<64)return null;const vals=[];
 for(let x=0;x<w;x++){let sum=0,n=0;for(let y=Math.floor(h*.58);y<h;y+=2){const i=(y*w+x)*4;if(data[i+3]<245)continue;sum+=(data[i]+data[i+1]+data[i+2])/3;n++;}if(n<Math.max(10,(h-Math.floor(h*.58))*.2))return null;vals.push(sum/n);}
 const lo=Math.min(...vals),hi=Math.max(...vals);if(hi-lo<6)return null;const threshold=lo+(hi-lo)*.42,peaks=[];
 for(let i=0;i<w;){if(vals[i]>threshold){i++;continue;}const from=i;let weight=0,weighted=0;while(i<w&&vals[i]<=threshold){const v=threshold-vals[i]+.01;weighted+=i*v;weight+=v;i++;}if(i-from>Math.max(12,w*.04))return null;peaks.push(weighted/weight);}
 if(peaks.length<7)return null;const mean=(peaks.length-1)/2,average=peaks.reduce((a,b)=>a+b,0)/peaks.length;let a=0,b=0;for(let i=0;i<peaks.length;i++){a+=(i-mean)*(peaks[i]-average);b+=(i-mean)**2;}const period=a/b,origin=average-period*mean;if(!(period>=8&&period<=128))return null;
 if(peaks.some((x,i)=>Math.abs(x-(origin+i*period))>Math.max(1.5,period*.055)))return null;
 // Every line and cell center is a reflection axis; choose the nearest axes
 // strictly inside the source to avoid a malformed source-edge clip.
 const half=period/2,base=origin-Math.floor(origin/half)*half,left=base<.001?0:base,right=base+Math.floor((w-base)/half)*half;
 if(left<0||left>=half+.01||right<0||right>w||w-right>half+.01)return null;return {period,origin,leftAxis:left,rightAxis:right,lineCount:peaks.length};
}
// Fit horizontal grid lines only in the lower portion and require the source
// stripe to be completely opaque; otherwise do not invent a lower extension.
export function detectHorizontalGridPhase({data,width:w,height:h}){
 if(!data||data.length!==w*h*4||w<64||h<64)return null;const vals=[],start=Math.floor(h*.58);
 for(let y=start;y<h;y++){let sum=0,n=0;for(let x=0;x<w;x+=2){const i=(y*w+x)*4;if(data[i+3]!==255)return null;sum+=(data[i]+data[i+1]+data[i+2])/3;n++;}vals.push(sum/n);}
 const lo=Math.min(...vals),hi=Math.max(...vals);if(hi-lo<6)return null;const threshold=lo+(hi-lo)*.42,peaks=[];
 for(let i=0;i<vals.length;){if(vals[i]>threshold){i++;continue;}const from=i;let wt=0,weighted=0;while(i<vals.length&&vals[i]<=threshold){const q=threshold-vals[i]+.01;weighted+=(start+i)*q;wt+=q;i++;}if(i-from>12)return null;peaks.push(weighted/wt);}
 if(peaks.length<4)return null;const mean=(peaks.length-1)/2,avg=peaks.reduce((a,b)=>a+b,0)/peaks.length;let a=0,b=0;for(let i=0;i<peaks.length;i++){a+=(i-mean)*(peaks[i]-avg);b+=(i-mean)**2;}const period=a/b,origin=avg-period*mean;if(!(period>=8&&period<=128)||peaks.some((y,i)=>Math.abs(y-origin-i*period)>Math.max(1.5,period*.055)))return null;
 const half=period/2,base=origin-Math.floor(origin/half)*half,axis=base+Math.floor((h-base)/half)*half;if(axis>h||axis-period<start||h-axis>half+.01)return null;
 for(let y=Math.floor(axis-period)-1;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]!==255)return null;
 return {period,origin,axis,lineCount:peaks.length};
}
export function encodeCompositeGrid({state,object,sourceFrame,targetFrame,pixels,permittedUnderlays=[],makeCanvas,reviewedJson=false}){
 if(!object||object.gridExpansion||typeof makeCanvas!=='function')return null;
 const plan=inspectGridCandidate({state,object,sourceFrame,targetFrame,pixels,permittedUnderlays,reviewedJson});if(!plan)return null;
 const original=object.getSrc?.();if(typeof original!=='string'||original.length>MAX_ORIGINAL||!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(original))return null;
 // Transparency is allowed, but the canvas must reproduce every central RGBA
 // channel exactly after its premultiplied-alpha round trip.
 const phase=detectVerticalGridPhase(pixels);if(!phase)return null;
 const w=object.width,h=object.height,left=Math.max(0,Math.ceil((sourceFrame.left-targetFrame.left)/object.scaleX)),right=Math.max(0,Math.ceil((targetFrame.right-sourceFrame.right)/object.scaleX)),bottom=Math.max(0,Math.ceil((targetFrame.bottom-sourceFrame.bottom)/object.scaleY)),width=left+w+right,height=h+bottom,vertical=bottom?detectHorizontalGridPhase(pixels):null;if(bottom&&!vertical)return null;
 if(![w,h,left,right,bottom,width,height].every(Number.isSafeInteger)||left<0||right<0||bottom<0||(!left&&!right&&!bottom)||width*height>MAX_PIXELS||left>w*32||right>w*32||bottom>h*32)return null;
 let c;try{c=makeCanvas(width,height);if(!c||c.width!==width||c.height!==height)return null;const ctx=c.getContext('2d');if(!ctx)return null;const start=-left,end=w+right;
  // Each reflection uses a fitted grid line or cell center as its axis.
  // Clip each side before painting; the middle is copied exactly below.
  const l=phase.leftAxis,r=phase.rightAxis;
  ctx.save();try{ctx.beginPath();ctx.rect(0,0,left,h);ctx.clip();for(let n=0;n<Math.ceil((left+w)/w)+1;n++){ctx.save();try{if(n%2===0){ctx.translate(2*l-n*w-start,0);ctx.scale(-1,1);}else ctx.translate(2*l-(n+1)*w-start,0);ctx.drawImage(plan.element,0,0,w,h);}finally{ctx.restore();}}}finally{ctx.restore();}
  ctx.save();try{ctx.beginPath();ctx.rect(left+w,0,right,h);ctx.clip();for(let n=0;n<Math.ceil((right+w)/w)+1;n++){ctx.save();try{if(n%2===0){ctx.translate(2*r+n*w-start,0);ctx.scale(-1,1);}else ctx.translate(2*r+(n-1)*w-start,0);ctx.drawImage(plan.element,0,0,w,h);}finally{ctx.restore();}}}finally{ctx.restore();}
  // Blend the torn transparent edge just outside the source. Internal source
  // pixels are never touched; only alpha transitions and formerly transparent
  // color are adjusted. This leaves opaque grid lines unchanged.
  const feather=Math.min(16,left,right);if(feather>0){for(const side of ['left','right']){const startX=side==='left'?left-feather:left+w,patch=ctx.getImageData(startX,0,feather,h),edgeX=side==='left'?0:w-1;for(let y=0;y<h;y++)for(let x=0;x<feather;x++){const i=(y*feather+x)*4,j=(y*w+edgeX)*4,dist=side==='left'?feather-x:x+1,t=dist/feather,t2=t*t*(3-2*t),before=patch.data[i+3],sourceAlpha=pixels.data[j+3],alpha=Math.round(sourceAlpha*(1-t2)+before*t2);if(before===0&&alpha>0&&sourceAlpha>0)for(let q=0;q<3;q++)patch.data[i+q]=pixels.data[j+q];patch.data[i+3]=alpha;}ctx.putImageData(patch,startX,0);}}
  const center=ctx.createImageData(w,h);center.data.set(pixels.data);ctx.putImageData(center,left,0);const verify=ctx.getImageData(left,0,w,h).data;for(let i=0;i<verify.length;i++)if(verify[i]!==pixels.data[i])return null;
  if(bottom){const a=vertical.axis,p=vertical.period,count=Math.ceil((height-a)/p)+1;ctx.save();try{ctx.beginPath();ctx.rect(0,h,width,bottom);ctx.clip();for(let n=0;n<count;n++){ctx.save();try{if(n%2===0){ctx.translate(0,a+n*p+p);ctx.scale(1,-1);ctx.drawImage(c,0,a-p,width,p,0,0,width,p);}else ctx.drawImage(c,0,a-p,width,p,0,a+n*p,width,p);}finally{ctx.restore();}}}finally{ctx.restore();}}
  const composite=c.toDataURL('image/png');if(!composite.startsWith('data:image/png;base64,')||composite.length>MAX_ENCODED)return null;
  return {object,element:plan.element,composite,left,bottom,width,height,phase,vertical,frame:{...sourceFrame},canvasSize:{width:targetFrame.right,height:targetFrame.bottom},source:original,original:{left:object.left,top:object.top,width:w,height:h,scaleX:object.scaleX,scaleY:object.scaleY},warning:'반복 무늬를 추정해 '+(bottom?(left||right?'좌우와 아래':'아래'):'좌우')+'를 연결했습니다. 이미지 안 글씨·로고와 경계를 확인하세요.'};
 }catch{return null;}finally{if(c){c.width=0;c.height=0;}}
}
// Only a scene-owner transaction may call this after validating current epoch,
// source, scene signature, decoded image dimensions and project size.
export function applyCompositeGrid(plan,decoded){const o=plan?.object,g=plan?.original;if(!o||!decoded||o.getElement?.()!==plan.element||o.getSrc?.()!==plan.source||o.gridExpansion||o.left!==g.left||o.top!==g.top||o.width!==g.width||o.height!==g.height||o.scaleX!==g.scaleX||o.scaleY!==g.scaleY||decoded.naturalWidth!==plan.width||decoded.naturalHeight!==plan.height)return false;
 o.setElement(decoded);o.set({left:g.left-plan.left*g.scaleX,top:g.top,width:plan.width,height:plan.height,scaleX:g.scaleX,scaleY:g.scaleY,gridExpansion:{version:1,source:plan.source,original:g,left:plan.left,bottom:plan.bottom,frame:plan.frame,canvasSize:plan.canvasSize}});o.setCoords();return true;}

// Reconstruct the complete old bitmap from its original asset and compare the
// resulting PNG byte-for-byte before allowing an ephemeral original restore.
// Metadata alone never grants permission to discard the current composite.
export async function verifyExpandedGrid({state,object,permittedUnderlays=[],makeCanvas,decode,isCurrent}){
 const trace=globalThis.coexGridVerifyTrace={stage:'precondition'};const m=object?.gridExpansion,g=m?.original,f=m?.frame,size=m?.canvasSize,oldSrc=object?.getSrc?.(),oldEl=object?.getElement?.();if(!m||!g||!f||!size||object.gridSourceUserEdited||object.layerLocked||object.layerRole!=='subject'||object.layerRoleInferred!==true||object.layoutManualRole||object.layoutManualGroup||object.group||object.clipPath||object.shadow||object.filters?.length||object.angle||object.skewX||object.skewY||object.flipX||object.flipY||object.cropX||object.cropY||(object.opacity??1)!==1||typeof isCurrent!=='function'||typeof decode!=='function'||!isCurrent())return null;
 if(![g.left,g.top,g.width,g.height,g.scaleX,g.scaleY,m.left,m.bottom,f.left,f.top,f.right,f.bottom,size.width,size.height].every(Number.isFinite)||!Number.isInteger(m.left)||!Number.isInteger(m.bottom)||m.left<0||m.bottom<0||g.width<=0||g.height<=0||g.scaleX<=0||g.scaleY<=0||size.width!==state.width||size.height!==state.height||object.width<g.width+m.left||object.height!==g.height+m.bottom||Math.abs(object.left-(g.left-m.left*g.scaleX))>.001||Math.abs(object.top-g.top)>.001||Math.abs(object.scaleX-g.scaleX)>.000001||Math.abs(object.scaleY-g.scaleY)>.000001||oldEl?.naturalWidth!==object.width||oldEl?.naturalHeight!==object.height||typeof m.source!=='string'||!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(m.source)||m.source.length>MAX_ORIGINAL)return null;
 trace.stage='header';if(!safeStoredImageHeader(m.source,g.width,g.height)){trace.stage='unsafe-header';return null;}trace.stage='decode';let raw;try{raw=await decode(m.source);}catch{return null;}if(!isCurrent()||object.getSrc?.()!==oldSrc||object.getElement?.()!==oldEl||raw.naturalWidth!==g.width||raw.naturalHeight!==g.height)return null;
 trace.stage='rebuild';const fake={...object,...g,type:object.type,gridExpansion:undefined,gridSourceProvenance:undefined,getElement:()=>raw,getSrc:()=>m.source,getBoundingRect(){return {left:this.left,top:this.top,width:this.width*this.scaleX,height:this.height*this.scaleY}},_render:object._render};const objects=state.objects.map(x=>x===object?fake:x),st={...state,objects};let c;
 try{c=makeCanvas(g.width,g.height);const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(raw,0,0);const pixels={data:x.getImageData(0,0,g.width,g.height).data,width:g.width,height:g.height};const args={state:st,object:fake,sourceFrame:f,targetFrame:{left:0,top:0,right:size.width,bottom:size.height},pixels,permittedUnderlays,makeCanvas,reviewedJson:state.sourceFormat==='json'};trace.candidate=!!inspectGridCandidate(args);trace.attributes={type:fake.type,role:fake.layerRole,inferred:fake.layerRoleInferred,locked:fake.layerLocked,sourceType:fake.sourceElementType,method:fake.cutoutMethod,frame:f,bounds:fake.getBoundingRect(),format:state.sourceFormat};const plan=encodeCompositeGrid(args);trace.result={plan:!!plan,bytes:!!plan&&plan.composite===oldSrc,width:!!plan&&plan.width===object.width,height:!!plan&&plan.height===object.height,left:!!plan&&plan.left===m.left,bottom:!!plan&&plan.bottom===m.bottom,current:isCurrent()};if(!plan||plan.composite!==oldSrc||plan.width!==object.width||plan.height!==object.height||plan.left!==m.left||plan.bottom!==m.bottom||!isCurrent())return null;trace.stage='verified';return {object,raw,oldSrc,oldEl,frame:{...f},original:{...g},metadata:m};}catch(e){trace.stage='error';trace.error=String(e?.message||e);return null;}finally{if(c)c.width=c.height=0;}
}
