import {planAnchoredFooter} from './anchored-band.mjs';
const box=o=>{const b=o.getBoundingRect();return {x:b.left,y:b.top,w:b.width,h:b.height}};
const nativeText=o=>['text','textbox','itext'].includes(String(o.type).toLowerCase());
export function captureFooterSource(state){
 const items=state.objects.map((o,id)=>({id,visible:o.visible!==false,locked:!!o.layerLocked,type:String(o.type).toLowerCase(),sourceType:o.sourceElementType,kind:nativeText(o)?'text':o.layerRole==='background'?'background':'image',paintIndex:id,sourceBox:box(o),group:!!o.group,clip:!!o.clipPath,effects:!!(o.shadow||o.filters?.length||(o.opacity??1)!==1||(o.globalCompositeOperation&&o.globalCompositeOperation!=='source-over')||(o.stroke&&o.strokeWidth)),flip:!!(o.flipX||o.flipY),angle:o.angle||0,skew:(o.skewX||0)||(o.skewY||0),crop:(o.cropX||0)||(o.cropY||0)}));
 const rgbaById={};
 for(const item of items){const b=item.sourceBox,tol=Math.max(2,state.width*.002);if(!item.visible||item.locked||item.type!=='image'||item.sourceType!=='picture'||item.group||item.clip||item.effects||item.flip||item.angle||item.skew||item.crop||Math.abs(b.x)>tol||Math.abs(b.x+b.w-state.width)>tol||Math.abs(b.y+b.h-state.height)>Math.max(2,state.height*.002)||b.h/state.height<.01||b.h/state.height>.2)continue;
  const img=state.objects[item.id].getElement?.(),w=img?.naturalWidth||img?.width,h=img?.naturalHeight||img?.height;if(!img||!Number.isInteger(w)||!Number.isInteger(h)||w<2||h<2||w*h>2e6)continue;
  const c=document.createElement('canvas');c.width=w;c.height=h;try{const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);rgbaById[item.id]={width:w,height:h,pixels:ctx.getImageData(0,0,w,h).data};}catch{}finally{c.width=c.height=0;}
 }
 return {sourceWidth:state.width,sourceHeight:state.height,items,rgbaById};
}
export function applyFooterAfterResize(source,state,width,height){
 const items=source.items.map(item=>({...item,outputBox:box(state.objects[item.id])}));
 const plan=planAnchoredFooter({...source,items,targetWidth:width,targetHeight:height});if(!plan)return null;
 const band=state.objects[plan.bandId],b=box(band),k=plan.bandBox.w/b.w;
 if(!Number.isFinite(k)||k<=0)return null;
 // Source raster is horizontally uniform, so horizontal scale changes only its edges.
 band.set({scaleX:band.scaleX*k});band.setCoords();const b2=box(band),c=band.getCenterPoint();band.setPositionByOrigin(new state.F.Point(c.x+plan.bandBox.x-b2.x,c.y+plan.bandBox.y-b2.y),'center','center');band.setCoords();
 for(const m of plan.textMoves){const o=state.objects[m.id],c=o.getCenterPoint();o.setPositionByOrigin(new state.F.Point(c.x+m.dx,c.y+m.dy),'center','center');o.setCoords();}
 return plan;
}
