import assert from 'node:assert/strict';
import {inferInitialPptxSolid,registerIndependentRegion,revokeIndependentRegion,capturePartialSource,planPartialSolid,applyPartialSolid} from './partial-solid-transaction.mjs';
let pixels=new Uint8ClampedArray(Array(64).fill(0).flatMap(()=>[255,255,255,255]));
globalThis.document={createElement(){return {getContext(){return {drawImage(){},getImageData(){return{data:pixels}}}}}}};
const source='data:image/png;base64,fixture';
const make=()=>{const el={tagName:'IMG',naturalWidth:8,naturalHeight:8,complete:true,src:source};return {type:'image',originX:'left',originY:'top',left:0,top:75,width:8,height:8,scaleX:12.5,scaleY:3.125,opacity:1,visible:true,layerRole:'subject',layerRoleInferred:true,sourceElementType:'picture',cutoutMethod:'pptx-original-object',sourceElementId:'slide:2',getElement(){return el},getSrc(){return el.src},set(v){Object.assign(this,v)},setCoords(){}}};
const text={type:'textbox',visible:true,sourceElementId:'slide:3',text:'PRICE',getBoundingRect(){return{left:60,top:78,width:30,height:10}}};
const scene=o=>({sourceFormat:'pptx',inputKind:'layered',revision:0,epoch:2,width:100,height:100,objects:[o,text]});
const grant=(s,o,budget)=>registerIndependentRegion(s,o,{object:o,independent:true,epoch:s.epoch,kind:'user-confirmed'},budget);

// The exact old inference fixture must remain artwork, including on reopen.
for(const format of ['pptx','json']){
 const o=make(),s=scene(o);s.sourceFormat=format;
 o.partialSolidProvenance={version:1,frame:{width:100,height:100},geometry:{left:0,top:75,width:8,height:8,scaleX:12.5,scaleY:3.125},sourceKey:'advisory'};
 assert.equal(inferInitialPptxSolid(s,o),false);
 assert.equal(capturePartialSource(s,o),null);
 assert.equal(registerIndependentRegion(s,o,{object:o,independent:true,epoch:s.epoch,kind:'independent-pptx-review'}),false,'old inferred evidence cannot grant authority');
}
let o=make(),s=scene(o);assert(grant(s,o));assert(capturePartialSource(s,o));
for(const [key,value] of [['layerLocked',true],['gridSourceUserEdited',true],['shadow',{}],['opacity',.5],['angle',5]]){
 o=make();s=scene(o);o[key]=value;assert.equal(grant(s,o),false,key);
}
o=make();s=scene(o);pixels[0]=254;assert.equal(grant(s,o),false,'one changed pixel rejects confirmed image too');
pixels=new Uint8ClampedArray(Array(64).fill(0).flatMap(()=>[255,255,255,255]));
for(const flag of ['shadow','__outsideTrialVisible','trialOutsideRestore','clipPath','type']){
 o=make();const lower={visible:true,[flag]:flag==='type'?'group':true,getBoundingRect(){return{left:0,top:0,width:1,height:1}}};s=scene(o);s.objects.unshift(lower);assert(grant(s,o));const proof=capturePartialSource(s,o);o.left+=50;assert.equal(planPartialSolid(s,proof,{width:200,height:100,scale:1,offset:{x:50,y:0}},()=>false),null,flag);
}
// Explicit session evidence keeps the existing safe planner and pixel guards.
o=make();s=scene(o);assert(grant(s,o));const proof=capturePartialSource(s,o);o.left=50;
const plan=planPartialSolid(s,proof,{width:200,height:100,scale:1,offset:{x:50,y:0}},()=>false);assert(plan);assert(applyPartialSolid(s,plan));
assert.equal(o.left,0);assert.equal(o.width*o.scaleX,200);
const reopened=make();Object.assign(reopened,{...o,getElement:reopened.getElement,getSrc:reopened.getSrc});s={...s,width:200,sourceFormat:'json',objects:[reopened,text]};
assert.equal(inferInitialPptxSolid(s,reopened),false);assert.equal(capturePartialSource(s,reopened),null,'serialized provenance is not session authority');
revokeIndependentRegion(o);assert.equal(capturePartialSource(scene(o),o),null);
const budget={remaining:128};for(let i=0;i<3;i++){o=make();s=scene(o);assert.equal(grant(s,o,budget),i<2,'cumulative image scan budget');}assert.equal(budget.remaining,0);
console.log('pass: no inferred/reopened authority; explicit semantic evidence, full-pixel scan, effects, locks, planning and budget guards');
