import assert from 'node:assert/strict';
import {applyPhotoSeparation} from './photo-separation-transaction.mjs';
class FabricImage{constructor(el,options){this.element=el;Object.assign(this,options)}dispose(){this.disposed=true}}
function fixture(fail=''){
 const o={visible:true,layerLocked:false,originX:'center',originY:'center',left:31,top:42,width:40,height:30,scaleX:2,scaleY:3,angle:19,opacity:.7,sourceElementId:'slide:5',cutoutMethod:'pptx-original-object'};
 const below={name:'below'},above={name:'above'},objects=[below,o,above];
 const canvas={objects,active:o,getObjects(){return this.objects},size(){return this.objects.length},insertAt(i,item){this.objects.splice(i,0,item)},remove(item){const i=this.objects.indexOf(item);if(i>=0)this.objects.splice(i,1)},setActiveObject(item){this.active=item},requestRenderAll(){}};
 const state={width:100,height:100,epoch:3,revision:8,objects:[...objects]};let commits=0,guardCalls=0;
 const api={matchesAtomicLiveGuard(){return !(fail==='stale'&&++guardCalls>1)},validateCompositeProject(){if(fail==='validation')throw Error('validation failed')},prepareAtomicSnapshot(w,h,expected){assert.equal(o.visible,false);assert.equal(canvas.objects.length,5);assert.equal(expected.epoch,3);assert.equal(expected.revision,8);assert.equal(expected.decision.width,w);assert.equal(expected.decision.height,h);assert.equal(expected.decision.path,'background-only');assert.equal(expected.decision.status,'review');assert.equal(expected.decision.sourceEpoch,3);if(fail==='prepare')return Promise.reject(Error('prepare failed'));return Promise.resolve({id:1})},commitAtomic(w,h,expected,prepared){assert.equal(o.visible,false);assert.equal(canvas.objects.length,5);assert.deepEqual(prepared,{id:1});if(fail==='commit')throw Error('commit failed');commits++}};
 return {o,below,above,canvas,state,api,get commits(){return commits}};
}
const original='data:image/png;base64,source',bg={name:'background'},fg={name:'foreground'},F={FabricImage};
const run=q=>applyPhotoSeparation({canvas:q.canvas,object:q.o,state:q.state,F,background:bg,foreground:fg,original,group:'group',guard:{},isCurrent:()=>true,api:q.api});
let q=fixture();const promise=run(q);assert.deepEqual(q.canvas.objects,[q.below,q.o,q.above],'live scene restored during asynchronous preparation');const parts=await promise;
assert.deepEqual(q.canvas.objects,[q.below,q.o,parts[0],parts[1],q.above],'source paint order preserved');assert.equal(q.o.visible,false);assert.equal(q.o.layerLocked,true);assert.equal(q.o.originalPhotoSource,original);assert.equal(q.commits,1);
for(const p of parts)for(const k of ['originX','originY','left','top','scaleX','scaleY','angle','opacity'])assert.equal(p[k],q.o[k],k);
assert.equal(parts[0].layerRole,'other');assert.equal(parts[0].photoInstanceKind,'background');assert.equal(parts[1].photoInstanceKind,'part');
for(const reason of ['validation','prepare','stale','commit']){q=fixture(reason);await assert.rejects(run(q));assert.deepEqual(q.canvas.objects,[q.below,q.o,q.above],reason);assert.equal(q.o.visible,true);assert.equal(q.o.layerLocked,false);assert(!Object.hasOwn(q.o,'photoInstanceGroup'));assert.equal(q.commits,0);}
for(const key of ['outsideRecovery','trialOutsideRestore','__outsideRenderInstalled','__outsideTrialVisible','outsideRecoveryReview','_render']){
 q=fixture();q.o[key]=key==='_render'?()=>{}:{};await assert.rejects(run(q),/바깥 영역/);assert.deepEqual(q.canvas.objects,[q.below,q.o,q.above],key);assert.equal(q.commits,0);
}
console.log('pass: atomic preparation, stale guard, failure rollback, geometry and paint order');
