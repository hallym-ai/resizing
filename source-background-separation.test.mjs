import assert from 'node:assert/strict';
import {sourceBackgroundParts,sourceObjectCoverage,withSeparationVisibility} from './source-background-separation.mjs';
import {separationPreviews} from './background-only.mjs';
import {captureMatchesSlideSolid} from './pptx-slide-solid.mjs';

const canvas={backgroundColor:'#e25744',requestRenderAll(){}};
const bg={visible:true,canvas,cutoutMethod:'pptx-slide-background',sourceElementType:'slide-background',fill:'#e25744'};
const footer={visible:true,canvas,layerRole:'background',sourceElementType:'picture',sourceElementId:'slide:2'};
const letter={visible:true,canvas,layerRole:'other',sourceElementType:'text',sourceElementId:'slide:3'};
const hiddenRef={visible:false,canvas,layerRole:'background'};
const hiddenArtwork={visible:false,canvas,sourceElementId:'slide:4'};
const state={objects:[hiddenRef,bg,footer,letter,hiddenArtwork]};
const parts=sourceBackgroundParts(state);
assert.deepEqual(parts.backgrounds.map(p=>p.object),[bg]);assert.deepEqual(parts.foreground.map(p=>p.object),[footer,letter],'all other source roles stay elements');
const visibility=state.objects.map(o=>o.visible);
for(const kind of ['background','foreground']){
 withSeparationVisibility(state,parts,kind,()=>{
  assert.equal(canvas.backgroundColor,'','canvas red removed from transparent element view');
  assert.equal(bg.visible,kind==='background');assert.equal(letter.visible,kind==='foreground');assert.equal(footer.visible,kind==='foreground');assert.equal(hiddenRef.visible,false);assert.equal(hiddenArtwork.visible,false);
 });
 assert.deepEqual(state.objects.map(o=>o.visible),visibility);assert.equal(canvas.backgroundColor,'#e25744');
}
assert.throws(()=>withSeparationVisibility(state,parts,'foreground',()=>{throw Error('snapshot failed')}),/snapshot failed/);
assert.deepEqual(state.objects.map(o=>o.visible),visibility);assert.equal(canvas.backgroundColor,'#e25744');
let snapshots=0,disposed=0;
const previews=separationPreviews(state,()=>{
 snapshots++;assert.equal(bg.visible,snapshots===1);assert.equal(letter.visible,snapshots===2);assert.equal(canvas.backgroundColor,'');
 return {set width(v){if(v===0)disposed++},set height(v){},toDataURL:()=>snapshots===1?'background-png':'transparent-elements-png'};
},parts);
assert.equal(previews.background,'background-png');assert.equal(previews.foreground,'transparent-elements-png');assert.equal(disposed,2);assert.deepEqual(state.objects.map(o=>o.visible),visibility);
const nodes=Array.from({length:32},(_,i)=>({info:{id:'slide:'+(i+2)}}));
const objects=nodes.map(n=>({sourceElementId:n.info.id}));objects.push({...objects[0]});
assert.deepEqual(sourceObjectCoverage(nodes,objects),{expected:32,retained:32,missing:[]},'split shape/text not double counted');
objects.splice(5,1);assert.deepEqual(sourceObjectCoverage(nodes,objects),{expected:32,retained:31,missing:['slide:7']});
assert.deepEqual(sourceObjectCoverage(nodes.slice(0,2),objects,['slide:2','slide:3','slide:7']),{expected:3,retained:2,missing:['slide:7']},'source XML expectation detects objects absent from renderer DOM');
assert.equal(sourceBackgroundParts({objects:[{visible:true,layerRole:'background'}]}).separated,false,'role alone does not prove slide background');
const red=new Uint8ClampedArray([226,87,68,255,226,87,68,255]);
const capture={width:2,height:1,getContext:()=>({getImageData:()=>({data:red})})};
assert(captureMatchesSlideSolid(capture,'#e25744'));red[4]=225;assert.equal(captureMatchesSlideSolid(capture,'#e25744'),false,'artwork pixel rejects solid replacement');red[4]=226;red[7]=254;assert.equal(captureMatchesSlideSolid(capture,'#e25744'),false,'alpha mismatch rejects solid replacement');
console.log('pass: explicit background only; all element roles retained; transparent views and failure restore; 32-source inventory and missing ID; exact slide RGBA guard');
