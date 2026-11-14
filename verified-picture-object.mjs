import {matchRendererGeometry} from './renderer-geometry-gate.mjs';

// Session-only provenance is discarded on each PPTX import; metadata loaded
// from JSON cannot create this evidence. Records bind identity and geometry.
const verifiedRecords=[],blockedRecords=[];
export function clearVerifiedPictureRecords(){verifiedRecords.length=0;blockedRecords.length=0;}
export function revokeVerifiedPictureRecords(){blockedRecords.push(...verifiedRecords);verifiedRecords.length=0;}
export function blockedVerifiedPicture(o,state){return state.sourceFormat==='pptx'&&blockedRecords.some(r=>r.id===o.sourceElementId);}
export function verifiedPictureRecord(o,state,box){
 if(state.sourceFormat!=='pptx'||state.inputKind==='raster'||!o.layerRoleInferred||o.sourceElementType!=='picture'||o.cutoutMethod!=='pptx-original-object'||!o.sourceElementId||state.objects.filter(x=>x.sourceElementId===o.sourceElementId).length!==1)return false;
 const src=o.getSrc?.(),eps=.1;return verifiedRecords.some(r=>r.id===o.sourceElementId&&r.src===src&&r.role===o.layerRole&&r.locked===!!o.layerLocked&&r.width===state.width&&r.height===state.height&&['left','top','width','height'].every(k=>Math.abs(r.box[k]-box[k])<=eps));
}
// Isolated slide capture, permitted only after independent OOXML byte and
// geometry verification of the renderer's underlying native picture.
export function registerVerifiedPictureCapture(o,proof,width,height){
 if(!o||!proof||proof.status!=='unverified-render'||!['source-verified','source-equivalent'].includes(proof.sourceStatus)||proof.geometryStatus!=='geometry-matched'||!/^slide:[0-9]+$/.test(o.sourceElementId||'')||proof.id!==o.sourceElementId||o.layerRole!=='background'||!o.layerRoleInferred||!o.layerLocked||o.sourceElementType!=='picture'||o.cutoutMethod!=='pptx-original-object'||typeof o.src!=='string'||!/^data:image\/png;base64,/.test(o.src)||!Number.isFinite(width)||!Number.isFinite(height))return false;
 const box={left:o.left,top:o.top,width:o.width*o.scaleX,height:o.height*o.scaleY};if(Object.values(box).some(v=>!Number.isFinite(v))||box.width<=0||box.height<=0)return false;
 verifiedRecords.push({id:o.sourceElementId,src:o.src,role:'background',locked:true,width,height,box});if(verifiedRecords.length>200)verifiedRecords.shift();return true;
}
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
 verifiedRecords.push({id:String(info?.id||''),src:mediaDataUrl,role:'subject',locked:false,width:W,height:H,box:{left:g.x*sx,top:g.y*sy,width:g.width*sx,height:g.height*sy}});if(verifiedRecords.length>200)verifiedRecords.shift();
 return {type:'Image',version:'7.4.0',originX:'center',originY:'center',left:(g.x+g.width/2)*sx,top:(g.y+g.height/2)*sy,width:w,height:h,scaleX:g.width*sx/w,scaleY:g.height*sy/h,angle:g.rotation,opacity:g.opacity,visible:true,src:mediaDataUrl,layerName:'PPTX '+name,layerRole:/로고|logo/i.test(name)?'logo':'subject',layerLocked:false,sourceText:'',crossOrigin:null,filters:[],nativeKind:'image',sourceElementId:String(info?.id||''),sourceElementType:'picture',sourceImageFill:false,cutoutMethod:'pptx-original-object',layerRoleInferred:true};
}
