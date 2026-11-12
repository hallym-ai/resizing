import {mergePicturePixels} from './coherent-picture.mjs';
// Scratch-only: this preserves the original interior but exterior seam quality,
// source crop/group identity and editor history still require real validation.
export async function mergeOutsideCandidate({svg,viewBox,baseCanvas,cropX,cropY,captureWidth,captureHeight,width,height,sx,sy,signal}){
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 let canvas,out,outerCanvas;try{
  const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await image.decode();
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const kx=captureWidth/width,ky=captureHeight/height,x0=Math.round(viewBox.x*kx),y0=Math.round(viewBox.y*ky),x1=Math.round((viewBox.x+viewBox.width)*kx),y1=Math.round((viewBox.y+viewBox.height)*ky),ow=x1-x0,oh=y1-y0;
  if(![ow,oh].every(n=>Number.isSafeInteger(n)&&n>0)||ow*oh>2000000)return {ok:false,reason:'budget'};
  canvas=document.createElement('canvas');canvas.width=ow;canvas.height=oh;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,ow,oh);const pixels=ctx.getImageData(0,0,ow,oh).data;
  // Eliminate every candidate pixel in the original slide viewport, including
  // the anti-aliased clipping edge. Original baseline remains authoritative.
  let minX=ow,minY=oh,maxX=-1,maxY=-1;
  // Experimental 2-source-pixel underlap for antialiased edge continuity.
  for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){const i=(y*ow+x)*4;if(x+x0>=2&&x+x0<captureWidth-2&&y+y0>=2&&y+y0<captureHeight-2)pixels[i+3]=0;if(pixels[i+3]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}}
  if(maxX<0)return {ok:false,reason:'no-outside'};
  const tw=maxX-minX+1,th=maxY-minY+1,tight=new Uint8ClampedArray(tw*th*4);
  for(let y=0;y<th;y++){const i=((y+minY)*ow+minX)*4;tight.set(pixels.subarray(i,i+tw*4),y*tw*4);}
  outerCanvas=document.createElement('canvas');outerCanvas.width=tw;outerCanvas.height=th;outerCanvas.getContext('2d').putImageData(new ImageData(tight,tw,th),0,0);
  const base=baseCanvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,baseCanvas.width,baseCanvas.height).data;
  const m=mergePicturePixels({base,bw:baseCanvas.width,bh:baseCanvas.height,outer:tight,ow:tw,oh:th,offsetX:x0+minX-cropX,offsetY:y0+minY-cropY});if(!m.ok)return m;
  out=document.createElement('canvas');out.width=m.width;out.height=m.height;out.getContext('2d').putImageData(new ImageData(m.pixels,m.width,m.height),0,0);
  return {ok:true,src:out.toDataURL('image/png'),width:m.width,height:m.height,left:(cropX+m.x0)*sx,top:(cropY+m.y0)*sy,scaleX:sx,scaleY:sy,added:m.added,outer:{src:outerCanvas.toDataURL('image/png'),width:tw,height:th,left:(x0+minX)*sx,top:(y0+minY)*sy}};
 }finally{if(canvas)canvas.width=canvas.height=0;if(out)out.width=out.height=0;if(outerCanvas)outerCanvas.width=outerCanvas.height=0;}
}
