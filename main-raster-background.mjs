import {inferVisibleTexture} from './background-extractor.mjs';
const cache=new WeakMap();
function profile(source){
 if(!source)return null;
 const w=source.naturalWidth||source.width,h=source.naturalHeight||source.height,key=(source.currentSrc||source.src||'')+':'+w+'x'+h,immutable=source.tagName==='IMG',old=cache.get(source);
 if(immutable&&old?.key===key)return old.profile;
 const result=inferVisibleTexture(source);if(immutable)cache.set(source,{key,profile:result});return result;
}
function draw(ctx,source,width,height,frame){
 const p=profile(source);if(!p)return false;const scale=frame.dw/p.sourceWidth;
 if(!(scale>0))return false;
 ctx.save();try{const left=Math.ceil(frame.x+1),top=Math.ceil(frame.y+1),right=Math.floor(frame.x+frame.dw-1),bottom=Math.floor(frame.y+frame.dh-1);ctx.beginPath();ctx.rect(0,0,width,height);if(right>left&&bottom>top)ctx.rect(left,top,right-left,bottom-top);ctx.clip('evenodd');ctx.translate(frame.x,frame.y);ctx.scale(scale,scale);ctx.fillStyle=ctx.createPattern(p.tile,'repeat');ctx.fillRect(-frame.x/scale,-frame.y/scale,width/scale,height/scale);return true;}finally{ctx.restore();}
}
globalThis.coexMainRasterBackground={profile,draw};
queueMicrotask(()=>globalThis.scheduleRender?.());
