import assert from 'node:assert/strict';
import {partitionBackground,resizeBackgroundOnly,canonicalBitmapProvenance} from './background-only.mjs';
import {installOutsideRenderGuard} from './outside-render-guard.mjs';
import {registerTrustedOutsideReference,hasTrustedOutsideReference,hasTrustedOutsideCandidate} from './final-outside-overlay.mjs';

globalThis.window=new EventTarget();
globalThis.document={createElement(){let image;return {getContext(){return {clearRect(){},fillRect(){},drawImage(el){image=el},getImageData(){return {data:image?new Uint8ClampedArray([255,0,0,255,0,0,255,255,255,0,0,255,0,0,255,255]):new Uint8ClampedArray([255,255,255,255])}}}}}}};
class Point{constructor(x,y){this.x=x;this.y=y}}
class FabricImage{_render(){}shouldCache(){} _toSVG(){return []}}
const F={Point,FabricImage};
function shape(props){return {visible:true,originX:'left',originY:'top',left:0,top:0,width:100,height:100,scaleX:1,scaleY:1,opacity:1,...props,getBoundingRect(){return {left:this.left,top:this.top,width:this.width*this.scaleX,height:this.height*this.scaleY}},getCenterPoint(){return new Point(this.left+this.width*this.scaleX/2,this.top+this.height*this.scaleY/2)},set(v){Object.assign(this,v)},setCoords(){},setPositionByOrigin(p){this.left=p.x-this.width*this.scaleX/2;this.top=p.y-this.height*this.scaleY/2}}}
for(const format of ['pptx','json']){
 const plate=shape({type:'rect',fill:'#ffffff',layerRole:'background'});
 const el={tagName:'IMG',naturalWidth:2,naturalHeight:2,src:'data:image/png;base64,flattened'};
 const picture=shape({type:'image',width:2,height:2,scaleX:50,scaleY:50,layerRole:'background',layerRoleInferred:true,layerLocked:true,sourceElementType:'picture',sourceElementId:'slide:2',cutoutMethod:'pptx-original-object',getElement:()=>el,getSrc:()=>el.src,nativeBitmapProvenance:{version:1,lockOrigin:'import-inferred'}});
 const foreground=[3,4].map(id=>shape({type:'textbox',text:'KEEP',left:10,top:20,width:20,height:10,layerRole:'subject',sourceElementId:'slide:'+id,cutoutMethod:'pptx-original-object'}));
 const state={F,sourceFormat:format,inputKind:'layered',width:100,height:100,epoch:1,revision:0,objects:[plate,picture,...foreground]};
 const parts=partitionBackground(state);
 assert(parts.foreground.some(p=>p.object===picture));assert(parts.unresolved.some(p=>p.id===1));assert.equal(canonicalBitmapProvenance(state,picture),null);
 const result=resizeBackgroundOnly(state,200,100);
 assert.equal(picture.scaleX,picture.scaleY,'flattened lettering/products keep aspect ratio');assert.equal(picture.width*picture.scaleX,100);assert.equal(picture.left,50);
 assert.equal(plate.width,200,'verified solid background still fills canvas');assert.equal(result.stretch,false);assert.equal(result.status,'review');
}

// Render spies prove no object-local outer pixels are drawn without trust.
let baseDraws=0,patchDraws=0;
const element={},src='data:image/png;base64,original',outerSrc='data:image/png;base64,outer';
const canvas={viewportTransform:[1,0,0,1,0,0],_renderOverlay(){},getObjects(){return this.objects},on(){},off(){}};
const ref={type:'image',visible:false,layerLocked:true,selectable:false,layerRole:'background',width:100,height:100,getElement:()=>element,getSrc:()=>src,calcTransformMatrix:()=>[1,0,0,1,50,50],canvas};
const meta={baseSourceDigest:'fixture',original:{left:0,top:0,width:2,height:2,scaleX:1,scaleY:1,cropX:0,cropY:0},outer:{src:outerSrc,left:-30,top:0,width:3,height:2},slide:{width:100,height:100}};
const candidate={type:'image',visible:true,layerRole:'subject',sourceElementId:'slide:2',width:2,height:2,originX:'left',originY:'top',trialOutsideRestore:meta,__outsideTrialVisible:true,__outsideTrialImage:{src:outerSrc,naturalWidth:3,naturalHeight:2},canvas,getElement:()=>element,getSrc:()=>src,calcTransformMatrix:()=>[1,0,0,1,1,1],_render(){baseDraws++}};
canvas.objects=[ref,candidate];installOutsideRenderGuard(candidate);
const ctx={canvas:{width:200,height:100},drawImage(){patchDraws++},save(){},restore(){},transform(){},getTransform(){return {a:1,b:0,c:0,d:1,e:0,f:0,is2D:true}},setTransform(){},beginPath(){},rect(){},clip(){},globalAlpha:1};
candidate._render(ctx);assert.equal(baseDraws,1);assert.equal(patchDraws,0);assert.equal(candidate.__outsideReview,true);
const state={sourceFormat:'pptx',sourceKey:'source',revision:0,objects:canvas.objects};
const source={sourceFormat:'pptx',key:'source',nativeProject:{width:100,height:100,analysis:{engine:'pptx-original-objects'},scene:{objects:[{type:'Image',visible:false,layerLocked:true,layerRole:'background',left:0,top:0,width:100,height:100,scaleX:1,scaleY:1,originX:'left',originY:'top',src},{sourceElementId:'slide:2',src,outsideRecovery:{...meta,status:'unverified'}}]}}};
assert(registerTrustedOutsideReference(state,source));assert(hasTrustedOutsideReference(canvas));
assert(hasTrustedOutsideCandidate(candidate),'original verified object can contribute outside bounds');
// Exercise the real resize path: a trusted fallback patch at x=-30 must be
// included in whole-picture fit, but not in original-frame fit.
for(const [tw,th] of [[1080,1080],[1920,1080],[1080,1920],[1080,1350],[1379,611]]){
 const plate=shape({type:'rect',fill:'#ffffff',layerRole:'background'});
 for(const obj of [ref,candidate])Object.assign(obj,{left:0,top:0,scaleX:1,scaleY:1,getBoundingRect:shape({}).getBoundingRect,getCenterPoint:shape({}).getCenterPoint,set:shape({}).set,setCoords(){},setPositionByOrigin:shape({}).setPositionByOrigin});
 canvas.objects=[ref,plate,candidate];const scene={F,sourceFormat:'pptx',inputKind:'layered',width:100,height:100,epoch:1,revision:0,objects:canvas.objects};
 const whole=resizeBackgroundOnly(scene,tw,th,{includeWholePictures:true});
 assert(Math.abs(whole.foregroundScale-Math.min(tw/130,th/100))<1e-8,'trusted patch bounds included');
 for(const obj of [ref,candidate])Object.assign(obj,{left:0,top:0,scaleX:1,scaleY:1});Object.assign(plate,{left:0,top:0,width:100,height:100,scaleX:1,scaleY:1});
 const original=resizeBackgroundOnly(scene,tw,th,{includeWholePictures:false});
 assert(Math.abs(original.foregroundScale-Math.min(tw/100,th/100))<1e-8,'original frame mode stays unchanged');
 for(const obj of [ref,candidate])Object.assign(obj,{left:0,top:0,scaleX:1,scaleY:1});Object.assign(plate,{left:0,top:0,width:100,height:100,scaleX:1,scaleY:1});
 const byDefault=resizeBackgroundOnly(scene,tw,th);
 assert(Math.abs(byDefault.foregroundScale-Math.min(tw/130,th/100))<1e-8,'default includes trusted outside patch bounds');
}
canvas.objects=[ref,candidate];
candidate._render(ctx);canvas._renderOverlay(ctx);assert.equal(patchDraws,1,'trusted canvas overlay retains outside patch');assert.equal(candidate.__outsideReview,false);
// A new history/JSON object has no trusted object capability even on same canvas.
const restored={...candidate,__outsideRenderInstalled:false,_render(){baseDraws++}};installOutsideRenderGuard(restored);canvas.objects=[ref,restored];restored._render(ctx);canvas._renderOverlay(ctx);assert.equal(patchDraws,1);assert.equal(restored.__outsideReview,true);
assert.equal(hasTrustedOutsideCandidate(restored),false,'restored JSON/history object cannot authorize a fit');
canvas.objects=[ref,candidate];ref.layerLocked=false;candidate._render(ctx);assert.equal(patchDraws,1);assert.equal(candidate.__outsideReview,true,'lost anchor never activates a fallback patch renderer');
assert.equal(hasTrustedOutsideCandidate(candidate),false,'invalidated reference cannot authorize a fit');
await new Promise(resolve=>queueMicrotask(resolve));
console.log('pass: PPTX/JSON ambiguous bitmap protected; solid background retained; trusted overlay only; restored candidate and revoked reference held');
