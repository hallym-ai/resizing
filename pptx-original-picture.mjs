import {readSimplePicture} from './dom-picture-evidence.mjs';
import {derivePictureEvidence} from './ooxml-picture-provenance.mjs';
import {matchRendererGeometry} from './renderer-geometry-gate.mjs';

// A strict, optional direct-media import. Unsupported pictures stay on the
// existing per-object rendering path; no raster segmentation is performed.
export async function originalPptxPicture(el,root,info,{signal,width,height,W,H,provenance}){
 if(info.type!=='picture'||!provenance?.slideXml||!provenance?.relsXml||!provenance?.slidePart||typeof provenance.readMedia!=='function')return null;
 const id=String(info.id||'').match(/^slide:(\d+)$/)?.[1];if(!id)return null;
 const sx=W/width,sy=H/height;if(!Number.isFinite(sx)||!Number.isFinite(sy)||sx<=0||Math.abs(sx-sy)>Math.max(sx,sy)*1e-6)return null;
 const ev=await readSimplePicture(el,root,{signal,width,height});
 if(!ev.ok||!/^data:image\/png;base64,/i.test(ev.mediaDataUrl))return null;
 const g=ev.object;if(g.flipH||g.flipV||g.opacity!==1)return null;
 // Only preserve whole in-slide objects. Existing outside-recovery continues
 // handling pictures that cross the original slide edge.
 const rr=root.getBoundingClientRect(),er=el.getBoundingClientRect();
 if(er.left<rr.left-.1||er.top<rr.top-.1||er.right>rr.right+.1||er.bottom>rr.bottom+.1)return null;
 // Existing import has special background/edge-band recognition based on
 // rendered crops; keep that path for full-slide and edge-spanning images.
 const touchesLeft=er.left<=rr.left+1,touchesRight=er.right>=rr.right-1;
 const touchesTop=er.top<=rr.top+1,touchesBottom=er.bottom>=rr.bottom-1;
 if((touchesLeft&&touchesRight)||(touchesTop&&touchesBottom))return null;
 const response=await fetch(ev.mediaDataUrl,{signal});
 if(!response.ok)return null;
 const shown=new Uint8Array(await response.arrayBuffer());
 const records=await derivePictureEvidence({...provenance,onlyId:id,displayedBytes:async found=>found===id?shown:null});
 const source=records[0];
 if(source?.status!=='source-verified'||matchRendererGeometry(source,g).status!=='geometry-matched')return null;
 const im=new Image();im.src=ev.mediaDataUrl;await im.decode();
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 const w=im.naturalWidth,h=im.naturalHeight;
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<=0||h<=0||w*h>8000000)return null;
 const text=String(info.name||'그림').slice(0,170);
 return {type:'Image',version:'7.4.0',originX:'center',originY:'center',left:(g.x+g.width/2)*sx,top:(g.y+g.height/2)*sy,width:w,height:h,scaleX:g.width*sx/w,scaleY:g.height*sy/h,angle:g.rotation,opacity:1,visible:true,src:ev.mediaDataUrl,layerName:'PPTX '+text,layerRole:/로고|logo/i.test(text)?'logo':'subject',layerLocked:false,sourceText:'',crossOrigin:null,filters:[],nativeKind:'image',sourceElementId:String(info.id),sourceElementType:'picture',sourceImageFill:false,cutoutMethod:'pptx-original-object',layerRoleInferred:true};
}
