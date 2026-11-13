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
export function encodeCompositeGrid({state,object,sourceFrame,targetFrame,pixels,permittedUnderlays=[],makeCanvas,reviewedJson=false}){
 if(!object||object.gridExpansion||typeof makeCanvas!=='function')return null;
 const plan=inspectGridCandidate({state,object,sourceFrame,targetFrame,pixels,permittedUnderlays,reviewedJson});if(!plan)return null;
 const original=object.getSrc?.();if(typeof original!=='string'||original.length>MAX_ORIGINAL||!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(original))return null;
 // Transparency is allowed, but the canvas must reproduce every central RGBA
 // channel exactly after its premultiplied-alpha round trip.
 const phase=detectVerticalGridPhase(pixels);if(!phase)return null;
 const w=object.width,h=object.height,left=Math.max(0,Math.ceil((sourceFrame.left-targetFrame.left)/object.scaleX)),right=Math.max(0,Math.ceil((targetFrame.right-sourceFrame.right)/object.scaleX)),width=left+w+right;
 if(![w,h,left,right,width].every(Number.isSafeInteger)||left<0||right<0||(!left&&!right)||width*h>MAX_PIXELS||left>w*32||right>w*32)return null;
 let c;try{c=makeCanvas(width,h);if(!c||c.width!==width||c.height!==h)return null;const ctx=c.getContext('2d');if(!ctx)return null;const start=-left,end=w+right;
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
  const composite=c.toDataURL('image/png');if(!composite.startsWith('data:image/png;base64,')||composite.length>MAX_ENCODED)return null;
  return {object,element:plan.element,composite,left,width,height:h,phase,source:original,original:{left:object.left,top:object.top,width:w,height:h,scaleX:object.scaleX,scaleY:object.scaleY},warning:'반복 무늬를 추정해 좌우를 연결했습니다. 이미지 안 글씨·로고와 경계를 확인하세요.'};
 }catch{return null;}finally{if(c){c.width=0;c.height=0;}}
}
// Only a scene-owner transaction may call this after validating current epoch,
// source, scene signature, decoded image dimensions and project size.
export function applyCompositeGrid(plan,decoded){const o=plan?.object,g=plan?.original;if(!o||!decoded||o.getElement?.()!==plan.element||o.getSrc?.()!==plan.source||o.gridExpansion||o.left!==g.left||o.top!==g.top||o.width!==g.width||o.height!==g.height||o.scaleX!==g.scaleX||o.scaleY!==g.scaleY||decoded.naturalWidth!==plan.width||decoded.naturalHeight!==plan.height)return false;
 o.setElement(decoded);o.set({left:g.left-plan.left*g.scaleX,top:g.top,width:plan.width,height:g.height,scaleX:g.scaleX,scaleY:g.scaleY,gridExpansion:{version:1,source:plan.source,original:g,left:plan.left}});o.setCoords();return true;}
