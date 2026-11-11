// Independent native edge artwork only; this does not segment a flat poster.
const alphaCache=new WeakMap();
function paintedBounds(o){
 const element=o.getElement?.();if(!element)return null;
 const previous=alphaCache.get(element);if(previous)return previous;
 const w=element.naturalWidth||element.width,h=element.naturalHeight||element.height;if(!w||!h||w*h>4000000)return null;
 const c=document.createElement('canvas');c.width=w;c.height=h;
 try{const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(element,0,0);const pixels=ctx.getImageData(0,0,w,h).data;let l=w,t=h,r=-1,b=-1,count=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>=24){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);count++;}
  if(r<l)return null;const result={x:l/w,y:t/h,w:(r-l+1)/w,h:(b-t+1)/h,coverage:count/(w*h)};alphaCache.set(element,result);return result;
 }catch{return null;}finally{c.width=c.height=0;}
}
export function captureRightEdge(state,parts){
 if(state.inputKind==='raster'||!parts.backgrounds.some(p=>p.textureProfile?.evidence==='inferred-independent-native-masonry'))return null;
 const candidates=parts.foreground.flatMap(({id,object:o})=>{
  if(o.visible===false||o.layerLocked||String(o.type).toLowerCase()!=='image'||o.cutoutMethod!=='pptx-original-object'||o.sourceElementType!=='picture'||o.text||o.sourceText||o.sourceImageFill||o.layoutManualGroup||o.layoutManualRole||(!o.layerRoleInferred&&o.layerRole!=='decoration')||o.clipPath||o.shadow||o.angle||o.skewX||o.skewY||o.flipX||o.flipY||o.cropX||o.cropY||o.filters?.length||(o.opacity??1)!==1)return [];
  const box=o.getBoundingRect();if(box.height<state.height*.85||box.width>state.width*.35||box.left<state.width*.68||box.left+box.width<state.width*.97||box.top<-.03*state.height||box.top>.05*state.height)return [];
  const alpha=paintedBounds(o);if(!alpha||alpha.coverage>.75||alpha.coverage<.02||alpha.h<.85)return [];
  return [{id,object:o,element:o.getElement(),src:o.getSrc?.(),box,alpha,scaleX:o.scaleX,scaleY:o.scaleY}];
 });
 return candidates.length===1?candidates[0]:null;
}
export function applyRightEdge(state,edge,width,height){
 if(!edge||edge.object.getElement()!==edge.element||edge.object.getSrc?.()!==edge.src)return null;
 const {object:o,box,alpha}=edge,k=height/(box.height*alpha.h);
 // Align painted pixels, not the transparent padding in the asset rectangle.
 o.set({originX:'left',originY:'top',scaleX:edge.scaleX*k,scaleY:edge.scaleY*k,left:width-box.width*(alpha.x+alpha.w)*k,top:-box.height*alpha.y*k});o.setCoords();
 return {id:edge.id,anchor:'right',method:'independent-native-masonry-edge-alpha',paintedRight:width,paintedTop:0,paintedHeight:height,scale:k};
}
