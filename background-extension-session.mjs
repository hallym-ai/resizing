import {extendPhotoBackground} from './photo-background-extension.mjs';
import {solidBackgroundColor} from './solid-background.mjs';

// Trust is deliberately local to this page and to a specific Fabric object.
// Saved project metadata is never used to authorize a new extension.
const records=new WeakMap();
let generation=0;
export function invalidatePhotoExtensions(){generation++;}
const bytes=a=>a instanceof Uint8Array||a instanceof Uint8ClampedArray;
const eligibleMethod=method=>method==='photo-ai-estimated-inpaint'||method==='photo-ai-residual-background';
function confirmedFullSolid(o,state){
 if(!o||o.group||o.flipX||o.flipY||o.cropX||o.cropY||o.globalCompositeOperation&&o.globalCompositeOperation!=='source-over'||
  typeof o.fill==='string'&&globalThis.CSS?.supports&&!CSS.supports('color',o.fill)||!solidBackgroundColor(o))return false;
 const b=o.getBoundingRect?.();return !!b&&[b.left,b.top,b.width,b.height].every(Number.isFinite)&&
  Math.abs(b.left)<=0.5&&Math.abs(b.top)<=0.5&&Math.abs(b.width-state.width)<=0.5&&Math.abs(b.height-state.height)<=0.5;
}
export function registerPhotoExtension({object,pixels,foregroundMask,width,height}){
 if(!object||object.photoInstanceKind!=='background'||!eligibleMethod(object.cutoutMethod)||
  !Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<16||height<16||width*height>2_000_000||
  !bytes(pixels)||pixels.length!==width*height*4||!bytes(foregroundMask)||foregroundMask.length!==width*height||
  object.width!==width||object.height!==height||!object.getElement?.())return false;
 records.set(object,{pixels:new Uint8ClampedArray(pixels),mask:new Uint8Array(foregroundMask),width,height,element:object.getElement(),group:object.photoInstanceGroup,method:object.cutoutMethod,generation});return true;
}
export function selectPhotoExtension(state){
 const objects=state?.objects||[],candidates=objects.filter(o=>o.visible!==false&&records.has(o));
 if(candidates.length!==1)return null;
 const object=candidates[0],record=records.get(object),index=objects.indexOf(object),group=record.group;
 if(record.generation!==generation||!group||object.photoInstanceGroup!==group||object.getElement?.()!==record.element||object.width!==record.width||object.height!==record.height||
  object.layerRole!=='other'||object.photoInstanceKind!=='background'||!eligibleMethod(object.cutoutMethod)||object.cutoutMethod!==record.method||
  object.angle||object.skewX||object.skewY||object.flipX||object.flipY||object.cropX||object.cropY||object.clipPath||object.shadow||object.group||object.filters?.length||
  (object.opacity??1)!==1||object.strokeWidth||!(object.scaleX>0&&object.scaleY>0)||
  objects.slice(0,index).some(o=>o.visible!==false&&!confirmedFullSolid(o,state))||
  objects.filter(o=>o.photoInstanceGroup===group&&o.photoInstanceKind==='background'&&o.visible!==false).length!==1||
  !objects.some(o=>o.photoInstanceGroup===group&&o.photoInstanceKind==='source'&&o.visible===false)||
  !objects.some(o=>o.photoInstanceGroup===group&&o.photoInstanceKind==='part'&&o.visible!==false))return null;
 const box=object.getBoundingRect();
 const tx=Math.max(0.5,state.width*0.0025),ty=Math.max(0.5,state.height*0.0025);
 if(!box||![box.left,box.top,box.width,box.height,state.width,state.height].every(Number.isFinite)||
  box.left < -tx||box.left>0.5||box.top < -ty||box.top>0.5||
  box.left+box.width<state.width-0.5||box.left+box.width>state.width+tx||
  box.top+box.height<state.height-0.5||box.top+box.height>state.height+ty)return null;
 return {object,record};
}
export function photoExtensionGeometry(selected,targetWidth,targetHeight){
 if(!selected)return null;
 const {object,record}=selected,box=object.getBoundingRect();if(!box)return null;
 const sx=box.width/record.width,sy=box.height/record.height;
 if(![box.left,box.top,box.width,box.height,sx,sy,targetWidth,targetHeight].every(Number.isFinite)||sx<=0||sy<=0)return null;
 const x=Math.ceil(Math.max(0,box.left)/sx),y=Math.ceil(Math.max(0,box.top)/sy);
 const right=Math.ceil(Math.max(0,targetWidth-box.left-box.width)/sx),bottom=Math.ceil(Math.max(0,targetHeight-box.top-box.height)/sy);
 return {object,record,box:{...box},sx,sy,x,y,width:record.width+x+right,height:record.height+y+bottom};
}
export async function preparePhotoExtension(geometry,{makeCanvas,decode,signal}={}){
 if(!geometry)return null;
 const g=geometry,r=g.record;
 const result=await extendPhotoBackground({pixels:r.pixels,width:r.width,height:r.height,foregroundMask:r.mask,evidence:{kind:'user-reviewed-mask',confirmed:true},targetWidth:g.width,targetHeight:g.height,frame:{x:g.x,y:g.y,width:r.width,height:r.height},signal});
 if(result.status!=='review')return {status:result.status,reason:result.reason};
 // Fill the unchanged source rectangle byte-for-byte, so only new margins are synthesized.
 for(let row=0;row<r.height;row++)result.pixels.set(r.pixels.subarray(row*r.width*4,(row+1)*r.width*4),((row+g.y)*g.width+g.x)*4);
 const canvas=makeCanvas(g.width,g.height);
 try{const ctx=canvas.getContext('2d');const data=ctx.createImageData(g.width,g.height);data.data.set(result.pixels);ctx.putImageData(data,0,0);const element=await decode(canvas.toDataURL('image/png'));return {status:'review',geometry:g,element,warning:result.warning};}
 finally{canvas.width=canvas.height=0;}
}
export function applyPhotoExtension(plan){
 if(plan?.status!=='review')return false;
 const g=plan.geometry,o=g.object;
 if(o.getElement?.()!==g.record.element||o.width!==g.record.width||o.height!==g.record.height)return false;
 const b=o.getBoundingRect();if(['left','top','width','height'].some(k=>Math.abs(b[k]-g.box[k])>0.01))return false;
 o.setElement(plan.element);o.set({originX:'left',originY:'top',left:g.box.left-g.x*g.sx,top:g.box.top-g.y*g.sy,width:g.width,height:g.height,scaleX:g.sx,scaleY:g.sy});o.setCoords();return true;
}
