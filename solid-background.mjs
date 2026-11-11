// Only a verified opaque, single-colour background may change aspect ratio.
// Pictures, logos and text retain their own transforms.
const cache=new WeakMap();
export function solidBackgroundColor(object){
 if(!object||object.visible===false||object.layerRole!=='background'||object.sourceText||(object.opacity??1)!==1||object.angle||object.skewX||object.skewY||object.shadow||object.clipPath||object.filters?.length)return null;
 if(String(object.type).toLowerCase()==='rect'){
  if(typeof object.fill!=='string'||object.rx||object.ry||object.stroke&&object.strokeWidth)return null;
  const sample=document.createElement('canvas');sample.width=sample.height=1;
  try{const ctx=sample.getContext('2d');ctx.clearRect(0,0,1,1);ctx.fillStyle=object.fill;ctx.fillRect(0,0,1,1);const data=ctx.getImageData(0,0,1,1).data;return data[3]===255?'#'+Array.from(data.slice(0,3),n=>n.toString(16).padStart(2,'0')).join(''):null;}catch{return null;}finally{sample.width=sample.height=0;}
 }
 if(String(object.type).toLowerCase()!=='image')return null;
 const element=object.getElement?.();if(!element)return null;
 const w=element.naturalWidth||element.width,h=element.naturalHeight||element.height;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>24000000)return null;
 const immutable=element.tagName==='IMG',key=(element.currentSrc||element.src||'')+':'+w+'x'+h,previous=cache.get(element);
 if(immutable&&previous?.key===key)return previous.color;
 let canvas,color=null;
 try{
  canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(element,0,0);
  const pixels=ctx.getImageData(0,0,w,h).data;
  if(pixels[3]>=254){
   const r=pixels[0],g=pixels[1],b=pixels[2];let uniform=true,opaqueInterior=false;
   for(let i=0;i<pixels.length;i+=4){
    const index=i/4,x=index%w,y=Math.floor(index/w),edge=x===0||x===w-1||y===0||y===h-1,alpha=pixels[i+3];
    // Native slide capture can round one outer pixel to alpha 254. The entire
    // interior must still be opaque; this never accepts a translucent picture.
    if(pixels[i]!==r||pixels[i+1]!==g||pixels[i+2]!==b||alpha!==255&&!(edge&&alpha===254)){uniform=false;break;}
    if(alpha===255&&(!edge||w<=2||h<=2))opaqueInterior=true;
   }
   uniform=uniform&&opaqueInterior;
   if(uniform)color='#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
 }catch{}finally{if(canvas)canvas.width=canvas.height=0;}
 if(immutable)cache.set(element,{key,color});
 return color;
}

export function extendSolidBackground(object,width,height){
 if(!solidBackgroundColor(object)||!object.width||!object.height)return false;
 object.set(String(object.type).toLowerCase()==='rect'?{left:0,top:0,originX:'left',originY:'top',width,height,scaleX:1,scaleY:1}:{left:0,top:0,originX:'left',originY:'top',scaleX:width/object.width,scaleY:height/object.height});
 object.setCoords();return true;
}


// Infer only a flat padding colour from an opaque, consistent image perimeter.
// This fills new space; it never stretches or regenerates the source artwork.
const boundaryCache=new WeakMap();
export function sourceBoundaryBackgroundColor(element){
 if(!element)return null;
 const w=element.naturalWidth||element.width,h=element.naturalHeight||element.height;
 if(!(w>0&&h>0))return null;
 const key=(element.currentSrc||element.src||'')+':'+w+'x'+h,immutable=element.tagName==='IMG',old=boundaryCache.get(element);
 if(immutable&&old?.key===key)return old.color;
 const sample=document.createElement('canvas');sample.width=sample.height=128;let color=null;
 try{const ctx=sample.getContext('2d',{willReadFrequently:true}),offsets=[];
  for(let i=0;i<128;i++)offsets.push(i*4,(127*128+i)*4,(i*128)*4,(i*128+127)*4);
  const corners=[0,127*4,127*128*4,(128*128-1)*4];
  const ring=inset=>{
   ctx.clearRect(0,0,128,128);const rw=w-2*inset,rh=h-2*inset;
   ctx.drawImage(element,inset,inset,rw,1,0,0,128,1);ctx.drawImage(element,inset,h-1-inset,rw,1,0,127,128,1);
   ctx.drawImage(element,inset,inset,1,rh,0,0,1,128);ctx.drawImage(element,w-1-inset,inset,1,rh,127,0,1,128);
   const p=ctx.getImageData(0,0,128,128).data,base=[p[0],p[1],p[2]];
   const matches=i=>p[i+3]>=254&&base.every((v,k)=>Math.abs(p[i+k]-v)<=3);
   const uniform=corners.every(matches)&&offsets.filter(matches).length>=512*.95;
   return {color:uniform?'#'+base.map(v=>v.toString(16).padStart(2,'0')).join(''):null,opaque:offsets.every(i=>p[i+3]>=254)};
  };
  const outer=ring(0);color=outer.color;
  // Only known PDF.js raster output gets the inset fallback: fractional page
  // bounds can leave a one-pixel matte. Two independent inner rings must agree.
  // Ordinary photographs and transparent image borders keep the outer rule.
  if(!color&&outer.opaque&&element.dataset?.coexPdfRaster==='true'&&w>6&&h>6){const a=ring(1),b=ring(2);if(a.color&&a.color===b.color)color=a.color;}
 }catch{}finally{sample.width=sample.height=0;}
 if(immutable)boundaryCache.set(element,{key,color});return color;
}
