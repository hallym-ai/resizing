import assert from 'node:assert/strict';
import {extendPhotoBackground} from './photo-background-extension.mjs';

const width=24,height=24,pixels=new Uint8ClampedArray(width*height*4),mask=new Uint8Array(width*height);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const i=y*width+x;pixels[i*4]=40+x;pixels[i*4+1]=60+y;pixels[i*4+2]=70;pixels[i*4+3]=255;
 if(x>=9&&x<=14&&y>=9&&y<=14){mask[i]=255;pixels[i*4]=240;pixels[i*4+1]=0;pixels[i*4+2]=0;}
}
const original=Buffer.from(pixels),evidence={kind:'user-reviewed-mask',confirmed:true};
const layouts=[
 {targetWidth:32,targetHeight:24,frame:{x:4,y:0,width:24,height:24}},
 {targetWidth:24,targetHeight:32,frame:{x:0,y:4,width:24,height:24}},
 {targetWidth:32,targetHeight:32,frame:{x:4,y:4,width:24,height:24}},
 {targetWidth:40,targetHeight:30,frame:{x:8,y:3,width:24,height:24}},
 {targetWidth:40,targetHeight:28,frame:{x:5,y:2,width:30,height:24}},
];
for(const layout of layouts){
 const r=await extendPhotoBackground({pixels,width,height,foregroundMask:mask,evidence,...layout});
 assert.equal(r.status,'review');assert.equal(r.method,'mirrored-edge-strips');assert.match(r.warning,/가려진 배경의 복원은 아닙니다/);
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
  const i=(y*r.width+x)*4,inside=x>=layout.frame.x&&x<layout.frame.x+layout.frame.width&&y>=layout.frame.y&&y<layout.frame.y+layout.frame.height;
  if(inside)assert.deepEqual([...r.pixels.slice(i,i+4)],[0,0,0,0],'original frame must be untouched');
  else{assert.equal(r.pixels[i+3],255,'candidate covers every new margin');assert.notEqual(r.pixels[i],240,'central subject must not be repeated');}
 }
 assert.deepEqual(Buffer.from(pixels),original,'source unchanged');
}
const caseBase={pixels,width,height,foregroundMask:mask,evidence,...layouts[2]};
assert.equal((await extendPhotoBackground({...caseBase,evidence:{kind:'guess',confirmed:true}})).reason,'background-not-confirmed');
assert.equal((await extendPhotoBackground({...caseBase,evidence:{kind:'user-reviewed-mask',confirmed:false}})).reason,'background-not-confirmed');
assert.equal((await extendPhotoBackground({...caseBase,foregroundMask:null})).reason,'foreground-mask-required');
assert.equal((await extendPhotoBackground({...caseBase,foregroundMask:new Uint8Array(1)})).reason,'foreground-mask-required');
assert.equal((await extendPhotoBackground({...caseBase,targetWidth:12001})).reason,'invalid-or-too-large');
assert.equal((await extendPhotoBackground({...caseBase,frame:{x:-1,y:0,width:24,height:24}})).reason,'invalid-frame');
assert.equal((await extendPhotoBackground({...caseBase,targetWidth:24,targetHeight:24,frame:{x:0,y:0,width:24,height:24}})).reason,'no-new-margin');
const edgeMask=mask.slice();edgeMask[10*width]=1;
assert.equal((await extendPhotoBackground({...caseBase,foregroundMask:edgeMask})).reason,'foreground-touches-edge');
const translucent=pixels.slice();translucent[(10*width)*4+3]=254;
assert.equal((await extendPhotoBackground({...caseBase,pixels:translucent})).reason,'transparent-edge');
const separated=await extendPhotoBackground({...caseBase,pixels:new Uint8ClampedArray(width*height*4).fill(255),foregroundMask:null,evidence:{kind:'separated-background',confirmed:true}});
assert.equal(separated.status,'review','isolated background may be used with in-session confirmation');
const controller=new AbortController();controller.abort();assert.equal((await extendPhotoBackground({...caseBase,signal:controller.signal})).status,'cancelled');
const pendingController=new AbortController(),pending=extendPhotoBackground({...caseBase,signal:pendingController.signal});pendingController.abort();assert.equal((await pending).status,'cancelled','cancellation must not yield partial candidate');
// The operation snapshots caller-owned buffers before yielding.
const input=pixels.slice(),inputMask=mask.slice(),p=extendPhotoBackground({...caseBase,pixels:input,foregroundMask:inputMask});input.fill(0);inputMask.fill(255);
assert.equal((await p).status,'review');
console.log('pass: outside-only pixels, five ratios, no subject duplication, strict edge/evidence checks, size limits, cancellation and input snapshot');
