import {solidBackgroundColor} from './solid-background.mjs';
const expanded=new WeakSet(),cache=new WeakMap();
function nativePlaneColor(o){
 const el=o.getElement?.();if(!el)return null;if(cache.has(el))return cache.get(el);
 const w=el.naturalWidth||el.width,h=el.naturalHeight||el.height;if(w*h>4000000)return null;
 const c=document.createElement('canvas');c.width=w;c.height=h;let color=null;
 try{const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(el,0,0);const d=x.getImageData(0,0,w,h).data,r=d[0],g=d[1],b=d[2];let valid=true;for(let y=0;y<h&&valid;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,border=x===0||y===0||x===w-1||y===h-1;if(d[i]!==r||d[i+1]!==g||d[i+2]!==b||(!border&&d[i+3]!==255)||border&&d[i+3]===0){valid=false;break;}}if(valid)color='#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');}catch{}finally{c.width=c.height=0;}cache.set(el,color);return color;
}
// A uniform native plate behind text/photos is a background even if it is partial-height.
export function promoteNativeUnderlay(state){
 if(state.inputKind==='raster'||state.sourceFormat!=='pptx')return [];
 const promoted=[];
 for(const o of [...state.objects]){
  const i=state.objects.indexOf(o);if(expanded.has(o))continue;
  if(o.visible===false||o.layerLocked||!o.layerRoleInferred||o.layoutManualRole||o.layoutManualGroup||o.layerRole==='background'||o.sourceElementType!=='picture'||o.cutoutMethod!=='pptx-original-object'||o.sourceText||o.text||o.sourceImageFill)continue;
  const b=o.getBoundingRect();if(b.left>state.width*.03||b.left<-state.width*.03||b.top>state.height*.03||b.top<-state.height*.03||b.width<state.width*.95||b.height<state.height*.3||b.height>state.height*.9)continue;
  const later=state.objects.slice(i+1).filter(x=>x.visible!==false);
  if(!later.some(x=>typeof x.text==='string')||!later.some(x=>x.sourceElementType==='picture'&&x.getBoundingRect().height>state.height*.4))continue;
  const old=o.layerRole;let color=null;o.layerRole='background';try{color=solidBackgroundColor(o);}finally{o.layerRole=old;}
  if(color){o.layerRole='background';promoted.push({id:i,color,evidence:'independent-opaque-uniform-native-underlay'});continue;}
  // Native capture can antialias one outer row. Preserve the source image and
  // place an editable solid plate beneath it only after full RGB/interior proof.
  color=nativePlaneColor(o);if(!color||!o.canvas)continue;
  const plate=new state.F.Rect({left:0,top:0,width:state.width,height:state.height,originX:'left',originY:'top',fill:color,strokeWidth:0,layerRole:'background',layerLocked:true,layerName:'원본 단색 배경판 · 여백 확장',cutoutMethod:'verified-native-solid-underlay'});
  o.canvas.insertAt(i,plate);state.objects.splice(i,0,plate);expanded.add(o);promoted.push({id:i,color,evidence:'uniform-native-rgb-opaque-interior-edge-antialias'});
 }
 return promoted;
}
