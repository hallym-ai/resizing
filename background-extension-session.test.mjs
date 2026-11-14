import assert from 'node:assert/strict';
import {registerPhotoExtension,invalidatePhotoExtensions,selectPhotoExtension,photoExtensionGeometry,preparePhotoExtension,applyPhotoExtension} from './background-extension-session.mjs';

const width=32,height=32,pixels=new Uint8ClampedArray(width*height*4),mask=new Uint8Array(width*height);
for(let i=0;i<width*height;i++){pixels[i*4]=70+i%width;pixels[i*4+1]=90;pixels[i*4+2]=100;pixels[i*4+3]=255;}mask[16*width+16]=255;
const original={id:'original'},group='fixture';
const background={photoInstanceKind:'background',photoInstanceGroup:group,cutoutMethod:'photo-ai-estimated-inpaint',layerRole:'other',visible:true,width,height,left:0,top:0,scaleX:1,scaleY:1,strokeWidth:0,element:original,
 getElement(){return this.element;},setElement(v){this.element=v;},set(v){Object.assign(this,v);},setCoords(){},getBoundingRect(){return {left:this.left,top:this.top,width:this.width*this.scaleX,height:this.height*this.scaleY};}};
const source={photoInstanceKind:'source',photoInstanceGroup:group,visible:false},part={photoInstanceKind:'part',photoInstanceGroup:group,visible:true};
const state={width,height,objects:[source,background,part]};
globalThis.CSS={supports:(kind,value)=>kind==='color'&&/^#[0-9a-f]{6}$/i.test(value)};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({clearRect(){},fillRect(){},getImageData(){return {data:new Uint8ClampedArray([255,255,255,255])};}})})};
let exported;const makeCanvas=(w,h)=>({width:w,height:h,getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:data=>{exported=data.data;}}),toDataURL:()=>`fixture:${w}x${h}`});
const decode=async src=>({src,pixels:new Uint8ClampedArray(exported)});
assert.equal(registerPhotoExtension({object:background,pixels,foregroundMask:mask,width,height}),true);
const selected=selectPhotoExtension(state);assert.ok(selected);
// Every ratio is prepared from the same frozen original; a ZIP uses the same path.
for(const [targetW,targetH,left,top] of [[64,32,16,0],[32,64,0,16],[64,64,16,16]]){
 Object.assign(background,{element:original,width,height,left,top,scaleX:1,scaleY:1});
 const geometry=photoExtensionGeometry(selected,targetW,targetH),plan=await preparePhotoExtension(geometry,{makeCanvas,decode});assert.equal(plan.status,'review');
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const from=(y*width+x)*4,to=((y+geometry.y)*geometry.width+x+geometry.x)*4;assert.deepEqual(plan.element.pixels.slice(to,to+4),pixels.slice(from,from+4));}
 assert.ok(applyPhotoExtension(plan));assert.equal(background.left,0);assert.equal(background.top,0);assert.equal(background.width,targetW);assert.equal(background.height,targetH);
}
Object.assign(background,{element:original,width,height,left:0,top:0,scaleX:1,scaleY:1});
assert.equal(selectPhotoExtension({...state,width:64}),null,'partial-slide photo is not eligible');
assert.equal(selectPhotoExtension({...state,objects:[{visible:true},...state.objects]}),null,'no covering earlier visible elements');
const floor={type:'rect',fill:'#ffffff',layerRole:'background',visible:true,opacity:1,getBoundingRect:()=>({left:0,top:0,width,height})};
assert.ok(selectPhotoExtension({...state,objects:[floor,...state.objects]}),'full-frame opaque solid slide floor allowed');
assert.equal(selectPhotoExtension({...state,objects:[{...floor,getBoundingRect:()=>({left:0,top:0,width:width-1,height})},...state.objects]}),null,'partial floor rejected');
assert.equal(selectPhotoExtension({...state,objects:[{...floor,fill:{colorStops:[]}},...state.objects]}),null,'gradient below photograph rejected');
assert.equal(selectPhotoExtension({...state,objects:[{...floor,layerRole:'subject'},...state.objects]}),null,'non-background element rejected');
assert.equal(selectPhotoExtension({...state,objects:[{...floor,fill:'not-a-color'},...state.objects]}),null,'invalid CSS color rejected');
const normalBox=background.getBoundingRect;
background.getBoundingRect=()=>({left:-1.19,top:-1.68,width:1002.38,height:2005.04});
assert.ok(selectPhotoExtension({...state,width:1000,height:2000}),'small proportional native overshoot allowed');
background.getBoundingRect=()=>({left:-3,top:0,width:1003,height:2000});
assert.equal(selectPhotoExtension({...state,width:1000,height:2000}),null,'large proportional overshoot rejected');
background.getBoundingRect=()=>({left:1,top:0,width:999,height:2000});
assert.equal(selectPhotoExtension({...state,width:1000,height:2000}),null,'exposed inset is not a full-frame background');
background.getBoundingRect=normalBox;
const residualPixels=pixels.slice();residualPixels[(16*width+16)*4+3]=0;background.cutoutMethod='photo-ai-residual-background';
assert.equal(registerPhotoExtension({object:background,pixels:residualPixels,foregroundMask:mask,width,height}),true,'reviewed residual can extend only outside');
const residual=selectPhotoExtension(state);assert.ok(residual);background.left=16;
const residualPlan=await preparePhotoExtension(photoExtensionGeometry(residual,64,32),{makeCanvas,decode});assert.equal(residualPlan.status,'review');
assert.equal(residualPlan.element.pixels[(16*64+32)*4+3],0,'interior residual hole remains transparent');
assert.equal(residualPlan.element.pixels[3],255,'outside edge filled');assert.ok(applyPhotoExtension(residualPlan));
Object.assign(background,{element:original,width,height,left:0,top:0,scaleX:1,scaleY:1,cutoutMethod:'photo-ai-estimated-inpaint'});
const edgeMask=mask.slice();edgeMask[0]=255;assert.equal(registerPhotoExtension({object:background,pixels,foregroundMask:edgeMask,width,height}),true);
const blocked=selectPhotoExtension(state);background.left=16;assert.equal((await preparePhotoExtension(photoExtensionGeometry(blocked,64,32),{makeCanvas,decode})).reason,'foreground-touches-edge');
background.left=0;invalidatePhotoExtensions();assert.equal(selectPhotoExtension(state),null,'an edit/undo invalidates session evidence');
console.log('pass: session trust, full-page restriction, multi-ratio original pixels, foreground-edge rejection and invalidation');
