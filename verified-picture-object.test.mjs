import assert from 'node:assert/strict';
import {verifiedPictureObject} from './verified-picture-object.mjs';
import {resizeBackgroundOnly,trustedOutsideFitBoxes} from './background-only.mjs';
import {simpleSvgEquivalent} from './ooxml-picture-provenance.mjs';
import {simpleSvgOnly} from './dom-picture-evidence.mjs';

const url='data:image/png;base64,d2hvbGU=',base={x:-10,y:20,width:24,height:24,rotation:0,opacity:.52,flipH:false,flipV:false,crop:null,group:false,effects:[]};
const candidates=[{id:'slide:1',left:-30,top:0,width:40,height:4},{id:'slide:2',left:120,top:0,width:40,height:4}];
const items=[{sourceElementId:'slide:1',verified:true},{sourceElementId:'slide:2',verified:false}];
assert.deepEqual(trustedOutsideFitBoxes(candidates,items,o=>o.verified),[candidates[0]]);
assert.deepEqual(trustedOutsideFitBoxes(candidates,[...items,{sourceElementId:'slide:1',verified:true}],o=>o.verified),[],'duplicate source ID cannot authorize outside fit');
function make(g=base,changes={}){
 const source={status:'source-verified',opacity:g.opacity,groups:[],geometry:{...g,x:g.x*9525,y:g.y*9525,width:g.width*9525,height:g.height*9525}};
 return {source,geometry:g,mediaDataUrl:url,width:48,height:48,W:100,H:140,slideWidth:100,slideHeight:140,info:{id:'slide:7',name:'Star'},...changes};
}
let o=verifiedPictureObject(make());assert(o);assert.equal(o.left,2);assert.equal(o.top,32);assert.equal(o.opacity,.52);assert.equal(o.src,url);assert.equal(o.width,48);assert.equal(o.scaleX,.5);assert.equal(o.outsideRecovery,undefined,'one complete original asset; no separate patch');
assert(verifiedPictureObject(make({...base,rotation:-35})));assert(verifiedPictureObject(make({...base,x:0,y:0,width:100,height:140})),'edge-spanning source kept whole');
assert(verifiedPictureObject(make(base,{source:{...make().source,status:'source-equivalent'}})));
for(const change of [{source:{...make().source,status:'review'}},{geometry:{...base,x:-9}},{geometry:{...base,opacity:1}},{geometry:{...base,flipH:true}},{geometry:{...base,crop:{left:1}}},{geometry:{...base,group:true}},{geometry:{...base,effects:['shadow']}},{mediaDataUrl:'data:image/svg+xml;base64,dGVzdA=='},{W:200},{width:12001,height:1}])assert.equal(verifiedPictureObject(make(base,change)),null,JSON.stringify(change));

globalThis.document={createElement(){return {getContext(){return {clearRect(){},fillRect(){},getImageData(){return {data:new Uint8ClampedArray([226,87,68,255])}}}}}}};
class Point{constructor(x,y){this.x=x;this.y=y}}
class FabricImage{_render(){}shouldCache(){} _toSVG(){return []}}
const F={Point,FabricImage};
function live(props){return {visible:true,angle:0,scaleX:1,scaleY:1,opacity:1,...props,set(v){Object.assign(this,v)},setCoords(){},getCenterPoint(){return this.originX==='center'?new Point(this.left,this.top):new Point(this.left+this.width*this.scaleX/2,this.top+this.height*this.scaleY/2)},getBoundingRect(){const c=this.getCenterPoint(),a=this.angle*Math.PI/180,w=Math.abs(Math.cos(a)*this.width*this.scaleX)+Math.abs(Math.sin(a)*this.height*this.scaleY),h=Math.abs(Math.sin(a)*this.width*this.scaleX)+Math.abs(Math.cos(a)*this.height*this.scaleY);return {left:c.x-w/2,top:c.y-h/2,width:w,height:h}},setPositionByOrigin(p){if(this.originX==='center'){this.left=p.x;this.top=p.y;}else{this.left=p.x-this.width*this.scaleX/2;this.top=p.y-this.height*this.scaleY/2;}}}}
for(const includeWholePictures of [true,false])for(const [width,height] of [[1080,1080],[1920,1080],[1080,1920],[1080,1350],[1379,611]]){
 const plate=live({type:'rect',originX:'left',originY:'top',left:0,top:0,width:100,height:140,fill:'#e25744',layerRole:'background',layerLocked:true});
 const star=live(verifiedPictureObject(make()));const line=live(verifiedPictureObject(make({...base,x:80,y:-10,width:90,height:2,rotation:-35,opacity:.8},{info:{id:'slide:13',name:'Line'}})));
 const objects=[plate,star,line],originals=[star,line].map(p=>({center:p.getCenterPoint(),scaleX:p.scaleX,scaleY:p.scaleY,angle:p.angle,opacity:p.opacity}));
 const state={F,sourceFormat:'pptx',inputKind:'layered',width:100,height:140,epoch:1,revision:0,objects};
 const result=resizeBackgroundOnly(state,width,height,{includeWholePictures});
 if(!includeWholePictures)assert(Math.abs(result.foregroundScale-Math.min(width/100,height/140))<1e-8,'alternate mode preserves the original-frame fit');
 for(const [i,picture] of [star,line].entries()){
  const b=picture.getBoundingRect(),old=originals[i],k=result.foregroundScale,offset=result.foregroundOffset,c=picture.getCenterPoint();
  if(includeWholePictures)assert(b.left>=-1e-6&&b.top>=-1e-6&&b.left+b.width<=width+1e-6&&b.top+b.height<=height+1e-6,'complete rotated source bounds fit '+width+'x'+height);
  assert(Math.abs(picture.scaleX/old.scaleX-k)<1e-8&&Math.abs(picture.scaleY/old.scaleY-k)<1e-8);assert(Math.abs(c.x-(old.center.x*k+offset.x))<1e-8);assert(Math.abs(c.y-(old.center.y*k+offset.y))<1e-8);assert.equal(picture.angle,old.angle);assert.equal(picture.opacity,old.opacity);assert.equal(picture.src,url);
 }
 assert.equal(plate.width,width);assert.equal(plate.height,height);assert.equal(plate.left,0);assert.equal(plate.top,0);
}
globalThis.coexGetOutsideRecoveryReport=()=>({records:[{candidate:false}],omitted:0});
{
 const plate=live({type:'rect',originX:'left',originY:'top',left:0,top:0,width:100,height:140,fill:'#e25744',layerRole:'background'});
 const s={F,sourceFormat:'pptx',inputKind:'layered',width:100,height:140,epoch:1,revision:0,objects:[plate]};
 const r=resizeBackgroundOnly(s,1080,1080,{includeWholePictures:true});assert.equal(r.status,'review');assert.match(r.reason,/원본 전체를 확인하지 못한 바깥 장식/);
}
delete globalThis.coexGetOutsideRecoveryReport;
// A static SVG root version is allowed; it never admits arbitrary versions,
// nested version attributes, scripts, hrefs or a changed source structure.
const NS='http://www.w3.org/2000/svg',bytes=new TextEncoder().encode('<svg/>');
const tree=(version='1.1',childVersion=false)=>({ns:NS,name:'svg',attrs:{'|viewBox':'0 0 24 24',...(childVersion?{}:{'|version':version})},children:[{ns:NS,name:'path',attrs:{'|d':'M0 0L24 24',...(childVersion?{'|version':version}:{})},children:[]}]});
assert(simpleSvgEquivalent(bytes,bytes,{parseXml:()=>tree()}));
assert.equal(simpleSvgEquivalent(bytes,bytes,{parseXml:()=>tree('9.9')}),false);
assert.equal(simpleSvgEquivalent(bytes,bytes,{parseXml:()=>tree('1.1',true)}),false);
function doc(version,childVersion=false){
 const child={localName:'path',namespaceURI:NS,attributes:childVersion?[{name:'version',value:version}]:[]};
 const root={localName:'svg',namespaceURI:NS,attributes:childVersion?[]:[{name:'version',value:version}],querySelectorAll:()=>[child]};
 return {documentElement:root,querySelector:()=>null};
}
assert(simpleSvgOnly('<svg/>',()=>doc('1.1')));assert.equal(simpleSvgOnly('<svg/>',()=>doc('9.9')),false);assert.equal(simpleSvgOnly('<svg/>',()=>doc('1.1',true)),false);
console.log('pass: source identity/opacity/rotation, unsafe guards, static SVG version; 5 ratios in whole-source and original-frame modes with shared affine layout and solid background coverage');
