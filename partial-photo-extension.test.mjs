import assert from 'node:assert/strict';
import {planPartialPhotoExtension,preparePartialPhotoSide} from './partial-photo-extension.mjs';

const object={},floor={},foreground={};
const photo={object,sourceBox:{x:0,y:20,width:100,height:80},outputBox:{x:50,y:20,width:100,height:80},paintIndex:1,sourcePixelsWidth:100,sourcePixelsHeight:80,axisAligned:true,opacity:1,composite:'source-over',hasEffects:false};
const layer=(object,box,extra={})=>({object,box,visible:true,hasEffects:false,...extra});
const base=()=>({photo,sourceWidth:100,sourceHeight:100,targetWidth:200,targetHeight:100,scale:1,offset:{x:50,y:0},layers:[layer(floor,{x:0,y:0,width:200,height:100}),layer(object,photo.outputBox),layer(foreground,{x:55,y:30,width:30,height:20})],isTrustedPhoto:p=>p===photo,isVerifiedBase:l=>l.object===floor});
let p=planPartialPhotoExtension(base());assert.equal(p.status,'review');assert.deepEqual(p.plans.map(x=>x.side),['left','right']);
assert.deepEqual(p.plans[0].rect,{x:0,y:20,width:50,height:80});assert.deepEqual(p.plans[1].rect,{x:150,y:20,width:50,height:80});
assert.deepEqual(p.blocked.map(x=>x.side),['top','bottom']);
const bytes=new Uint8ClampedArray(100*80*4);for(let i=0;i<100*80;i++){bytes[i*4]=20;bytes[i*4+1]=30;bytes[i*4+2]=40;bytes[i*4+3]=255;}
const mask=new Uint8Array(100*80);mask[40*100]=255;
let left=await preparePartialPhotoSide(p.plans[0],{pixels:bytes,foregroundMask:mask,isCurrent:()=>true});assert.equal(left.status,'unavailable');assert.equal(left.reason,'foreground-touches-edge');
let right=await preparePartialPhotoSide(p.plans[1],{pixels:bytes,foregroundMask:mask,isCurrent:()=>true});assert.equal(right.status,'review');
assert.deepEqual(right.placement,{left:50,top:20,scaleX:1,scaleY:1});assert.deepEqual(right.clip,{x:150,y:20,width:50,height:80});
for(let y=0;y<80;y++)for(let x=0;x<150;x++){const i=(y*150+x)*4;if(x<100)assert.equal(right.pixels[i+3],0,'source frame stays transparent');else assert.deepEqual([...right.pixels.slice(i,i+4)],[20,30,40,255]);}
let q=base();q.layers[0]=layer(floor,{x:0,y:0,width:200,height:100});q.isVerifiedBase=()=>false;p=planPartialPhotoExtension(q);assert.equal(p.status,'unavailable');assert(p.blocked.some(x=>x.reason==='would-cover-lower-layer'));
q=base();q.layers[0]=layer(floor,{x:0,y:0,width:1,height:1},{hasEffects:true});q.isVerifiedBase=()=>false;assert.equal(planPartialPhotoExtension(q).status,'unavailable');
q=base();q.isTrustedPhoto=()=>false;assert.equal(planPartialPhotoExtension(q).reason,'invalid-or-untrusted');
q=base();q.photo={...photo,sourceBox:{x:5,y:20,width:95,height:80},outputBox:{x:55,y:20,width:95,height:80}};q.isTrustedPhoto=()=>true;q.layers[1]=layer(object,q.photo.outputBox);assert.equal(planPartialPhotoExtension(q).status,'unavailable','inset image does not claim whole-slide edge');
q=base();q.photo={...photo,sourceBox:{x:-20,y:20,width:120,height:80},outputBox:{x:30,y:20,width:120,height:80}};q.layers[1]=layer(object,q.photo.outputBox);q.isTrustedPhoto=()=>true;assert.equal(planPartialPhotoExtension(q).reason,'source-outside-frame');
q=base();q.photo={...photo,outputBox:{...photo.outputBox,x:51}};q.isTrustedPhoto=()=>true;assert.equal(planPartialPhotoExtension(q).reason,'unsupported-geometry');
q=base();q.photo={...photo,outputBox:{...photo.outputBox,width:100-1e-12}};q.isTrustedPhoto=()=>true;assert.equal(planPartialPhotoExtension(q).plans.length,2,'floating point noise must not suppress valid directions');
q=base();q.photo={...photo,hasEffects:true};q.isTrustedPhoto=()=>true;assert.equal(planPartialPhotoExtension(q).reason,'unsupported-geometry');
q=base();p=planPartialPhotoExtension(q);assert.equal((await preparePartialPhotoSide(p.plans[1],{pixels:bytes,foregroundMask:mask,isCurrent:()=>false})).reason,'source-changed');
const controller=new AbortController();controller.abort();assert.equal((await preparePartialPhotoSide(p.plans[1],{pixels:bytes,foregroundMask:mask,isCurrent:()=>true,signal:controller.signal})).status,'cancelled');
const clearMask=new Uint8Array(mask.length);let current=true;const promise=preparePartialPhotoSide(p.plans[1],{pixels:bytes,foregroundMask:clearMask,isCurrent:()=>current});current=false;assert.equal((await promise).reason,'source-changed');
console.log('pass: partial band-only patches, per-side mask and paint-order guards, immutable source frame, stale and cancellation');
