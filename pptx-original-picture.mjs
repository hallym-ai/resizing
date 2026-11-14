import {readSimplePicture} from './dom-picture-evidence.mjs';
import {derivePictureEvidence} from './ooxml-picture-provenance.mjs';
import {verifiedPictureObject} from './verified-picture-object.mjs';

// Source-checked whole-media import, including pictures crossing slide edges.
// Unsupported groups/crops/effects retain the existing capture/review fallback.
export async function originalPptxPicture(el,root,info,{signal,width,height,W,H,provenance}){
 if(info.type!=='picture'||!provenance?.slideXml||!provenance?.relsXml||!provenance?.slidePart||typeof provenance.readMedia!=='function')return null;
 const id=String(info.id||'').match(/^slide:(\d+)$/)?.[1];if(!id)return null;
 const sx=W/width,sy=H/height;if(!Number.isFinite(sx)||!Number.isFinite(sy)||sx<=0||Math.abs(sx-sy)>Math.max(sx,sy)*1e-6)return null;
 const ev=await readSimplePicture(el,root,{signal,width,height});
 if(!ev.ok)return null;
 const g=ev.object;
 const response=await fetch(ev.mediaDataUrl,{signal});
 if(!response.ok)return null;
 const shown=new Uint8Array(await response.arrayBuffer());
 const records=await derivePictureEvidence({...provenance,onlyId:id,displayedBytes:async found=>found===id?shown:null});
 const source=records[0];
 if(!['source-verified','source-equivalent'].includes(source?.status))return null;
 const im=new Image();im.src=ev.mediaDataUrl;await im.decode();
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 let w=im.naturalWidth,h=im.naturalHeight,mediaDataUrl=ev.mediaDataUrl;
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<=0||h<=0||w*h>8000000)return null;
 if(/^data:image\/svg\+xml;base64,/i.test(mediaDataUrl)){
  // JSON accepts raster assets only. Rasterize the already validated complete
  // SVG, without the slide viewport, rotation or object opacity baked into it.
  w=Math.max(1,Math.ceil(g.width*sx));h=Math.max(1,Math.ceil(g.height*sy));
  if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w>12000||h>12000||w*h>8000000)return null;
  const canvas=document.createElement('canvas');
  try{canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)return null;ctx.drawImage(im,0,0,w,h);mediaDataUrl=canvas.toDataURL('image/png');}
  finally{canvas.width=canvas.height=0;}
 }
 return verifiedPictureObject({source,geometry:g,mediaDataUrl,width:w,height:h,W,H,slideWidth:width,slideHeight:height,info});
}
