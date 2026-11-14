import assert from 'node:assert/strict';
import {resizeBackgroundOnly} from './background-only.mjs';
import {captureFooterSource} from './band-runtime.mjs';
import {planAnchoredFooter} from './anchored-band.mjs';

// A minimal solid-image canvas is sufficient to exercise the real old footer
// recognizer as well as the current resize operation; it is not a PPTX render.
globalThis.document={createElement(){return {width:0,height:0,getContext(){return {clearRect(){},fillRect(){},drawImage(){},getImageData(x,y,w=1,h=1){return {data:new Uint8ClampedArray(w*h*4).fill(255)}}}}}}};
class Point{constructor(x,y){this.x=x;this.y=y}}
class FabricImage{_render(){}shouldCache(){} _toSVG(){return []}}
const F={Point,FabricImage};
function shape(props){return {visible:true,originX:'left',originY:'top',left:0,top:0,width:100,height:100,scaleX:1,scaleY:1,opacity:1,...props,getBoundingRect(){return {left:this.left,top:this.top,width:this.width*this.scaleX,height:this.height*this.scaleY}},getCenterPoint(){return new Point(this.left+this.width*this.scaleX/2,this.top+this.height*this.scaleY/2)},set(v){Object.assign(this,v)},setCoords(){},setPositionByOrigin(p){this.left=p.x-this.width*this.scaleX/2;this.top=p.y-this.height*this.scaleY/2}}}
function fixture(format){
 const plate=shape({type:'rect',fill:'#e25744',layerRole:'background'}),el={tagName:'IMG',naturalWidth:4,naturalHeight:4,src:'data:image/png;base64,fixture'};
 const band=shape({type:'image',width:4,height:4,scaleX:25,scaleY:2.5,top:90,layerRole:'subject',sourceElementType:'picture',cutoutMethod:'pptx-original-object',getElement:()=>el,getSrc:()=>el.src});
 const label=shape({type:'textbox',left:40,top:92,width:20,height:4,text:'미리카페',layerRole:'other',sourceElementType:'text'});
 const picture=shape({type:'image',left:20,top:20,width:30,height:40,layerRole:'subject',sourceElementType:'picture'});
 return {F,sourceFormat:format,inputKind:'layered',width:100,height:100,epoch:1,revision:0,objects:[plate,band,label,picture]};
}
for(const format of ['pptx','json'])for(const includeWholePictures of [true,false])for(const [w,h] of [[1080,1080],[1920,1080],[1080,1920],[1080,1350],[1379,611]]){
 const state=fixture(format),[plate,band,label,picture]=state.objects,old=state.objects.map(o=>o.getBoundingRect()),footerSource=captureFooterSource(state);
 const result=resizeBackgroundOnly(state,w,h,{includeWholePictures});
 for(const i of [1,2,3]){
  const actual=state.objects[i].getBoundingRect(),base=old[i],k=result.foregroundScale,p=result.foregroundOffset;
  for(const [key,expected] of Object.entries({left:base.left*k+p.x,top:base.top*k+p.y,width:base.width*k,height:base.height*k}))assert(Math.abs(actual[key]-expected)<1e-8,`${format} ${w}x${h} item ${i} ${key}`);
 }
 assert.equal(plate.width,w);assert.equal(plate.height,h);assert.equal(globalThis.coexFooterPrototype,null);
 if(w===1920&&h===1080){const items=footerSource.items.map(it=>({...it,outputBox:(()=>{const b=state.objects[it.id].getBoundingRect();return {x:b.left,y:b.top,w:b.width,h:b.height}})()}));const previous=planAnchoredFooter({...footerSource,items,targetWidth:w,targetHeight:h});assert(previous,'fixture reaches the previous automatic footer behavior');assert.notEqual(previous.bandBox.w,band.getBoundingRect().width,'old behavior would stretch the foreground strip');}
 // A second resize is another single affine transform of each foreground.
 const after=state.objects.map(o=>o.getBoundingRect());state.width=w;state.height=h;state.revision++;
 const next=resizeBackgroundOnly(state,1200,900,{includeWholePictures});for(const i of [1,2,3]){const b=state.objects[i].getBoundingRect(),p=next.foregroundOffset,k=next.foregroundScale;assert(Math.abs(b.left-(after[i].left*k+p.x))<1e-8);assert(Math.abs(b.top-(after[i].top*k+p.y))<1e-8);assert(Math.abs(b.width-after[i].width*k)<1e-8);assert(Math.abs(b.height-after[i].height*k)<1e-8);}
}
console.log('pass: source-relative strip, label and picture across 5 ratios, 2 modes, PPTX/JSON and repeated resize; prior footer condition reproduced');
