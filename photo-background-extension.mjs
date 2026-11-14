// Optional, non-generative outside-only continuation for a source whose
// background has been explicitly identified in the current session.
// This is a review candidate, never proof of a naturally reconstructed scene.
const MAX_PIXELS=8_000_000,MAX_SIDE=12_000,MAX_WORK_BYTES=64_000_000;
const bytes=a=>a instanceof Uint8Array||a instanceof Uint8ClampedArray;
const integer=n=>Number.isSafeInteger(n);
const reject=reason=>({status:'unavailable',reason});

// `evidence` must come from a current in-memory separation/confirmation step,
// not from a JSON flag, guessed layer role, name, or sampled colours.
// A foreground mask is 0 for background, >0 for any subject pixel. A user
// must review such a mask because an AI can miss text or other objects.
// Output is transparent inside `frame`. Composite it behind the unchanged
// scene: it must not replace the original picture or cover its interior.
export async function extendPhotoBackground({pixels,width,height,foregroundMask=null,evidence,targetWidth,targetHeight,frame,signal}){
 if(signal?.aborted)return {status:'cancelled',reason:'cancelled'};
 if(![width,height,targetWidth,targetHeight].every(integer)||width<16||height<16||targetWidth<1||targetHeight<1||
    [width,height,targetWidth,targetHeight].some(v=>v>MAX_SIDE)||width*height>MAX_PIXELS||targetWidth*targetHeight>MAX_PIXELS||
    !bytes(pixels)||pixels.length!==width*height*4)return reject('invalid-or-too-large');
 if(!frame||![frame.x,frame.y,frame.width,frame.height].every(integer)||frame.x<0||frame.y<0||frame.width<1||frame.height<1||
    frame.x+frame.width>targetWidth||frame.y+frame.height>targetHeight)return reject('invalid-frame');
 if(!evidence||evidence.confirmed!==true||!['separated-background','user-reviewed-mask'].includes(evidence.kind))return reject('background-not-confirmed');
 if(evidence.kind==='user-reviewed-mask'&&(!bytes(foregroundMask)||foregroundMask.length!==width*height))return reject('foreground-mask-required');
 if(foregroundMask!==null&&(!bytes(foregroundMask)||foregroundMask.length!==width*height))return reject('invalid-foreground-mask');
 if(width*height*(8+(foregroundMask?2:0))+targetWidth*targetHeight*4>MAX_WORK_BYTES)return reject('work-budget');
 // Freeze caller-owned bytes and geometry before yielding to the browser.
 // Caller must recheck source/scene revision before applying the result.
 pixels=new Uint8ClampedArray(pixels);if(foregroundMask)foregroundMask=new Uint8Array(foregroundMask);frame={...frame};
 const left=frame.x>0,right=frame.x+frame.width<targetWidth,top=frame.y>0,bottom=frame.y+frame.height<targetHeight;
 if(!left&&!right&&!top&&!bottom)return {status:'unavailable',reason:'no-new-margin'};
 // Only sample a limited edge strip. Any source subject/mask contact or alpha
 // hole in a strip rejects the whole candidate instead of cloning the object.
 const band=Math.max(2,Math.min(32,Math.floor(Math.min(width,height)/8)));
 for(let y=0;y<height;y++){
  if(signal?.aborted)return {status:'cancelled',reason:'cancelled'};
  if((y&127)===0)await new Promise(resolve=>setTimeout(resolve,0));
  for(let x=0;x<width;x++){
   if(!((left&&x<band)||(right&&x>=width-band)||(top&&y<band)||(bottom&&y>=height-band)))continue;
   const i=y*width+x;
   if(pixels[4*i+3]!==255)return reject('transparent-edge');
   if(foregroundMask?.[i])return reject('foreground-touches-edge');
  }
 }
 if(signal?.aborted)return {status:'cancelled',reason:'cancelled'};
 const output=new Uint8ClampedArray(targetWidth*targetHeight*4);
 // Mirror within the edge strip, not the entire original image. This avoids
 // repeating central content and produces a continuous edge at first contact.
 const mirror=(distance,n)=>{const k=distance%(2*n);return k<n?k:2*n-1-k;};
 const coord=(v,start,length,sourceSize)=>{
  if(v<start)return mirror(Math.floor((start-1-v)*sourceSize/length),band);
  if(v>=start+length)return sourceSize-1-mirror(Math.floor((v-start-length)*sourceSize/length),band);
  return Math.min(sourceSize-1,Math.floor((v-start)*sourceSize/length));
 };
 for(let y=0;y<targetHeight;y++){
  if(signal?.aborted)return {status:'cancelled',reason:'cancelled'};
  if((y&31)===0)await new Promise(resolve=>setTimeout(resolve,0));
  const insideY=y>=frame.y&&y<frame.y+frame.height,sy=coord(y,frame.y,frame.height,height);
  for(let x=0;x<targetWidth;x++){
   if(insideY&&x>=frame.x&&x<frame.x+frame.width)continue;
   const sx=coord(x,frame.x,frame.width,width),source=(sy*width+sx)*4,dest=(y*targetWidth+x)*4;
   output[dest]=pixels[source];output[dest+1]=pixels[source+1];output[dest+2]=pixels[source+2];output[dest+3]=255;
  }
 }
 return {status:'review',method:'mirrored-edge-strips',pixels:output,width:targetWidth,height:targetHeight,frame:{...frame},sampleBand:band,
  warning:'가장자리의 배경을 반사한 추정 결과입니다. 반복·이음과 남아 있는 글씨나 상품을 확인하세요. 가려진 배경의 복원은 아닙니다.'};
}
