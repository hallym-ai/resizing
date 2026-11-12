// Scratch experiment. Baseline pixels win everywhere within their original bbox.
export function mergePicturePixels({base,bw,bh,outer,ow,oh,offsetX,offsetY,maxPixels=2000000}){
 if(![bw,bh,ow,oh].every(n=>Number.isSafeInteger(n)&&n>0)||![offsetX,offsetY].every(Number.isSafeInteger)||base?.length!==bw*bh*4||outer?.length!==ow*oh*4)return {ok:false,reason:'invalid'};
 const x0=Math.min(0,offsetX),y0=Math.min(0,offsetY),x1=Math.max(bw,offsetX+ow),y1=Math.max(bh,offsetY+oh),width=x1-x0,height=y1-y0;
 if(width*height>maxPixels)return {ok:false,reason:'budget'};
 const pixels=new Uint8ClampedArray(width*height*4);let added=0;
 for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){const gx=x+offsetX,gy=y+offsetY;if(gx>=0&&gx<bw&&gy>=0&&gy<bh)continue;const s=(y*ow+x)*4,d=((gy-y0)*width+gx-x0)*4;pixels.set(outer.subarray(s,s+4),d);if(outer[s+3])added++;}
 if(!added)return {ok:false,reason:'no-outside'};
 for(let y=0;y<bh;y++){const s=y*bw*4,d=((y-y0)*width-x0)*4;pixels.set(base.subarray(s,s+bw*4),d);}
 return {ok:true,pixels,width,height,x0,y0,added};
}
