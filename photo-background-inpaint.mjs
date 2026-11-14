// Non-generative background candidate. It cannot recover the true hidden
// background; results must be reviewed and must never replace the source.
const MAX_SOURCE_PIXELS=2_000_000,MAX_SIDE=12_000,MAX_MASK_PIXELS=250_000,MAX_BOX_AREA=300_000,MAX_BOX_SIDE=700;
const byteArray=a=>a instanceof Uint8Array||a instanceof Uint8ClampedArray;
const unavailable=reason=>({status:'unavailable',reason});
const cancelled=()=>({status:'cancelled',reason:'cancelled'});

// Mask: 0 is unchanged background, 255 is user-reviewed foreground to fill.
// This entry point requires a reviewed in-session mask, not a JSON flag or an
// unreviewed model prediction. Caller must recheck scene/source revisions and
// let the user compare the proposal before applying it.
export async function estimateHiddenBackground({pixels,mask,width,height,evidence,signal}){
 if(signal?.aborted)return cancelled();
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<3||height<3||width>MAX_SIDE||height>MAX_SIDE||width*height>MAX_SOURCE_PIXELS||
    !byteArray(pixels)||pixels.length!==width*height*4||!byteArray(mask)||mask.length!==width*height)return unavailable('invalid-or-too-large');
 if(evidence?.kind!=='user-reviewed-mask'||evidence.confirmed!==true)return unavailable('mask-not-reviewed');
 // Never observe changing input across async yields.
 const src=new Uint8ClampedArray(pixels),m=new Uint8Array(mask),n=width*height;
 let count=0,left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++){
  if(signal?.aborted)return cancelled();
  if((y&63)===0)await new Promise(resolve=>setTimeout(resolve,0));
  for(let x=0;x<width;x++){
   const value=m[y*width+x];if(!value)continue;
   // Soft mask pixels can include both object and unknown background. Keeping
   // them untouched leaves a fringe; changing them violates exact preservation.
   if(value!==255)return unavailable('soft-mask-review-needed');
   if(x<2||y<2||x>=width-2||y>=height-2)return unavailable('mask-touches-edge');
   count++;if(count>MAX_MASK_PIXELS||count>n*.25)return unavailable('mask-too-large');
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
 }
 if(!count)return unavailable('empty-mask');
 const bw=right-left+1,bh=bottom-top+1,area=bw*bh;
 if(bw>MAX_BOX_SIDE||bh>MAX_BOX_SIDE||area>MAX_BOX_AREA)return unavailable('mask-bounds-too-large');
 const sums=new Float32Array(area*3),votes=new Uint8Array(area);
 const index=(x,y)=>(y-top)*bw+x-left;
 const rgb=(x,y,k)=>src[(y*width+x)*4+k];
 const usable=(x,y)=>x>=0&&x<width&&y>=0&&y<height&&m[y*width+x]===0&&src[(y*width+x)*4+3]===255;
 const diff=(x1,y1,x2,y2)=>Math.max(...[0,1,2].map(k=>Math.abs(rgb(x1,y1,k)-rgb(x2,y2,k))));
 // When observed pixels immediately outside a hole contain a strong edge,
 // naive interpolation is likely to clone/erase content rather than estimate a
 // smooth background. Such cases are withheld for a different method.
 let complex=false;
 function addRun(start,end,fixed,horizontal){
  const ax=horizontal?start-1:fixed,ay=horizontal?fixed:start-1,bx=horizontal?end+1:fixed,by=horizontal?fixed:end+1;
  if(!usable(ax,ay)||!usable(bx,by))return;
  const beforeX=horizontal?ax-1:ax,beforeY=horizontal?ay:ay-1,afterX=horizontal?bx+1:bx,afterY=horizontal?by:by+1;
  if(usable(beforeX,beforeY)&&diff(ax,ay,beforeX,beforeY)>32||usable(afterX,afterY)&&diff(bx,by,afterX,afterY)>32){complex=true;return;}
  const denom=end-start+2;
  for(let t=start;t<=end;t++){
   const x=horizontal?t:fixed,y=horizontal?fixed:t,i=index(x,y),w=(t-start+1)/denom;
   for(let k=0;k<3;k++)sums[i*3+k]+=rgb(ax,ay,k)*(1-w)+rgb(bx,by,k)*w;
   votes[i]++;
  }
 }
 for(let y=top;y<=bottom;y++){
  if(signal?.aborted)return cancelled();if(((y-top)&31)===0)await new Promise(resolve=>setTimeout(resolve,0));
  for(let x=left;x<=right;){if(!m[y*width+x]){x++;continue}const start=x;while(x<=right&&m[y*width+x])x++;addRun(start,x-1,y,true);}
 }
 for(let x=left;x<=right;x++){
  if(signal?.aborted)return cancelled();if(((x-left)&31)===0)await new Promise(resolve=>setTimeout(resolve,0));
  for(let y=top;y<=bottom;){if(!m[y*width+x]){y++;continue}const start=y;while(y<=bottom&&m[y*width+x])y++;addRun(start,y-1,x,false);}
 }
 if(complex)return unavailable('complex-background-edge');
 const output=src.slice();let filled=0;
 for(let y=top;y<=bottom;y++){
  if(signal?.aborted)return cancelled();if(((y-top)&31)===0)await new Promise(resolve=>setTimeout(resolve,0));
  for(let x=left;x<=right;x++){
   if(!m[y*width+x])continue;const i=index(x,y);if(!votes[i])return unavailable('insufficient-opaque-background');
   const out=(y*width+x)*4;for(let k=0;k<3;k++)output[out+k]=Math.round(sums[i*3+k]/votes[i]);output[out+3]=255;filled++;
  }
 }
 return {status:'review',method:'bounded-linear-background-estimate',pixels:output,width,height,maskPixels:filled,
  bounds:{x:left,y:top,width:bw,height:bh},warning:'가려진 영역은 주변 색을 이용한 추정입니다. 실제 가려진 배경의 복원은 아니며 질감·경계·상품 잔상을 확인하세요.'};
}
