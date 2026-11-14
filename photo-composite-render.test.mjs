import assert from 'node:assert/strict';
import {installPhotoCompositeGuard,authorizePhotoCompositeExtension} from './photo-composite-render.mjs';

class Image {
 constructor(id,kind){this.id=id;this.photoInstanceKind=kind;this.photoInstanceGroup='g';this.visible=kind!=='source';this.layerLocked=kind==='source';this.width=12;this.height=8;this.opacity=1;this.el={tagName:'IMG'};this.src='data:image/png;base64,'+id;this.matrix=[1,0,0,1,4,5];this.cutoutMethod=kind==='background'?'photo-ai-residual-background':kind==='part'?'photo-ai-estimated-part':'pptx-original-object';if(kind==='source')this.originalPhotoSource='original';}
 getElement(){return this.el}getSrc(){return this.src}calcTransformMatrix(){return this.matrix}_render(ctx){ctx.push(this.id)}
}
const src=new Image('source','source'),bg=new Image('background','background'),fg=new Image('foreground','part');
const hit=[];const canvas={objects:[src,bg,fg],pixelFindContext:hit,getObjects(){return this.objects}};for(const o of canvas.objects)o.canvas=canvas;
const release=installPhotoCompositeGuard({canvas,source:src,background:bg,foreground:fg,group:'g'});
function paint(){const out=[];bg._render(out);fg._render(out);return out}
assert.deepEqual(paint(),['source'],'aligned layers paint immutable source once');
bg._render(hit);fg._render(hit);assert.deepEqual(hit,['background','foreground'],'pixel hit testing uses each mask');
fg.matrix=[1,0,0,1,5,5];assert.deepEqual(paint(),['background','foreground'],'moving foreground preserves independent layer rendering');fg.matrix=src.matrix.slice();
src.matrix=[1000000,0,0,1000000,100000000,100000000];bg.matrix=src.matrix.slice();fg.matrix=src.matrix.slice();
assert.deepEqual(paint(),['source'],'large but aligned transforms are supported');
fg.matrix[4]+=5;assert.deepEqual(paint(),['background','foreground'],'large positions must not hide a five pixel movement');
fg.matrix[4]=src.matrix[4]+0.000001;assert.deepEqual(paint(),['source'],'small floating-point position noise is allowed');
src.matrix=[1,0,0,1,4,5];bg.matrix=src.matrix.slice();fg.matrix=src.matrix.slice();
canvas.objects.splice(2,0,{id:'between'});assert.deepEqual(paint(),['background','foreground'],'intervening object changes paint order');canvas.objects.splice(2,1);
fg.visible=false;assert.deepEqual(paint(),['background','foreground'],'separate visibility is not replaced with original');fg.visible=true;
src.outsideRecovery={};assert.deepEqual(paint(),['background','foreground'],'outside restoration metadata revokes shortcut');delete src.outsideRecovery;
src._render=Image.prototype._render;assert.deepEqual(paint(),['background','foreground'],'object-local render revokes shortcut');delete src._render;
src.__outsideTrialVisible=true;assert.deepEqual(paint(),['background','foreground'],'visible outside patch revokes shortcut');delete src.__outsideTrialVisible;
fg.outsideRecovery={};assert.deepEqual(paint(),['background','foreground'],'outside part metadata revokes shortcut');delete fg.outsideRecovery;
bg.src+='changed';assert.deepEqual(paint(),['background','foreground'],'changed bitmap revokes shortcut');bg.src= 'data:image/png;base64,background';
const originalBg=bg.el;bg.el={tagName:'CANVAS'};assert.deepEqual(paint(),['background','foreground'],'changed element revokes shortcut');bg.el=originalBg;
const extension={tagName:'IMG',src:'data:image/png;base64,extension'};
assert.equal(authorizePhotoCompositeExtension({background:bg,originalElement:{},element:extension,x:5,y:0,width:20,height:8}),false,'original image identity is required');
assert.equal(authorizePhotoCompositeExtension({background:bg,originalElement:originalBg,element:extension,x:5,y:0,width:20,height:8}),true);
bg.el=extension;bg.src=extension.src;bg.width=20;bg.matrix=[1,0,0,1,3,5];
const calls=[];for(const method of ['save','restore','beginPath','rect','clip','translate'])calls[method]=(...args)=>calls.push([method,...args]);
bg._render(calls);fg._render(calls);assert.deepEqual(calls.filter(x=>typeof x==='string'),['background','source'],'extended margins and one original are painted');
assert(calls.some(x=>Array.isArray(x)&&x[0]==='clip'&&x[1]==='evenodd'),'source frame is excluded from extension');
extension.src+='changed';assert.deepEqual(paint(),['background','foreground'],'changed extension data revokes shortcut');
bg.el=originalBg;bg.src='data:image/png;base64,background';bg.width=12;bg.matrix=src.matrix.slice();
bg.cutoutMethod='photo-ai-estimated-inpaint';assert.deepEqual(paint(),['background','foreground'],'unverified repaired pixels do not use original shortcut');
release();assert.deepEqual(paint(),['background','foreground'],'release restores original renderer');
console.log('pass: aligned source rendered once, independent hit masks, edits and paint order fail closed');
