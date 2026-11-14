import assert from 'node:assert/strict';
import {inferInitialPptxSolid,capturePartialSource,planPartialSolid,applyPartialSolid} from './partial-solid-transaction.mjs';
let pixels=new Uint8ClampedArray(Array(64).fill(0).flatMap(()=>[255,255,255,255]));
globalThis.document={createElement(){return {getContext(){return {drawImage(){},getImageData(){return{data:pixels}}}}}}};
const source='data:image/png;base64,fixture';
const make=()=>{const el={tagName:'IMG',naturalWidth:8,naturalHeight:8,complete:true,src:source};return {type:'image',originX:'left',originY:'top',left:0,top:75,width:8,height:8,scaleX:12.5,scaleY:3.125,opacity:1,visible:true,layerRole:'subject',layerRoleInferred:true,sourceElementType:'picture',cutoutMethod:'pptx-original-object',sourceElementId:'slide:2',getElement(){return el},getSrc(){return el.src}}};
const text={type:'textbox',visible:true,sourceElementId:'slide:3',text:'PRICE',getBoundingRect(){return{left:60,top:78,width:30,height:10}}};
const scene=o=>({sourceFormat:'pptx',inputKind:'layered',revision:0,epoch:2,width:100,height:100,objects:[o,text]});
let o=make(),s=scene(o);assert(inferInitialPptxSolid(s,o));assert(capturePartialSource(s,o));
for(const [k,v] of [['layerLocked',true],['gridSourceUserEdited',true],['sourceElementType','shape'],['cutoutMethod','unresolved'],['sourceImageFill',true],['layoutManualRole','logo'],['layerRole','logo']]){o=make();o[k]=v;s=scene(o);assert.equal(inferInitialPptxSolid(s,o),false,k)}
o=make();s=scene(o);s.revision=1;assert(inferInitialPptxSolid(s,o),'unedited source revalidated at later revision');o.gridSourceUserEdited=true;assert.equal(inferInitialPptxSolid(s,o),false,'edited source');
o=make();s=scene(o);s.objects=[o];assert.equal(inferInitialPptxSolid(s,o),false,'no independent foreground');
o=make();o.left=4;s=scene(o);assert.equal(inferInitialPptxSolid(s,o),false,'not edge to edge');
o=make();s=scene(o);s.sourceFormat='json';assert.equal(inferInitialPptxSolid(s,o),false,'serialized provenance untrusted');
o=make();s=scene(o);pixels[0]=254;assert.equal(inferInitialPptxSolid(s,o),false,'one changed pixel');
pixels=new Uint8ClampedArray(Array(64).fill(0).flatMap(()=>[255,255,255,255]));
for(const flag of ['shadow','__outsideTrialVisible','trialOutsideRestore','clipPath','type']){
 o=make();const lower={visible:true,[flag]:flag==='type'?'group':true,getBoundingRect(){return{left:0,top:0,width:1,height:1}}};s=scene(o);s.objects.unshift(lower);assert(inferInitialPptxSolid(s,o));let pr=capturePartialSource(s,o);o.left+=50;assert.equal(planPartialSolid(s,pr,{width:200,height:100,scale:1,offset:{x:50,y:0}},()=>false),null,flag);
}
// Reopen derives advisory record only from a previously applied geometry.
o=make();o.set=function(v){Object.assign(this,v)};o.setCoords=function(){};s=scene(o);assert(inferInitialPptxSolid(s,o));let saved=capturePartialSource(s,o);o.left=50;let extension=planPartialSolid(s,saved,{width:200,height:100,scale:1,offset:{x:50,y:0}},()=>false);assert(extension);assert(applyPartialSolid(s,extension));s.width=200;s.sourceFormat='json';assert(inferInitialPptxSolid(s,o),'reopen with rechecked image, geometry and frame');
const record=structuredClone(o.partialSolidProvenance);o.partialSolidProvenance.sourceKey='mismatch';assert.equal(inferInitialPptxSolid(s,o),false,'source mismatch');o.partialSolidProvenance=structuredClone(record);o.partialSolidProvenance.frame.width++;assert.equal(inferInitialPptxSolid(s,o),false,'frame mismatch');o.partialSolidProvenance=structuredClone(record);o.gridSourceUserEdited=true;assert.equal(inferInitialPptxSolid(s,o),false,'manual edit after reopening');o.gridSourceUserEdited=false;o.layerLocked=true;assert.equal(inferInitialPptxSolid(s,o),false,'locked after reopening');
const budget={remaining:128};for(let i=0;i<3;i++){o=make();s=scene(o);assert.equal(inferInitialPptxSolid(s,o,budget),i<2,'scene cumulative scan budget');}assert.equal(budget.remaining,0);
console.log('pass: pptx, json fallback, independent role, edit/lock, source, lower-layer effects and flat-color negative guards');







