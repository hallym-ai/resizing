import {matchRendererGeometry} from './renderer-geometry-gate.mjs';

// Import a complete, source-checked picture as one object. No slide-edge crop
// and no independently resampled outside patch: opacity and rotation apply once.
export function verifiedPictureObject({source,geometry:g,mediaDataUrl,width:w,height:h,W,H,slideWidth,slideHeight,info}){
 const sx=W/slideWidth,sy=H/slideHeight;
 if(![sx,sy,w,h].every(Number.isFinite)||sx<=0||Math.abs(sx-sy)>Math.max(sx,sy)*1e-6||
    !Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<=0||h<=0||w>12000||h>12000||w*h>8000000||
    !['source-verified','source-equivalent'].includes(source?.status)||
    typeof mediaDataUrl!=='string'||!/^data:image\/(png|jpeg);base64,/i.test(mediaDataUrl)||
    !g||g.width<=0||g.height<=0||g.opacity<=0||g.opacity>1||g.flipH||g.flipV||g.crop||g.group||g.effects?.length||
    matchRendererGeometry(source,g).status!=='geometry-matched')return null;
 if([(g.x+g.width/2)*sx,(g.y+g.height/2)*sy,g.width*sx/w,g.height*sy/h].some(v=>!Number.isFinite(v)||Math.abs(v)>1e8))return null;
 const name=String(info?.name||'그림').slice(0,170);
 return {type:'Image',version:'7.4.0',originX:'center',originY:'center',left:(g.x+g.width/2)*sx,top:(g.y+g.height/2)*sy,width:w,height:h,scaleX:g.width*sx/w,scaleY:g.height*sy/h,angle:g.rotation,opacity:g.opacity,visible:true,src:mediaDataUrl,layerName:'PPTX '+name,layerRole:/로고|logo/i.test(name)?'logo':'subject',layerLocked:false,sourceText:'',crossOrigin:null,filters:[],nativeKind:'image',sourceElementId:String(info?.id||''),sourceElementType:'picture',sourceImageFill:false,cutoutMethod:'pptx-original-object',layerRoleInferred:true};
}
