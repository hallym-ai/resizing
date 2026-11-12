// Experimental, pure planning only. Nothing here mutates the user's scene.
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const intersection=(a,b)=>{const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),r=Math.min(a.x+a.w,b.x+b.w),d=Math.min(a.y+a.h,b.y+b.h);return {x,y,w:Math.max(0,r-x),h:Math.max(0,d-y)};};
const contained=(a,b,tol=1)=>a.x>=b.x-tol&&a.y>=b.y-tol&&a.x+a.w<=b.x+b.w+tol&&a.y+a.h<=b.y+b.h+tol;
export function isUniformHorizontalBand({pixels,width,height}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width*height>2e6||pixels?.length!==width*height*4)return false;
 let color=null,opaqueRows=0;
 for(let y=0;y<height;y++){
  const offset=y*width*4,alpha=pixels[offset+3];if(alpha>=250)opaqueRows++;
  for(let x=0;x<width;x++){
   const i=offset+x*4;if(pixels[i+3]!==alpha)return false;
   if(alpha){const c=[pixels[i],pixels[i+1],pixels[i+2]];if(!color)color=c;else if(c.some((n,k)=>n!==color[k]))return false;}
  }
 }
 return !!color&&opaqueRows>=height*.8;
}
export function planAnchoredFooter({sourceWidth,sourceHeight,targetWidth,targetHeight,items,rgbaById}){
 if(![sourceWidth,sourceHeight,targetWidth,targetHeight].every(n=>Number.isFinite(n)&&n>0))return null;
 const tol=Math.max(2,sourceWidth*.002), candidates=items.filter(o=>{
  const b=o.sourceBox,p=rgbaById[o.id];
  return o.visible!==false&&!o.locked&&o.type==='image'&&o.sourceType==='picture'&&!o.group&&!o.clip&&!o.effects&&!o.flip&&!o.angle&&!o.skew&&!o.crop&&b&&p&&
   Math.abs(b.x)<=tol&&Math.abs(b.x+b.w-sourceWidth)<=tol&&Math.abs(b.y+b.h-sourceHeight)<=Math.max(2,sourceHeight*.002)&&b.h/sourceHeight>=.01&&b.h/sourceHeight<=.2&&isUniformHorizontalBand(p);
 });
 if(candidates.length!==1)return null;
 const band=candidates[0],old=band.outputBox;
 if(!old||![old.x,old.y,old.w,old.h].every(Number.isFinite)||old.w<=0||old.h<=0||old.h>targetHeight)return null;
 const dst={x:0,y:targetHeight-old.h,w:targetWidth,h:old.h},dy=dst.y-old.y;
 const content=items.filter(o=>o.visible!==false&&o.id!==band.id&&o.kind==='text'&&o.paintIndex>band.paintIndex&&o.sourceBox&&contained(o.sourceBox,band.sourceBox));
 if(!content.length||content.some(o=>o.locked||!o.outputBox))return null;
 // Conservatively reject objects mostly contained in the original band.
 // Partial overlaps remain ambiguous and require visual review.
 if(items.some(o=>o.id!==band.id&&o.visible!==false&&o.kind!=='background'&&o.kind!=='text'&&o.sourceBox&&overlap(o.sourceBox,band.sourceBox)>=o.sourceBox.w*o.sourceBox.h*.8))return null;
 const textMoves=content.map(o=>({id:o.id,dx:0,dy}));
 // Reject newly obscured elements; rectangles already overlapping the old strip
 // are allowed only if they do not intersect the new strip in a new location.
 for(const o of items){if(o.id===band.id||o.visible===false||o.kind==='background'||content.includes(o)||!o.outputBox)continue;
  const covered=intersection(o.outputBox,dst),next=covered.w*covered.h,already=overlap(covered,old);if(next>already+1e-6)return null;
 }
 for(const o of content){const b={...o.outputBox,y:o.outputBox.y+dy};if(!contained(b,{x:0,y:0,w:targetWidth,h:targetHeight}))return null;
  for(const other of items){if(other.id===band.id||other===o||other.visible===false||other.kind==='background'||content.includes(other)||!other.outputBox)continue;
   const now=intersection(b,other.outputBox),area=now.w*now.h;if(area>overlap(now,o.outputBox)+1e-6)return null;
  }
 }
 return {bandId:band.id,bandBox:dst,textMoves,quality:'geometry-only-requires-render-validation'};
}
