// Non-generative continuation of separate paper or independently layered masonry.
// Statistics are a conservative heuristic, never proof of semantic emptiness.
import {solidBackgroundColor} from './solid-background.mjs';
const profiles=new WeakMap(),masonryProfiles=new WeakMap(),installed=new WeakSet();
export function paperTextureProfile(o,state){
 if(state.inputKind==='raster'||!(state.sourceFormat==='pptx'||state.sourceFormat==='json'&&validTextureFrame(o.textureBackgroundFrame))||o.sourceElementType!=='picture'||o.cutoutMethod!=='pptx-original-object'||o.sourceImageFill||o.sourceText||o.text||o.clipPath||o.cropX||o.cropY||o.filters?.length||o.stroke&&o.strokeWidth||o.shadow||o.angle||o.skewX||o.skewY||o.flipX||o.flipY||(o.opacity??1)!==1||o.globalCompositeOperation&&o.globalCompositeOperation!=='source-over')return null;
 if(state.objects.filter(x=>x!==o&&x.visible!==false&&x.layerRole!=='background'&&x.cutoutMethod==='pptx-original-object'&&x.sourceElementId).length<2)return null;
 const el=o.getElement?.();if(!el)return null;const sw=el.naturalWidth||el.width,sh=el.naturalHeight||el.height;if(sw<32||sh<32||sw*sh>24000000)return null;
 const at=state.objects.indexOf(o),below=state.objects.slice(0,at).filter(bg=>bg.visible!==false).at(-1),bb=below?.getBoundingRect();
 const matte=bb&&Math.abs(bb.left)<=2&&Math.abs(bb.top)<=2&&Math.abs(bb.width-state.width)<=2&&Math.abs(bb.height-state.height)<=2?solidBackgroundColor(below):null;
 const immutable=el.tagName==='IMG',key=(el.currentSrc||el.src||'')+':'+sw+'x'+sh+':'+matte,previous=profiles.get(el);if(immutable&&previous?.key===key)return previous.result;
 const full=document.createElement('canvas');full.width=sw;full.height=sh;let alphaMinimum=255,translucentPixels=0;
 try{const x=full.getContext('2d',{willReadFrequently:true});x.drawImage(el,0,0);const p=x.getImageData(0,0,sw,sh).data;for(let i=3;i<p.length;i+=4){alphaMinimum=Math.min(alphaMinimum,p[i]);if(p[i]<255)translucentPixels++;}}catch{return null;}finally{full.width=full.height=0;}
 // A real opaque lower plate is required for translucent paper, rather than
 // silently treating every input as if it were painted on white.
 if(translucentPixels&&!matte)return null;
 const c=document.createElement('canvas');c.width=c.height=128;let result=null;
 try{const ctx=c.getContext('2d',{willReadFrequently:true});if(matte){ctx.fillStyle=matte;ctx.fillRect(0,0,128,128);}ctx.drawImage(el,0,0,128,128);const data=ctx.getImageData(0,0,128,128).data,values=[],chroma=[],blocks=[];
  for(let y=0;y<128;y+=16)for(let x=0;x<128;x+=16){let sum=0;for(let yy=y;yy<y+16;yy++)for(let xx=x;xx<x+16;xx++){const i=(yy*128+xx)*4,r=data[i],g=data[i+1],b=data[i+2],v=(r+g+b)/3;values.push(v);chroma.push(Math.max(r,g,b)-Math.min(r,g,b));sum+=v;}blocks.push(sum/256);}
  values.sort((a,b)=>a-b);chroma.sort((a,b)=>a-b);const q=p=>values[Math.floor((values.length-1)*p)],mean=values.reduce((a,b)=>a+b)/values.length,sd=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length),spread=Math.max(...blocks)-Math.min(...blocks);
  if(values[0]>=145&&q(.01)>=195&&q(.5)>=215&&chroma[Math.floor(chroma.length*.99)]<=12&&spread<=40&&sd>=1&&sd<=22)result={evidence:'inferred-separate-low-contrast-paper',minimum:values[0],p01:q(.01),median:q(.5),standardDeviation:sd,blockMeanSpread:spread,alphaMinimum,translucentPixels,matteEvidence:matte?'verified-opaque-lower-plate':'all-source-alpha-255',matte,status:'review'};
 }catch{}finally{c.width=c.height=0;}
 if(immutable)profiles.set(el,{key,result});return result;
}
export function validTextureFrame(f){return f&&f.version===1&&[f.x,f.y,f.w,f.h].every(Number.isFinite)&&f.w>0&&f.h>0&&Math.abs(f.x)<1e7&&Math.abs(f.y)<1e7&&f.w<1e7&&f.h<1e7;}
const validFrame=validTextureFrame;
export function extendPaperTexture(o,state,width,height,scale,offset){
 const old=o.textureBackgroundFrame,b=o.getBoundingRect(),source=validFrame(old)?old:{x:b.left,y:b.top,w:b.width,h:b.height};
 const frame={version:1,x:offset.x+source.x*scale,y:offset.y+source.y*scale,w:source.w*scale,h:source.h*scale};
 if(frame.w<8||frame.h<8)throw Error('질감 원본 영역이 너무 작아 배경 확장을 보류했습니다.');
 const cols=Math.ceil(width/frame.w)+2,rows=Math.ceil(height/frame.h)+2;
 if(cols*rows>4096)throw Error('질감 반복 범위가 너무 커 배경 확장을 보류했습니다.');
 o.set({textureBackgroundFrame:frame,left:0,top:0,originX:'left',originY:'top',width,height,scaleX:1,scaleY:1,objectCaching:false});o.setCoords();
 return frame;
}
export function installTextureBackgroundRenderer(F){
 if(installed.has(F))return;installed.add(F);const proto=F.FabricImage.prototype,render=proto._render,shouldCache=proto.shouldCache,svg=proto._toSVG;
 proto.shouldCache=function(...args){return validFrame(this.textureBackgroundFrame)?false:shouldCache.apply(this,args);};
 proto._render=function(ctx){
  const f=this.textureBackgroundFrame;if(!validFrame(f))return render.call(this,ctx);
  const el=this.getElement(),W=this.width,H=this.height;
  const guard=2,x0=Math.ceil(f.x+guard),y0=Math.ceil(f.y+guard),x1=Math.floor(f.x+f.w-guard),y1=Math.floor(f.y+f.h-guard);
  const a=Math.floor(-f.x/f.w),b=Math.ceil((W-f.x)/f.w),c=Math.floor(-f.y/f.h),d=Math.ceil((H-f.y)/f.h);
  if((b-a)*(d-c)>4096)return render.call(this,ctx);
  ctx.save();try{
   ctx.translate(-W/2,-H/2);ctx.imageSmoothingEnabled=true;
   // Preserve the original interior. A 2px background-only guard band repairs
   // the native capture's transparent border fringe; no foreground is painted.
   ctx.save();ctx.beginPath();ctx.rect(0,0,W,H);ctx.rect(x0,y0,x1-x0,y1-y0);ctx.clip('evenodd');
   const ew=el.naturalWidth||el.width,eh=el.naturalHeight||el.height,trim=1;
   for(let iy=c;iy<d;iy++)for(let ix=a;ix<b;ix++){const flipX=Math.abs(ix%2)===1,flipY=Math.abs(iy%2)===1;ctx.save();ctx.translate(f.x+ix*f.w+(flipX?f.w:0),f.y+iy*f.h+(flipY?f.h:0));ctx.scale(flipX?-1:1,flipY?-1:1);ctx.drawImage(el,trim,trim,ew-trim*2,eh-trim*2,0,0,f.w,f.h);ctx.restore();}
   ctx.restore();ctx.drawImage(el,f.x,f.y,f.w,f.h);
  }finally{ctx.restore();}
 };
 // SVG exports bake only the continued background. The original asset remains
 // in getSrc()/JSON; all ordinary text and vector SVG paths stay unchanged.
 proto._toSVG=function(){if(!validFrame(this.textureBackgroundFrame))return svg.call(this);const c=document.createElement('canvas');c.width=this.width;c.height=this.height;try{const ctx=c.getContext('2d');ctx.translate(this.width/2,this.height/2);this._render(ctx);return['<image ','COMMON_PARTS',`xlink:href="${c.toDataURL('image/png')}" x="${-this.width/2}" y="${-this.height/2}" width="${this.width}" height="${this.height}" />`];}finally{c.width=c.height=0;}};
}

// Only full-frame native background pictures below independently editable
// foreground qualify. Colour and grout periodicity remain review heuristics.
export function masonryTextureProfile(o,state){
 if(state.inputKind==='raster'||!(state.sourceFormat==='pptx'||state.sourceFormat==='json'&&validTextureFrame(o.textureBackgroundFrame))||o.layerRole!=='background'||o.sourceElementType!=='picture'||o.cutoutMethod!=='pptx-original-object'||o.sourceImageFill||o.sourceText||o.text||o.clipPath||o.cropX||o.cropY||o.filters?.length||o.stroke&&o.strokeWidth||o.shadow||o.angle||o.skewX||o.skewY||o.flipX||o.flipY||(o.opacity??1)!==1||o.globalCompositeOperation&&o.globalCompositeOperation!=='source-over')return null;
 const at=state.objects.indexOf(o),fg=state.objects.filter(x=>x!==o&&x.visible!==false&&x.layerRole!=='background'&&x.cutoutMethod==='pptx-original-object'&&x.sourceElementId);
 if(fg.length<2||fg.some(x=>state.objects.indexOf(x)<at))return null;
 const el=o.getElement?.();if(!el)return null;const sw=el.naturalWidth||el.width,sh=el.naturalHeight||el.height;if(sw<64||sh<64||sw*sh>24000000)return null;
 const below=state.objects.slice(0,at).filter(x=>x.visible!==false).at(-1),bb=below?.getBoundingRect(),matte=bb&&Math.abs(bb.left)<=2&&Math.abs(bb.top)<=2&&Math.abs(bb.width-state.width)<=2&&Math.abs(bb.height-state.height)<=2?solidBackgroundColor(below):null;
 const key='masonry:'+(el.currentSrc||el.src||'')+':'+sw+'x'+sh+':'+matte,old=masonryProfiles.get(el);if(el.tagName==='IMG'&&old?.key===key)return old.result;
 if(el.tagName==='IMG')masonryProfiles.set(el,{key,result:null});
 const c=document.createElement('canvas');c.width=sw;c.height=sh;let result=null;
 try{const ctx=c.getContext('2d',{willReadFrequently:true});if(matte){ctx.fillStyle=matte;ctx.fillRect(0,0,sw,sh);}ctx.drawImage(el,0,0);const p=ctx.getImageData(0,0,sw,sh).data;let red=0,light=0,green=0,alpha=255;
 for(let i=0;i<p.length;i+=4){const r=p[i],g=p[i+1],b=p[i+2];alpha=Math.min(alpha,p[i+3]);if(r>g*1.18&&r>b*1.2)red++;if(Math.min(r,g,b)>210&&Math.max(r,g,b)-Math.min(r,g,b)<35)light++;if(g-r>35&&g-b>20&&g>90)green++;}
 const n=p.length/4;if(alpha!==255||red/n<=.55||light/n>=.12||green/n>=.001)return null;
 const small=document.createElement('canvas');small.width=small.height=128;try{const sx=small.getContext('2d',{willReadFrequently:true});sx.drawImage(c,0,0,128,128);const d=sx.getImageData(0,0,128,128).data,rows=[];
 for(let y=2;y<126;y++){let neutral=0;for(let x=0;x<128;x++){const i=(y*128+x)*4,r=d[i],g=d[i+1],b=d[i+2];if(Math.max(r,g,b)-Math.min(r,g,b)<48&&Math.min(r,g,b)>65)neutral++;}if(neutral/128>.45&&(!rows.length||y-rows.at(-1)>3))rows.push(y);}
 const gaps=rows.slice(1).map((v,i)=>v-rows[i]),mean=gaps.reduce((a,b)=>a+b,0)/gaps.length,variation=gaps.length?Math.sqrt(gaps.reduce((s,v)=>s+(v-mean)**2,0)/gaps.length)/mean:Infinity;
 if(rows.length>=5&&variation<.35)result={evidence:'inferred-independent-native-masonry',status:'review',redFraction:red/n,lightFraction:light/n,greenFraction:green/n,groutRows:rows.length,groutPeriodVariation:variation,alphaMinimum:alpha,matte,scope:'whole native asset colour and grout periodicity; not semantic no-text proof'};
 }finally{small.width=small.height=0;}
 }catch{}finally{c.width=c.height=0;}
 if(el.tagName==='IMG')masonryProfiles.set(el,{key,result});return result;
}
