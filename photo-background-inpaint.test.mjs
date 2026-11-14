import assert from 'node:assert/strict';
import {estimateHiddenBackground} from './photo-background-inpaint.mjs';
const width=32,height=32,clean=new Uint8ClampedArray(width*height*4),mask=new Uint8Array(width*height);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const i=y*width+x;clean[i*4]=20+2*x+y;clean[i*4+1]=30+x+2*y;clean[i*4+2]=100+x-y;clean[i*4+3]=255;
 if(x>=11&&x<=19&&y>=10&&y<=20)mask[i]=255;
}
const input=clean.slice();for(let i=0;i<mask.length;i++)if(mask[i]){input[4*i]=250;input[4*i+1]=1;input[4*i+2]=200;}
const inputBefore=input.slice(),maskBefore=mask.slice(),evidence={kind:'user-reviewed-mask',confirmed:true};
const options={pixels:input,mask,width,height,evidence};
const result=await estimateHiddenBackground(options);
assert.equal(result.status,'review');assert.equal(result.maskPixels,99);assert.match(result.warning,/실제 가려진 배경의 복원은 아니/);
for(let i=0;i<mask.length;i++){
 for(let k=0;k<4;k++)if(!mask[i])assert.equal(result.pixels[i*4+k],input[i*4+k],'all unmasked source bytes are exact');
 else assert(Math.abs(result.pixels[i*4+k]-clean[i*4+k])<=1,'linear gradient fixture');
}
assert.deepEqual(input,inputBefore);assert.deepEqual(mask,maskBefore);
const solid=new Uint8ClampedArray(width*height*4);for(let i=0;i<width*height;i++)solid.set([71,95,112,255],4*i);
for(let i=0;i<mask.length;i++)if(mask[i])solid.set([240,20,20,255],4*i);
const solidResult=await estimateHiddenBackground({...options,pixels:solid});assert.equal(solidResult.status,'review');
for(let i=0;i<mask.length;i++)if(mask[i])assert.deepEqual([...solidResult.pixels.slice(i*4,i*4+4)],[71,95,112,255]);
assert.equal((await estimateHiddenBackground({...options,evidence:null})).reason,'mask-not-reviewed');
assert.equal((await estimateHiddenBackground({...options,evidence:{kind:'user-reviewed-mask',confirmed:false}})).reason,'mask-not-reviewed');
assert.equal((await estimateHiddenBackground({...options,mask:new Uint8Array(2)})).reason,'invalid-or-too-large');
assert.equal((await estimateHiddenBackground({...options,mask:new Uint8Array(mask.length)})).reason,'empty-mask');
const soft=mask.slice();soft[12*width+12]=128;assert.equal((await estimateHiddenBackground({...options,mask:soft})).reason,'soft-mask-review-needed');
for(const xy of [[0,12],[1,12],[30,12],[31,12],[12,1]]){const edge=mask.slice();edge[xy[1]*width+xy[0]]=255;assert.equal((await estimateHiddenBackground({...options,mask:edge})).reason,'mask-touches-edge');}
const noisy=input.slice();for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=(y*width+x)*4;if(!mask[y*width+x])noisy[p]=(x%2)*255;}
assert.equal((await estimateHiddenBackground({...options,pixels:noisy})).reason,'complex-background-edge');
const transparent=input.slice();for(let y=9;y<=21;y++)for(let x=10;x<=20;x++)if(!mask[y*width+x])transparent[(y*width+x)*4+3]=0;
assert.equal((await estimateHiddenBackground({...options,pixels:transparent})).reason,'insufficient-opaque-background');
const bigMask=new Uint8Array(mask.length);for(let y=2;y<30;y++)for(let x=2;x<30;x++)bigMask[y*width+x]=255;
assert.equal((await estimateHiddenBackground({...options,mask:bigMask})).reason,'mask-too-large');
const abort=new AbortController();abort.abort();assert.equal((await estimateHiddenBackground({...options,signal:abort.signal})).status,'cancelled');
const during=new AbortController(),job=estimateHiddenBackground({...options,signal:during.signal});during.abort();assert.equal((await job).status,'cancelled');
const mutable=input.slice(),mutableMask=mask.slice(),pending=estimateHiddenBackground({...options,pixels:mutable,mask:mutableMask});mutable.fill(0);mutableMask.fill(0);assert.equal((await pending).status,'review','snapshot before yielding');
console.log('pass: preserved original unmasked bytes, smooth/solid candidates, binary mask/edge/complexity/opacity/budget guards, cancellation and input snapshots');
